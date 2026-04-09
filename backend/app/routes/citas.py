"""
Gestión de citas médicas.

Afiliado:
  GET    /api/citas/mis-citas          → citas activas propias y de beneficiarios
  GET    /api/citas/historial           → historial completo
  POST   /api/citas                    → agendar cita
  PUT    /api/citas/<id>/reagendar     → reagendar
  DELETE /api/citas/<id>/cancelar      → cancelar

Admin:
  GET    /api/admin/citas              → todas las citas (filtros)
  POST   /api/admin/citas              → crear cita para cualquier afiliado
  PUT    /api/admin/citas/<id>/estado  → cambiar estado
  DELETE /api/admin/citas/<id>/cancelar → cancelar (sin restricción de 24 h)
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from app.models.cita import Cita
from app.services.cita_service import (
    crear_cita,
    cancelar_cita,
    reagendar_cita,
    get_citas_activas_afiliado,
    get_historial_afiliado,
)
from app.services.event_service import emit_event
from app.services.notification_service import get_notification_service
from app.utils.decorators import afiliado_required, admin_required

citas_bp = Blueprint("citas", __name__)

ESTADOS_VALIDOS = ("programada", "confirmada", "cancelada", "completada", "no_asistio", "reagendada")


# ── Rutas afiliado ─────────────────────────────────────────────────────────────

@citas_bp.get("/api/citas/mis-citas")
@afiliado_required
def mis_citas():
    afiliado_id = int(get_jwt_identity())
    citas = get_citas_activas_afiliado(afiliado_id)
    return jsonify([c.to_dict() for c in citas]), 200


@citas_bp.get("/api/citas/historial")
@afiliado_required
def historial():
    afiliado_id = int(get_jwt_identity())
    citas = get_historial_afiliado(afiliado_id)
    return jsonify([c.to_dict() for c in citas]), 200


@citas_bp.post("/api/citas")
@afiliado_required
def agendar():
    afiliado_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    horario_id = data.get("horario_id")
    especialidad_id = data.get("especialidad_id")
    sede_id = data.get("sede_id")

    if not all([horario_id, especialidad_id, sede_id]):
        return jsonify({"error": "horario_id, especialidad_id y sede_id son requeridos"}), 400

    cita, error = crear_cita(
        afiliado_id=afiliado_id,
        horario_id=int(horario_id),
        especialidad_id=int(especialidad_id),
        sede_id=int(sede_id),
        beneficiario_id=data.get("beneficiario_id"),
        notas=data.get("notas"),
        canal="web",
    )

    if error:
        return jsonify({"error": error}), 422

    get_notification_service().confirmar_cita(cita.afiliado, cita)
    emit_event("cita_creada", cita.to_dict())
    return jsonify(cita.to_dict()), 201


@citas_bp.delete("/api/citas/<int:cita_id>/cancelar")
@afiliado_required
def cancelar(cita_id):
    afiliado_id = int(get_jwt_identity())
    ok, error = cancelar_cita(cita_id=cita_id, afiliado_id=afiliado_id)
    if not ok:
        return jsonify({"error": error}), 422
    cita = Cita.query.get(cita_id)
    if cita:
        get_notification_service().cancelar_cita(cita.afiliado, cita)
        emit_event("cita_actualizada", cita.to_dict())
    return jsonify({"message": "Cita cancelada exitosamente"}), 200


@citas_bp.put("/api/citas/<int:cita_id>/reagendar")
@afiliado_required
def reagendar(cita_id):
    afiliado_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    nuevo_horario_id = data.get("nuevo_horario_id")
    nueva_sede_id = data.get("nueva_sede_id")

    if not nuevo_horario_id or not nueva_sede_id:
        return jsonify({"error": "nuevo_horario_id y nueva_sede_id son requeridos"}), 400

    cita, error = reagendar_cita(
        cita_id=cita_id,
        afiliado_id=afiliado_id,
        nuevo_horario_id=int(nuevo_horario_id),
        nueva_sede_id=int(nueva_sede_id),
    )

    if error:
        return jsonify({"error": error}), 422

    emit_event("cita_actualizada", cita.to_dict())
    return jsonify(cita.to_dict()), 200


# ── Rutas admin ────────────────────────────────────────────────────────────────

@citas_bp.get("/api/admin/citas")
@admin_required
def listar_admin():
    query = Cita.query

    afiliado_id = request.args.get("afiliado_id", type=int)
    estado = request.args.get("estado")
    fecha = request.args.get("fecha")
    medico_id = request.args.get("medico_id", type=int)

    if afiliado_id:
        query = query.filter(
            (Cita.afiliado_id == afiliado_id) | (Cita.beneficiario_id == afiliado_id)
        )
    if estado:
        query = query.filter_by(estado=estado)
    if fecha:
        from datetime import date
        try:
            query = query.filter_by(fecha=date.fromisoformat(fecha))
        except ValueError:
            return jsonify({"error": "Formato de fecha inválido"}), 400
    if medico_id:
        query = query.filter_by(medico_id=medico_id)

    citas = query.order_by(Cita.fecha.desc(), Cita.hora_inicio.desc()).all()
    return jsonify([c.to_dict() for c in citas]), 200


@citas_bp.post("/api/admin/citas")
@admin_required
def admin_agendar():
    """Crea una cita para cualquier afiliado activo (sin restricción de 24 h)."""
    data = request.get_json(silent=True) or {}

    afiliado_id = data.get("afiliado_id")
    horario_id = data.get("horario_id")
    especialidad_id = data.get("especialidad_id")
    sede_id = data.get("sede_id")

    if not all([afiliado_id, horario_id, especialidad_id, sede_id]):
        return jsonify({"error": "afiliado_id, horario_id, especialidad_id y sede_id son requeridos"}), 400

    cita, error = crear_cita(
        afiliado_id=int(afiliado_id),
        horario_id=int(horario_id),
        especialidad_id=int(especialidad_id),
        sede_id=int(sede_id),
        beneficiario_id=data.get("beneficiario_id"),
        notas=data.get("notas"),
        es_admin=True,
        canal="admin",
    )

    if error:
        return jsonify({"error": error}), 422

    get_notification_service().confirmar_cita(cita.afiliado, cita)
    emit_event("cita_creada", cita.to_dict())
    return jsonify(cita.to_dict()), 201


@citas_bp.put("/api/admin/citas/<int:cita_id>/estado")
@admin_required
def cambiar_estado(cita_id):
    cita = Cita.query.get_or_404(cita_id)
    data = request.get_json(silent=True) or {}
    nuevo_estado = data.get("estado")

    if nuevo_estado not in ESTADOS_VALIDOS:
        return jsonify({"error": f"Estado inválido. Opciones: {ESTADOS_VALIDOS}"}), 400

    if nuevo_estado == "cancelada" and cita.estado not in ("cancelada", "completada"):
        from app.models.horario import Horario
        horario = Horario.query.get(cita.horario_id)
        if horario:
            horario.estado = "disponible"

    cita.estado = nuevo_estado
    from app.extensions import db
    db.session.commit()

    emit_event("cita_actualizada", cita.to_dict())
    return jsonify(cita.to_dict()), 200


@citas_bp.delete("/api/admin/citas/<int:cita_id>/cancelar")
@admin_required
def admin_cancelar(cita_id):
    """Cancelar cita como admin (sin restricción de 24 h)."""
    ok, error = cancelar_cita(cita_id=cita_id, afiliado_id=0, es_admin=True)
    if not ok:
        return jsonify({"error": error}), 422
    cita = Cita.query.get(cita_id)
    if cita:
        emit_event("cita_actualizada", cita.to_dict())
    return jsonify({"message": "Cita cancelada exitosamente"}), 200
