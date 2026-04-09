"""
Autenticación de administradores:
  POST /api/admin/auth/login → login admin
  GET  /api/admin/auth/me   → perfil admin
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, get_jwt_identity
from app.models.admin_usuario import AdminUsuario
from app.utils.decorators import admin_required

admin_auth_bp = Blueprint("admin_auth", __name__, url_prefix="/api/admin/auth")


@admin_auth_bp.post("/login")
def login():
    """
    Login de administrador
    ---
    tags:
      - Admin Auth
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [email, password]
          properties:
            email:
              type: string
              format: email
              example: admin@omnicitas.com
            password:
              type: string
              example: admin123
    responses:
      200:
        description: Login exitoso
        schema:
          type: object
          properties:
            token:
              type: string
            admin:
              $ref: '#/definitions/Admin'
      400:
        description: Campos requeridos faltantes
      401:
        description: Credenciales inválidas
    definitions:
      Admin:
        type: object
        properties:
          id:
            type: integer
          nombre:
            type: string
          email:
            type: string
    """
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email y contraseña son requeridos"}), 400

    admin = AdminUsuario.query.filter_by(email=email).first()
    if not admin or not admin.check_password(password):
        return jsonify({"error": "Credenciales inválidas"}), 401

    token = create_access_token(
        identity=str(admin.id),
        additional_claims={"role": "admin"},
    )
    return jsonify({"token": token, "admin": admin.to_dict()}), 200


@admin_auth_bp.get("/me")
@admin_required
def me():
    """
    Perfil del administrador autenticado
    ---
    tags:
      - Admin Auth
    security:
      - Bearer: []
    responses:
      200:
        description: Perfil del admin
        schema:
          $ref: '#/definitions/Admin'
      401:
        description: Token inválido o expirado
    """
    admin_id = int(get_jwt_identity())
    admin = AdminUsuario.query.get_or_404(admin_id)
    return jsonify(admin.to_dict()), 200
