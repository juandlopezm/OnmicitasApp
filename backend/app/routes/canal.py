"""
API para canales externos (WhatsApp, app móvil, teléfono, etc.).

Autenticación: API Key en header X-Canal-Key  (no JWT)
Canal:         declarado en header X-Canal-Nombre  (whatsapp | app_movil | telefono)

Endpoints:
  GET  /api/canal/afiliado                → buscar afiliado por documento + password
  GET  /api/canal/citas/<doc>             → citas activas de un afiliado
  POST /api/canal/citas                   → agendar cita desde canal externo
  DELETE /api/canal/citas/<id>/cancelar   → cancelar cita desde canal externo

Flujo típico de un bot de WhatsApp:
  1. Usuario envía su documento y PIN al bot.
  2. Bot llama GET /api/canal/afiliado  → obtiene afiliado_id.
  3. Bot llama GET /api/canal/citas/{doc} → muestra citas actuales.
  4. Bot guía la selección y llama POST /api/canal/citas.
  5. Bot recibe la confirmación y la reenvía al usuario por WhatsApp.
"""

from flask import Blueprint, request, jsonify, g
from app.extensions import db
from app.models.afiliado import Afiliado
from app.models.cita import Cita
from app.services.cita_service import crear_cita, cancelar_cita
from app.services.notification_service import get_notification_service
from app.services.event_service import emit_event
from app.utils.decorators import canal_required

canal_bp = Blueprint("canal", __name__)


@canal_bp.get("/api/canal/afiliado")
@canal_required
def identificar_afiliado():
    """
    Identifica al afiliado por tipo_documento + numero_documento + password.
    El bot lo llama para obtener el afiliado_id antes de operar.
    ---
    tags: [Canal]
    parameters:
      - name: tipo_documento
        in: query
        type: string
        required: true
      - name: numero_documento
        in: query
        type: string
        required: true
      - name: password
        in: query
        type: string
        required: true
    responses:
      200:
        description: Afiliado identificado
      401:
        description: Credenciales inválidas
    """
    tipo_doc = request.args.get("tipo_documento")
    num_doc  = request.args.get("numero_documento")
    password = request.args.get("password")

    if not all([tipo_doc, num_doc, password]):
        return jsonify({"error": "tipo_documento, numero_documento y password son requeridos"}), 400

    afiliado = Afiliado.query.filter_by(
        tipo_documento=tipo_doc,
        numero_documento=num_doc,
    ).first()

    if not afiliado or not afiliado.check_password(password):
        return jsonify({"error": "Credenciales inválidas"}), 401

    if afiliado.tipo != "cotizante" or afiliado.estado != "activo":
        return jsonify({"error": "Solo cotizantes activos pueden usar este canal"}), 403

    return jsonify({
        "afiliado_id": afiliado.id,
        "nombre": f"{afiliado.nombres} {afiliado.apellidos}",
        "canal": g.canal_nombre,
    }), 200


@canal_bp.get("/api/canal/citas/<numero_documento>")
@canal_required
def ver_citas(numero_documento: str):
    """
    Retorna las citas activas de un afiliado identificado por número de documento.
    ---
    tags: [Canal]
    parameters:
      - name: numero_documento
        in: path
        type: string
        required: true
    responses:
      200:
        description: Lista de citas activas
      404:
        description: Afiliado no encontrado
    """
    afiliado = Afiliado.query.filter_by(numero_documento=numero_documento).first()
    if not afiliado:
        return jsonify({"error": "Afiliado no encontrado"}), 404

    citas = (
        Cita.query
        .filter(
            Cita.afiliado_id == afiliado.id,
            Cita.estado.in_(["programada", "confirmada", "reagendada"]),
        )
        .order_by(Cita.fecha, Cita.hora_inicio)
        .all()
    )
    return jsonify([c.to_dict() for c in citas]), 200


@canal_bp.post("/api/canal/citas")
@canal_required
def agendar_desde_canal():
    """
    Agenda una cita desde un canal externo.
    El campo `canal` en la cita se toma del header X-Canal-Nombre.
    ---
    tags: [Canal]
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [afiliado_id, horario_id, especialidad_id, sede_id]
          properties:
            afiliado_id:
              type: integer
            horario_id:
              type: integer
            especialidad_id:
              type: integer
            sede_id:
              type: integer
            notas:
              type: string
    responses:
      201:
        description: Cita agendada desde canal externo
      422:
        description: Error de regla de negocio
    """
    data = request.get_json(silent=True) or {}

    afiliado_id    = data.get("afiliado_id")
    horario_id     = data.get("horario_id")
    especialidad_id = data.get("especialidad_id")
    sede_id        = data.get("sede_id")

    if not all([afiliado_id, horario_id, especialidad_id, sede_id]):
        return jsonify({"error": "afiliado_id, horario_id, especialidad_id y sede_id son requeridos"}), 400

    cita, error = crear_cita(
        afiliado_id=int(afiliado_id),
        horario_id=int(horario_id),
        especialidad_id=int(especialidad_id),
        sede_id=int(sede_id),
        notas=data.get("notas"),
        canal=g.canal_nombre,   # ← "whatsapp", "app_movil", etc.
    )

    if error:
        return jsonify({"error": error}), 422

    # Notificar al afiliado por el canal correspondiente
    notif = get_notification_service()
    notif.confirmar_cita(cita.afiliado, cita)

    # Emitir SSE para que la web del admin lo vea en tiempo real
    emit_event("cita_creada", cita.to_dict())

    return jsonify(cita.to_dict()), 201


@canal_bp.delete("/api/canal/citas/<int:cita_id>/cancelar")
@canal_required
def cancelar_desde_canal(cita_id: int):
    """
    Cancela una cita desde un canal externo.
    ---
    tags: [Canal]
    parameters:
      - name: cita_id
        in: path
        type: integer
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [afiliado_id]
          properties:
            afiliado_id:
              type: integer
    responses:
      200:
        description: Cita cancelada
      422:
        description: No se puede cancelar
    """
    data        = request.get_json(silent=True) or {}
    afiliado_id = data.get("afiliado_id")

    if not afiliado_id:
        return jsonify({"error": "afiliado_id es requerido"}), 400

    ok, error = cancelar_cita(cita_id=cita_id, afiliado_id=int(afiliado_id))
    if not ok:
        return jsonify({"error": error}), 422

    cita = Cita.query.get(cita_id)
    if cita:
        notif = get_notification_service()
        notif.cancelar_cita(cita.afiliado, cita)
        emit_event("cita_actualizada", cita.to_dict())

    return jsonify({"message": "Cita cancelada exitosamente"}), 200
