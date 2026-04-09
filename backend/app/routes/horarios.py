"""
Horarios disponibles para agendar.

  GET  /api/horarios?medico_id=&fecha=YYYY-MM-DD → slots disponibles (afiliado)
  GET  /api/admin/horarios?medico_id=&fecha=     → todos los slots (admin)
  POST /api/admin/horarios/generar               → genera para todos los médicos en rango
  DELETE /api/admin/horarios/<id>                → eliminar slot
  GET  /api/admin/dias-no-habiles
  POST /api/admin/dias-no-habiles
  DELETE /api/admin/dias-no-habiles/<id>
"""

from datetime import date
from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.horario import Horario
from app.models.medico import Medico
from app.models.dia_no_habil import DiaNoHabil
from app.services.horario_service import generar_horarios_medico, get_horarios_disponibles
from app.utils.decorators import admin_required, afiliado_required

horarios_bp = Blueprint("horarios", __name__)


@horarios_bp.get("/api/horarios")
@afiliado_required
def listar_disponibles():
    """
    Slots disponibles de un médico en una fecha
    ---
    tags:
      - Horarios
    security:
      - Bearer: []
    parameters:
      - name: medico_id
        in: query
        type: integer
        required: true
      - name: fecha
        in: query
        type: string
        format: date
        required: true
        example: "2026-05-10"
    responses:
      200:
        description: Lista de slots disponibles
        schema:
          type: array
          items:
            $ref: '#/definitions/Horario'
      400:
        description: Parámetros requeridos faltantes o fecha inválida
    definitions:
      Horario:
        type: object
        properties:
          id:
            type: integer
          medico_id:
            type: integer
          fecha:
            type: string
            format: date
          hora_inicio:
            type: string
          hora_fin:
            type: string
          estado:
            type: string
            enum: [disponible, ocupado]
    """
    medico_id = request.args.get("medico_id", type=int)
    fecha_str = request.args.get("fecha")

    if not medico_id or not fecha_str:
        return jsonify({"error": "medico_id y fecha son requeridos"}), 400

    try:
        fecha = date.fromisoformat(fecha_str)
    except ValueError:
        return jsonify({"error": "Formato de fecha inválido (YYYY-MM-DD)"}), 400

    horarios = get_horarios_disponibles(medico_id, fecha)
    return jsonify([h.to_dict() for h in horarios]), 200


@horarios_bp.get("/api/admin/horarios")
@admin_required
def listar_admin():
    """
    Listar todos los slots (admin)
    ---
    tags:
      - Horarios
    security:
      - Bearer: []
    parameters:
      - name: medico_id
        in: query
        type: integer
      - name: fecha
        in: query
        type: string
        format: date
      - name: estado
        in: query
        type: string
        enum: [disponible, ocupado]
    responses:
      200:
        description: Lista de horarios
        schema:
          type: array
          items:
            $ref: '#/definitions/Horario'
    """
    query = Horario.query
    medico_id = request.args.get("medico_id", type=int)
    fecha_str = request.args.get("fecha")
    estado = request.args.get("estado")

    if medico_id:
        query = query.filter_by(medico_id=medico_id)
    if fecha_str:
        try:
            query = query.filter_by(fecha=date.fromisoformat(fecha_str))
        except ValueError:
            return jsonify({"error": "Formato de fecha inválido"}), 400
    if estado:
        query = query.filter_by(estado=estado)

    horarios = query.order_by(Horario.fecha, Horario.hora_inicio).all()
    return jsonify([h.to_dict() for h in horarios]), 200


@horarios_bp.post("/api/admin/horarios/generar")
@admin_required
def generar_todos():
    """
    Generar horarios para todos los médicos activos en un rango
    ---
    tags:
      - Horarios
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [fecha_inicio, fecha_fin]
          properties:
            fecha_inicio:
              type: string
              format: date
              example: "2026-05-01"
            fecha_fin:
              type: string
              format: date
              example: "2026-05-31"
            medicos_ids:
              type: array
              items:
                type: integer
              description: Opcional. Si se omite, genera para todos los médicos activos.
    responses:
      200:
        description: Resultado por médico
        schema:
          type: array
          items:
            type: object
    """
    data = request.get_json(silent=True) or {}
    try:
        fi = date.fromisoformat(data["fecha_inicio"])
        ff = date.fromisoformat(data["fecha_fin"])
    except (KeyError, ValueError):
        return jsonify({"error": "fecha_inicio y fecha_fin requeridas (YYYY-MM-DD)"}), 400

    medicos_ids = data.get("medicos_ids")
    if medicos_ids:
        medicos = Medico.query.filter(Medico.id.in_(medicos_ids), Medico.activo == True).all()
    else:
        medicos = Medico.query.filter_by(activo=True).all()

    resultados = []
    for medico in medicos:
        res = generar_horarios_medico(medico.id, fi, ff)
        res["medico_id"] = medico.id
        res["medico_nombre"] = medico.nombre
        resultados.append(res)

    return jsonify(resultados), 200


@horarios_bp.delete("/api/admin/horarios/<int:horario_id>")
@admin_required
def eliminar(horario_id):
    """
    Eliminar slot de horario
    ---
    tags:
      - Horarios
    security:
      - Bearer: []
    parameters:
      - name: horario_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Horario eliminado
      404:
        description: No encontrado
      409:
        description: Horario ocupado, no se puede eliminar
    """
    horario = Horario.query.get_or_404(horario_id)
    if horario.estado == "ocupado":
        return jsonify({"error": "No se puede eliminar un horario ocupado"}), 409
    db.session.delete(horario)
    db.session.commit()
    return jsonify({"message": "Horario eliminado"}), 200


@horarios_bp.get("/api/admin/dias-no-habiles")
@admin_required
def listar_dias_no_habiles():
    """
    Listar días no hábiles
    ---
    tags:
      - Horarios
    security:
      - Bearer: []
    responses:
      200:
        description: Lista de días no hábiles
        schema:
          type: array
          items:
            $ref: '#/definitions/DiaNoHabil'
    definitions:
      DiaNoHabil:
        type: object
        properties:
          id:
            type: integer
          fecha:
            type: string
            format: date
          descripcion:
            type: string
    """
    dias = DiaNoHabil.query.order_by(DiaNoHabil.fecha).all()
    return jsonify([d.to_dict() for d in dias]), 200


@horarios_bp.post("/api/admin/dias-no-habiles")
@admin_required
def crear_dia_no_habil():
    """
    Registrar día no hábil
    ---
    tags:
      - Horarios
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [fecha]
          properties:
            fecha:
              type: string
              format: date
              example: "2026-12-25"
            descripcion:
              type: string
              example: Navidad
    responses:
      201:
        description: Día no hábil registrado
        schema:
          $ref: '#/definitions/DiaNoHabil'
      400:
        description: Fecha inválida
      409:
        description: Ya existe
    """
    data = request.get_json(silent=True) or {}
    try:
        fecha = date.fromisoformat(data["fecha"])
    except (KeyError, ValueError):
        return jsonify({"error": "fecha requerida (YYYY-MM-DD)"}), 400

    if DiaNoHabil.query.filter_by(fecha=fecha).first():
        return jsonify({"error": "Ya existe ese día no hábil"}), 409

    dia = DiaNoHabil(fecha=fecha, descripcion=data.get("descripcion"))
    db.session.add(dia)
    db.session.commit()
    return jsonify(dia.to_dict()), 201


@horarios_bp.delete("/api/admin/dias-no-habiles/<int:dia_id>")
@admin_required
def eliminar_dia_no_habil(dia_id):
    """
    Eliminar día no hábil
    ---
    tags:
      - Horarios
    security:
      - Bearer: []
    parameters:
      - name: dia_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Día no hábil eliminado
      404:
        description: No encontrado
    """
    dia = DiaNoHabil.query.get_or_404(dia_id)
    db.session.delete(dia)
    db.session.commit()
    return jsonify({"message": "Día no hábil eliminado"}), 200
