"""
Sedes (CRUD admin + listado público).
"""

from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.sede import Sede
from app.utils.decorators import admin_required

sedes_bp = Blueprint("sedes", __name__)


@sedes_bp.get("/api/sedes")
def listar():
    """
    Listar sedes activas
    ---
    tags:
      - Sedes
    responses:
      200:
        description: Lista de sedes
        schema:
          type: array
          items:
            $ref: '#/definitions/Sede'
    definitions:
      Sede:
        type: object
        properties:
          id:
            type: integer
          nombre:
            type: string
          direccion:
            type: string
          activo:
            type: boolean
    """
    sedes = Sede.query.filter_by(activo=True).order_by(Sede.nombre).all()
    return jsonify([s.to_dict() for s in sedes]), 200


@sedes_bp.get("/api/sedes/<int:sede_id>")
def obtener(sede_id):
    """
    Obtener sede por ID
    ---
    tags:
      - Sedes
    parameters:
      - name: sede_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Sede encontrada
        schema:
          $ref: '#/definitions/Sede'
      404:
        description: No encontrada
    """
    sede = Sede.query.get_or_404(sede_id)
    return jsonify(sede.to_dict()), 200


@sedes_bp.post("/api/admin/sedes")
@admin_required
def crear():
    """
    Crear sede
    ---
    tags:
      - Sedes
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [nombre, direccion]
          properties:
            nombre:
              type: string
              example: Sede Norte
            direccion:
              type: string
              example: Cra 15 # 80-20
            activo:
              type: boolean
              default: true
    responses:
      201:
        description: Sede creada
        schema:
          $ref: '#/definitions/Sede'
      400:
        description: Nombre y dirección requeridos
    """
    data = request.get_json(silent=True) or {}
    nombre = data.get("nombre", "").strip()
    direccion = data.get("direccion", "").strip()
    if not nombre or not direccion:
        return jsonify({"error": "Nombre y dirección son requeridos"}), 400

    sede = Sede(nombre=nombre, direccion=direccion, activo=data.get("activo", True))
    db.session.add(sede)
    db.session.commit()
    return jsonify(sede.to_dict()), 201


@sedes_bp.put("/api/admin/sedes/<int:sede_id>")
@admin_required
def actualizar(sede_id):
    """
    Actualizar sede
    ---
    tags:
      - Sedes
    security:
      - Bearer: []
    parameters:
      - name: sede_id
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
            direccion:
              type: string
            activo:
              type: boolean
    responses:
      200:
        description: Sede actualizada
        schema:
          $ref: '#/definitions/Sede'
      404:
        description: No encontrada
    """
    sede = Sede.query.get_or_404(sede_id)
    data = request.get_json(silent=True) or {}

    if "nombre" in data:
        sede.nombre = data["nombre"].strip()
    if "direccion" in data:
        sede.direccion = data["direccion"].strip()
    if "activo" in data:
        sede.activo = bool(data["activo"])

    db.session.commit()
    return jsonify(sede.to_dict()), 200


@sedes_bp.delete("/api/admin/sedes/<int:sede_id>")
@admin_required
def eliminar(sede_id):
    """
    Desactivar sede
    ---
    tags:
      - Sedes
    security:
      - Bearer: []
    parameters:
      - name: sede_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Sede desactivada
      404:
        description: No encontrada
    """
    sede = Sede.query.get_or_404(sede_id)
    sede.activo = False
    db.session.commit()
    return jsonify({"message": "Sede desactivada"}), 200
