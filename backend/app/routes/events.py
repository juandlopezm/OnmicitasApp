"""
Endpoint SSE para sincronización en tiempo real.

GET /api/events  →  text/event-stream
Requiere JWT válido (afiliado o admin).
"""

from flask import Blueprint, Response, stream_with_context
from flask_jwt_extended import verify_jwt_in_request
from app.services.event_service import subscribe, unsubscribe

events_bp = Blueprint("events", __name__)


@events_bp.get("/api/events")
def stream():
    try:
        verify_jwt_in_request()
    except Exception:
        return {"error": "Token requerido"}, 401

    q = subscribe()

    def generate():
        # Evento inicial para confirmar conexión
        yield 'data: {"type":"connected"}\n\n'
        try:
            while True:
                try:
                    payload = q.get(timeout=25)
                    yield f"data: {payload}\n\n"
                except Exception:
                    # Timeout → heartbeat para mantener la conexión viva
                    yield ": heartbeat\n\n"
        finally:
            unsubscribe(q)

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # Desactiva buffer en Nginx
            "Connection": "keep-alive",
        },
    )
