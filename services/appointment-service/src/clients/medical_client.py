"""
MedicalClient — HTTP connector to medical-service internal endpoints.
Circuit Breaker wraps all raw HTTP calls.
"""

import httpx
import pybreaker
from src.config.settings import settings
from src.resilience.circuit_breakers import MEDICAL_SERVICE_CB


@MEDICAL_SERVICE_CB
def _ocupar_raw(horario_id: int) -> dict:
    r = httpx.patch(
        f"{settings.MEDICAL_SERVICE_URL}/internal/horarios/{horario_id}/ocupar",
        timeout=5.0,
    )
    r.raise_for_status()
    return r.json()


@MEDICAL_SERVICE_CB
def _liberar_raw(horario_id: int) -> dict:
    r = httpx.patch(
        f"{settings.MEDICAL_SERVICE_URL}/internal/horarios/{horario_id}/liberar",
        timeout=5.0,
    )
    r.raise_for_status()
    return r.json()


@MEDICAL_SERVICE_CB
def _get_horario_raw(horario_id: int) -> dict:
    r = httpx.get(
        f"{settings.MEDICAL_SERVICE_URL}/internal/horarios/{horario_id}",
        timeout=5.0,
    )
    r.raise_for_status()
    return r.json()


def ocupar_horario(horario_id: int) -> tuple[dict | None, str | None]:
    try:
        return _ocupar_raw(horario_id), None
    except pybreaker.CircuitBreakerError:
        return None, "Servicio médico en mantenimiento. Por favor intente más tarde."
    except httpx.HTTPStatusError as e:
        detail = e.response.json().get("detail", str(e)) if e.response.content else str(e)
        return None, f"Horario no disponible: {detail}"
    except httpx.RequestError:
        return None, "No se pudo conectar con el servicio médico."


def liberar_horario(horario_id: int) -> None:
    """Best-effort release — log on failure, don't raise."""
    try:
        _liberar_raw(horario_id)
    except Exception:
        import logging
        logging.getLogger(__name__).warning(
            f"[Saga] No se pudo liberar horario {horario_id} — compensación fallida"
        )


def get_horario(horario_id: int) -> dict | None:
    try:
        return _get_horario_raw(horario_id)
    except pybreaker.CircuitBreakerError:
        return None
    except (httpx.RequestError, httpx.HTTPStatusError):
        return None
