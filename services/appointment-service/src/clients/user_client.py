"""
UserClient — HTTP connector to user-service internal endpoint.
Circuit Breaker wraps raw HTTP call.
"""

import httpx
import pybreaker
from src.config.settings import settings
from src.resilience.circuit_breakers import USER_SERVICE_CB


@USER_SERVICE_CB
def _fetch_user_raw(user_id: int) -> dict:
    r = httpx.get(
        f"{settings.USER_SERVICE_URL}/internal/users/{user_id}",
        timeout=5.0,
    )
    r.raise_for_status()
    return r.json()


def get_user(user_id: int) -> tuple[dict | None, str | None]:
    try:
        return _fetch_user_raw(user_id), None
    except pybreaker.CircuitBreakerError:
        return None, "No se pudo verificar el afiliado. Servicio de usuarios no disponible."
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return None, "Afiliado no encontrado."
        return None, "Error al verificar el afiliado."
    except httpx.RequestError:
        return None, "No se pudo conectar con el servicio de usuarios."
