"""Afiliado — cancel and reschedule appointments."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session

from src.config.database import get_db
from src.services.token_service import verify_token
from src.services.scheduling_service import SchedulingService
from src.repositories.cita_repository import CitaRepository

router = APIRouter(tags=["Gestión de Citas"])
_bearer = HTTPBearer()


def require_afiliado(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    try:
        payload = verify_token(credentials.credentials)
    except JWTError as exc:
        detail = "Token expirado" if "expired" in str(exc) else "Token inválido"
        raise HTTPException(status_code=401, detail=detail)
    if payload.get("role") != "afiliado":
        raise HTTPException(status_code=403, detail="Acceso restringido a afiliados")
    return payload


@router.get("/api/citas/mis-citas")
def mis_citas(payload: dict = Depends(require_afiliado), db: Session = Depends(get_db)):
    return [c.to_dict() for c in CitaRepository(db).get_activas_afiliado(int(payload["sub"]))]


@router.get("/api/citas/historial")
def historial(payload: dict = Depends(require_afiliado), db: Session = Depends(get_db)):
    return [c.to_dict() for c in CitaRepository(db).get_historial_afiliado(int(payload["sub"]))]


@router.delete("/api/citas/{cita_id}/cancelar")
def cancelar(
    cita_id: int,
    payload: dict = Depends(require_afiliado),
    db: Session = Depends(get_db),
):
    return SchedulingService(db).cancelar(cita_id, afiliado_id=int(payload["sub"]))


@router.put("/api/citas/{cita_id}/reagendar")
def reagendar(
    cita_id: int,
    body: dict,
    payload: dict = Depends(require_afiliado),
    db: Session = Depends(get_db),
):
    return SchedulingService(db).reagendar(cita_id, body, afiliado_id=int(payload["sub"]))
