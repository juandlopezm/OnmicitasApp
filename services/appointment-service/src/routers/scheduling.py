"""Afiliado — schedule new appointment."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session

from src.config.database import get_db
from src.services.token_service import verify_token
from src.services.scheduling_service import SchedulingService

router = APIRouter(tags=["Agendamiento"])
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


@router.post("/api/citas", status_code=201)
def agendar(
    body: dict,
    payload: dict = Depends(require_afiliado),
    db: Session = Depends(get_db),
):
    return SchedulingService(db).agendar(int(payload["sub"]), body)
