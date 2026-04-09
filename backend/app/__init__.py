import os
from flask import Flask, jsonify
from flasgger import Swagger
from app.config import config_by_name
from app.extensions import db, jwt, cors

SWAGGER_CONFIG = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec",
            "route": "/apispec.json",
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/apidocs",
}

SWAGGER_TEMPLATE = {
    "swagger": "2.0",
    "info": {
        "title": "OmniCitas API",
        "description": "API REST del sistema omnicanal de citas médicas.",
        "version": "1.0.0",
        "contact": {"email": "admin@omnicitas.com"},
    },
    "basePath": "/",
    "schemes": ["http", "https"],
    "securityDefinitions": {
        "Bearer": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
            "description": "JWT. Formato: **Bearer &lt;token&gt;**",
        }
    },
    "tags": [
        {"name": "Auth", "description": "Autenticación de afiliados"},
        {"name": "Admin Auth", "description": "Autenticación de administradores"},
        {"name": "Afiliados", "description": "Gestión de afiliados (admin)"},
        {"name": "Especialidades", "description": "Catálogo de especialidades"},
        {"name": "Sedes", "description": "Catálogo de sedes"},
        {"name": "Médicos", "description": "Gestión de médicos y jornadas"},
        {"name": "Horarios", "description": "Slots de atención y días no hábiles"},
        {"name": "Citas", "description": "Agendamiento y gestión de citas"},
    ],
}


def create_app(config_name: str | None = None) -> Flask:
    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "development")

    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])

    # Extensiones
    db.init_app(app)
    jwt.init_app(app)
    Swagger(app, config=SWAGGER_CONFIG, template=SWAGGER_TEMPLATE)
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=True,
    )

    # Blueprints
    from app.routes import all_blueprints
    for bp in all_blueprints:
        app.register_blueprint(bp)

    # Manejadores de error globales
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Recurso no encontrado"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Método no permitido"}), 405

    @app.errorhandler(500)
    def internal_error(e):
        db.session.rollback()
        return jsonify({"error": "Error interno del servidor"}), 500

    # Respuesta JWT expirado
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({"error": "Token expirado. Inicie sesión nuevamente"}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({"error": "Token inválido"}), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({"error": "Token de autenticación requerido"}), 401

    # Health check
    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "OmniCitas API"}), 200

    return app
