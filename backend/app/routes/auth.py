"""
Autenticación de afiliados:
  POST /api/auth/login    → login con tipo_documento + numero_documento + contraseña
  POST /api/auth/register → activar cuenta (afiliado ya registrado por admin)
  GET  /api/auth/me       → perfil del afiliado autenticado
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.extensions import db
from app.models.afiliado import Afiliado
from app.utils.decorators import afiliado_required

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.post("/login")
def login():
    """
    Login de afiliado
    ---
    tags:
      - Auth
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [tipo_documento, numero_documento, password]
          properties:
            tipo_documento:
              type: string
              enum: [CC, TI, CE, PA]
              example: CC
            numero_documento:
              type: string
              example: "1234567890"
            password:
              type: string
              example: demo123
    responses:
      200:
        description: Login exitoso
        schema:
          type: object
          properties:
            token:
              type: string
            afiliado:
              $ref: '#/definitions/Afiliado'
      400:
        description: Campos requeridos faltantes
      401:
        description: Credenciales inválidas
      403:
        description: Cuenta inactiva o no es cotizante
    """
    data = request.get_json(silent=True) or {}
    tipo_doc = data.get("tipo_documento", "").strip().upper()
    numero_doc = data.get("numero_documento", "").strip()
    password = data.get("password", "")

    if not tipo_doc or not numero_doc or not password:
        return jsonify({"error": "Tipo de documento, número de documento y contraseña son requeridos"}), 400

    afiliado = Afiliado.query.filter_by(tipo_documento=tipo_doc, numero_documento=numero_doc).first()
    if not afiliado or not afiliado.check_password(password):
        return jsonify({"error": "Credenciales inválidas"}), 401

    if afiliado.tipo != "cotizante":
        return jsonify({"error": "Solo los cotizantes pueden iniciar sesión"}), 403

    if afiliado.estado != "activo":
        return jsonify({"error": f"Cuenta {afiliado.estado}. Contacte al administrador"}), 403

    token = create_access_token(
        identity=str(afiliado.id),
        additional_claims={"role": "afiliado", "tipo": afiliado.tipo},
    )
    return jsonify({"token": token, "afiliado": afiliado.to_dict()}), 200


@auth_bp.post("/register")
def register():
    """
    Activar cuenta de afiliado
    ---
    tags:
      - Auth
    description: >
      Activa la cuenta de un afiliado ya existente (creado por admin).
      Requiere numero_documento + tipo_documento + correo + password.
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [tipo_documento, numero_documento, correo, password]
          properties:
            tipo_documento:
              type: string
              enum: [CC, TI, CE, PA]
              example: CC
            numero_documento:
              type: string
              example: "1122334455"
            correo:
              type: string
              format: email
              example: nuevo@correo.com
            password:
              type: string
              minLength: 6
              example: mipass123
    responses:
      201:
        description: Cuenta activada
        schema:
          type: object
          properties:
            token:
              type: string
            afiliado:
              $ref: '#/definitions/Afiliado'
      400:
        description: Campos faltantes o contraseña muy corta
      403:
        description: Afiliado inactivo o no es cotizante
      404:
        description: Afiliado no encontrado
      409:
        description: Ya tiene cuenta activa o correo en uso
    """
    data = request.get_json(silent=True) or {}
    tipo_doc = data.get("tipo_documento", "").strip().upper()
    numero_doc = data.get("numero_documento", "").strip()
    correo = data.get("correo", "").strip().lower()
    password = data.get("password", "")

    if not all([tipo_doc, numero_doc, correo, password]):
        return jsonify({"error": "Todos los campos son requeridos"}), 400

    if len(password) < 6:
        return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400

    afiliado = Afiliado.query.filter_by(
        tipo_documento=tipo_doc, numero_documento=numero_doc
    ).first()

    if not afiliado:
        return jsonify({"error": "No se encontró un afiliado con ese documento. Contacte al administrador"}), 404

    if afiliado.tipo != "cotizante":
        return jsonify({"error": "Solo los cotizantes pueden crear una cuenta"}), 403

    if afiliado.estado != "activo":
        return jsonify({"error": "El afiliado no está activo"}), 403

    if afiliado.password_hash:
        return jsonify({"error": "Este afiliado ya tiene cuenta activa"}), 409

    correo_existente = Afiliado.query.filter_by(correo=correo).first()
    if correo_existente:
        return jsonify({"error": "Este correo ya está registrado"}), 409

    afiliado.correo = correo
    afiliado.set_password(password)
    db.session.commit()

    token = create_access_token(
        identity=str(afiliado.id),
        additional_claims={"role": "afiliado", "tipo": afiliado.tipo},
    )
    return jsonify({"token": token, "afiliado": afiliado.to_dict()}), 201


@auth_bp.get("/me")
@afiliado_required
def me():
    """
    Perfil del afiliado autenticado
    ---
    tags:
      - Auth
    security:
      - Bearer: []
    responses:
      200:
        description: Perfil del afiliado
        schema:
          $ref: '#/definitions/Afiliado'
      401:
        description: Token inválido o expirado
    definitions:
      Afiliado:
        type: object
        properties:
          id:
            type: integer
          tipo_documento:
            type: string
          numero_documento:
            type: string
          nombres:
            type: string
          apellidos:
            type: string
          correo:
            type: string
          tipo:
            type: string
            enum: [cotizante, beneficiario]
          estado:
            type: string
            enum: [activo, inactivo, suspendido]
    """
    afiliado_id = int(get_jwt_identity())
    afiliado = Afiliado.query.get_or_404(afiliado_id)
    afiliado.verificar_inactivacion_por_edad()
    db.session.commit()
    return jsonify(afiliado.to_dict(include_beneficiarios=True)), 200
