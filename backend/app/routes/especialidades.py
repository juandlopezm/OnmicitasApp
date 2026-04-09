"""
Especialidades (CRUD admin + listado público).
  GET    /api/especialidades         → lista (afiliado/público)
  GET    /api/especialidades/<id>
  POST   /api/admin/especialidades   → crear (admin)
  PUT    /api/admin/especialidades/<id>
  DELETE /api/admin/especialidades/<id>
"""

from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.especialidad import Especialidad
from app.utils.decorators import admin_required

esp_bp = Blueprint("especialidades", __name__)


@esp_bp.get("/api/especialidades")
def listar():
    """
    Listar especialidades activas
    ---
    tags:
      - Especialidades
    responses:
      200:
        description: Lista de especialidades
        schema:
          type: array
          items:
            $ref: '#/definitions/Especialidad'
    definitions:
      Especialidad:
        type: object
        properties:
          id:
            type: integer
          nombre:
            type: string
          descripcion:
            type: string
          duracion_minutos:
            type: integer
          activo:
            type: boolean
    """
    especialidades = Especialidad.query.filter_by(activo=True).order_by(Especialidad.nombre).all()
    return jsonify([e.to_dict() for e in especialidades]), 200


@esp_bp.get("/api/especialidades/<int:esp_id>")
def obtener(esp_id):
    """
    Obtener especialidad por ID
    ---
    tags:
      - Especialidades
    parameters:
      - name: esp_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Especialidad encontrada
        schema:
          $ref: '#/definitions/Especialidad'
      404:
        description: No encontrada
    """
    esp = Especialidad.query.get_or_404(esp_id)
    return jsonify(esp.to_dict()), 200


@esp_bp.post("/api/admin/especialidades")
@admin_required
def crear():
    """
    Crear especialidad
    ---
    tags:
      - Especialidades
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [nombre]
          properties:
            nombre:
              type: string
              example: Cardiología
            descripcion:
              type: string
            duracion_minutos:
              type: integer
              default: 30
            activo:
              type: boolean
              default: true
    responses:
      201:
        description: Especialidad creada
        schema:
          $ref: '#/definitions/Especialidad'
      400:
        description: Nombre requerido
    """
    data = request.get_json(silent=True) or {}
    nombre = data.get("nombre", "").strip()
    if not nombre:
        return jsonify({"error": "El nombre es requerido"}), 400

    esp = Especialidad(
        nombre=nombre,
        descripcion=data.get("descripcion"),
        duracion_minutos=int(data.get("duracion_minutos", 30)),
        activo=data.get("activo", True),
    )
    db.session.add(esp)
    db.session.commit()
    return jsonify(esp.to_dict()), 201


@esp_bp.put("/api/admin/especialidades/<int:esp_id>")
@admin_required
def actualizar(esp_id):
    """
    Actualizar especialidad
    ---
    tags:
      - Especialidades
    security:
      - Bearer: []
    parameters:
      - name: esp_id
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
            descripcion:
              type: string
            duracion_minutos:
              type: integer
            activo:
              type: boolean
    responses:
      200:
        description: Especialidad actualizada
        schema:
          $ref: '#/definitions/Especialidad'
      404:
        description: No encontrada
    """
    esp = Especialidad.query.get_or_404(esp_id)
    data = request.get_json(silent=True) or {}

    if "nombre" in data:
        esp.nombre = data["nombre"].strip()
    if "descripcion" in data:
        esp.descripcion = data["descripcion"]
    if "duracion_minutos" in data:
        esp.duracion_minutos = int(data["duracion_minutos"])
    if "activo" in data:
        esp.activo = bool(data["activo"])

    db.session.commit()
    return jsonify(esp.to_dict()), 200


@esp_bp.delete("/api/admin/especialidades/<int:esp_id>")
@admin_required
def eliminar(esp_id):
    """
    Desactivar especialidad
    ---
    tags:
      - Especialidades
    security:
      - Bearer: []
    parameters:
      - name: esp_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Especialidad desactivada
      404:
        description: No encontrada
    """
    esp = Especialidad.query.get_or_404(esp_id)
    esp.activo = False
    db.session.commit()
    return jsonify({"message": "Especialidad desactivada"}), 200
