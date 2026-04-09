from functools import wraps
from flask import jsonify, request, g, current_app
from flask_jwt_extended import get_jwt, verify_jwt_in_request


def afiliado_required(fn):
    """Requiere token JWT de afiliado cotizante activo."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        claims = get_jwt()
        if claims.get("role") != "afiliado":
            return jsonify({"error": "Acceso restringido a afiliados"}), 403
        return fn(*args, **kwargs)
    return wrapper


def admin_required(fn):
    """Requiere token JWT de administrador."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        claims = get_jwt()
        if claims.get("role") != "admin":
            return jsonify({"error": "Acceso restringido a administradores"}), 403
        return fn(*args, **kwargs)
    return wrapper


def canal_required(fn):
    """
    Requiere API key de canal externo (WhatsApp bot, app móvil, etc.).

    Headers obligatorios:
        X-Canal-Key     → clave secreta compartida (CANAL_API_KEY en .env)
        X-Canal-Nombre  → identificador del canal: whatsapp | app_movil | telefono
                          (opcional; default: 'externo')

    Uso:
        @canal_bp.post("/api/canal/citas")
        @canal_required
        def agendar_desde_bot():
            canal = g.canal_nombre   # "whatsapp", "app_movil", etc.
            ...
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        api_key = request.headers.get("X-Canal-Key", "")
        clave_valida = current_app.config.get("CANAL_API_KEY", "")

        if not api_key or api_key != clave_valida:
            return jsonify({"error": "API key inválida o ausente. Header: X-Canal-Key"}), 401

        canal_nombre = request.headers.get("X-Canal-Nombre", "externo").lower()
        canales_validos = {"whatsapp", "app_movil", "telefono", "externo"}
        if canal_nombre not in canales_validos:
            canal_nombre = "externo"

        g.canal_nombre = canal_nombre
        return fn(*args, **kwargs)
    return wrapper
