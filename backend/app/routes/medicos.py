"""
Médicos y jornadas laborales.

Público/afiliado:
  GET /api/medicos?especialidad_id=&activo=true
  GET /api/medicos/<id>

Admin:
  POST   /api/admin/medicos
  PUT    /api/admin/medicos/<id>
  DELETE /api/admin/medicos/<id>
  POST   /api/admin/medicos/<id>/jornadas        → reemplaza jornadas
  POST   /api/admin/medicos/<id>/generar-horarios → genera slots en rango de fechas
"""

from datetime import date
from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.medico import Medico, JornadaMedico
from app.models.especialidad import Especialidad
from app.models.sede import Sede
from app.services.horario_service import generar_horarios_medico
from app.utils.decorators import admin_required

medicos_bp = Blueprint("medicos", __name__)


@medicos_bp.get("/api/medicos")
def listar():
    """
    Listar médicos
    ---
    tags:
      - Médicos
    parameters:
      - name: especialidad_id
        in: query
        type: integer
      - name: activo
        in: query
        type: boolean
        default: true
    responses:
      200:
        description: Lista de médicos
        schema:
          type: array
          items:
            $ref: '#/definitions/Medico'
    definitions:
      Medico:
        type: object
        properties:
          id:
            type: integer
          nombre:
            type: string
          especialidad_id:
            type: integer
          sede_id:
            type: integer
          activo:
            type: boolean
    """
    query = Medico.query
    esp_id = request.args.get("especialidad_id", type=int)
    if esp_id:
        query = query.filter_by(especialidad_id=esp_id)
    solo_activos = request.args.get("activo", "true").lower() != "false"
    if solo_activos:
        query = query.filter_by(activo=True)
    medicos = query.order_by(Medico.nombre).all()
    return jsonify([m.to_dict() for m in medicos]), 200


@medicos_bp.get("/api/medicos/<int:medico_id>")
def obtener(medico_id):
    """
    Obtener médico por ID (incluye jornadas)
    ---
    tags:
      - Médicos
    parameters:
      - name: medico_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Médico con jornadas
        schema:
          $ref: '#/definitions/Medico'
      404:
        description: No encontrado
    """
    medico = Medico.query.get_or_404(medico_id)
    return jsonify(medico.to_dict(include_jornadas=True)), 200


@medicos_bp.post("/api/admin/medicos")
@admin_required
def crear():
    """
    Crear médico
    ---
    tags:
      - Médicos
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [nombre, especialidad_id, sede_id]
          properties:
            nombre:
              type: string
              example: Dr. Juan Pérez
            especialidad_id:
              type: integer
            sede_id:
              type: integer
            activo:
              type: boolean
              default: true
    responses:
      201:
        description: Médico creado
        schema:
          $ref: '#/definitions/Medico'
      400:
        description: Campos requeridos faltantes
      404:
        description: Especialidad o sede no encontrada
    """
    data = request.get_json(silent=True) or {}
    nombre = data.get("nombre", "").strip()
    esp_id = data.get("especialidad_id")
    sede_id = data.get("sede_id")

    if not nombre or not esp_id or not sede_id:
        return jsonify({"error": "nombre, especialidad_id y sede_id son requeridos"}), 400

    Especialidad.query.get_or_404(esp_id)
    Sede.query.get_or_404(sede_id)

    medico = Medico(
        nombre=nombre,
        especialidad_id=esp_id,
        sede_id=sede_id,
        activo=data.get("activo", True),
    )
    db.session.add(medico)
    db.session.commit()
    return jsonify(medico.to_dict()), 201


@medicos_bp.put("/api/admin/medicos/<int:medico_id>")
@admin_required
def actualizar(medico_id):
    """
    Actualizar médico
    ---
    tags:
      - Médicos
    security:
      - Bearer: []
    parameters:
      - name: medico_id
        in: path
        type: integer
        required: true
      - in: body
        name: body
        schema:
          type: object
          properties:
            nombre:
              type: string
            especialidad_id:
              type: integer
            sede_id:
              type: integer
            activo:
              type: boolean
    responses:
      200:
        description: Médico actualizado
        schema:
          $ref: '#/definitions/Medico'
      404:
        description: No encontrado
    """
    medico = Medico.query.get_or_404(medico_id)
    data = request.get_json(silent=True) or {}

    if "nombre" in data:
        medico.nombre = data["nombre"].strip()
    if "especialidad_id" in data:
        Especialidad.query.get_or_404(data["especialidad_id"])
        medico.especialidad_id = data["especialidad_id"]
    if "sede_id" in data:
        Sede.query.get_or_404(data["sede_id"])
        medico.sede_id = data["sede_id"]
    if "activo" in data:
        medico.activo = bool(data["activo"])

    db.session.commit()
    return jsonify(medico.to_dict()), 200


@medicos_bp.delete("/api/admin/medicos/<int:medico_id>")
@admin_required
def eliminar(medico_id):
    """
    Desactivar médico
    ---
    tags:
      - Médicos
    security:
      - Bearer: []
    parameters:
      - name: medico_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Médico desactivado
      404:
        description: No encontrado
    """
    medico = Medico.query.get_or_404(medico_id)
    medico.activo = False
    db.session.commit()
    return jsonify({"message": "Médico desactivado"}), 200


@medicos_bp.post("/api/admin/medicos/<int:medico_id>/jornadas")
@admin_required
def set_jornadas(medico_id):
    """
    Reemplazar jornadas del médico
    ---
    tags:
      - Médicos
    security:
      - Bearer: []
    parameters:
      - name: medico_id
        in: path
        type: integer
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: array
          items:
            type: object
            required: [dia_semana, hora_inicio, hora_fin]
            properties:
              dia_semana:
                type: integer
                description: "0=lunes … 6=domingo"
                example: 0
              hora_inicio:
                type: string
                example: "08:00"
              hora_fin:
                type: string
                example: "17:00"
    responses:
      200:
        description: Médico con jornadas actualizadas
        schema:
          $ref: '#/definitions/Medico'
      400:
        description: Formato inválido
      404:
        description: Médico no encontrado
    """
    medico = Medico.query.get_or_404(medico_id)
    data = request.get_json(silent=True) or []

    if not isinstance(data, list):
        return jsonify({"error": "Se esperaba una lista de jornadas"}), 400

    JornadaMedico.query.filter_by(medico_id=medico_id).delete()

    for item in data:
        from datetime import time as dtime
        try:
            hi = dtime.fromisoformat(item["hora_inicio"])
            hf = dtime.fromisoformat(item["hora_fin"])
        except (KeyError, ValueError):
            db.session.rollback()
            return jsonify({"error": "Formato inválido. Use HH:MM en hora_inicio y hora_fin"}), 400

        jornada = JornadaMedico(
            medico_id=medico_id,
            dia_semana=int(item["dia_semana"]),
            hora_inicio=hi,
            hora_fin=hf,
        )
        db.session.add(jornada)

    db.session.commit()
    return jsonify(medico.to_dict(include_jornadas=True)), 200


@medicos_bp.post("/api/admin/medicos/<int:medico_id>/generar-horarios")
@admin_required
def generar_horarios(medico_id):
    """
    Generar slots de horario para un médico
    ---
    tags:
      - Médicos
    security:
      - Bearer: []
    parameters:
      - name: medico_id
        in: path
        type: integer
        required: true
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
    responses:
      200:
        description: Resultado de generación de slots
      400:
        description: Fechas inválidas o faltantes
      404:
        description: Médico no encontrado o sin jornadas
    """
    data = request.get_json(silent=True) or {}
    try:
        fi = date.fromisoformat(data["fecha_inicio"])
        ff = date.fromisoformat(data["fecha_fin"])
    except (KeyError, ValueError):
        return jsonify({"error": "fecha_inicio y fecha_fin requeridas (YYYY-MM-DD)"}), 400

    if ff < fi:
        return jsonify({"error": "fecha_fin debe ser mayor o igual a fecha_inicio"}), 400

    resultado = generar_horarios_medico(medico_id, fi, ff)
    if "error" in resultado:
        return jsonify(resultado), 404

    return jsonify(resultado), 200
