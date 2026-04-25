"""
UserClient — HTTP connector to user-service internal endpoint.
Circuit Breaker wraps the raw HTTP call to handle user-service failures gracefully.
"""

import httpx
import pybreaker
from src.config.settings import settings
from src.resilience.circuit_breakers import USER_SERVICE_CB


@USER_SERVICE_CB
def _fetch_user(user_id: int) -> dict:
    r = httpx.get(
        f"{settings.USER_SERVICE_URL}/internal/users/{user_id}",
        timeout=5.0,
    )
    r.raise_for_status()
    return r.json()


@USER_SERVICE_CB
def _fetch_user_by_documento(tipo: str, numero: str) -> dict | None:
    r = httpx.get(
        f"{settings.USER_SERVICE_URL}/internal/users/by-documento",
        params={"tipo_documento": tipo, "numero_documento": numero},
        timeout=5.0,
    )
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return r.json()


def get_user(user_id: int) -> dict | None:
    try:
        return _fetch_user(user_id)
    except pybreaker.CircuitBreakerError:
        return None
    except httpx.RequestError:
        return None
    except httpx.HTTPStatusError:
        return None


def get_user_by_documento(tipo: str, numero: str) -> dict | None:
    try:
        return _fetch_user_by_documento(tipo, numero)
    except pybreaker.CircuitBreakerError:
        return None
    except (httpx.RequestError, httpx.HTTPStatusError):
        return None
