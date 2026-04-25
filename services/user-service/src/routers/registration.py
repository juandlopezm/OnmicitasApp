"""
Registration Router — admin creates and manages afiliado profiles.
All endpoints require admin JWT (validated by Kong + role check).
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session

from src.config.database import get_db
from src.repositories.afiliado_repository import AfiliadoRepository
from src.services.afiliado_service import AfiliadoService
from src.services.token_service import verify_token

router = APIRouter(tags=["Admin — Registro"])
_bearer = HTTPBearer()


def require_admin(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    try:
        payload = verify_token(credentials.credentials)
    except JWTError as exc:
        detail = "Token expirado" if "expired" in str(exc) else "Token inválido"
        raise HTTPException(status_code=401, detail=detail)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acceso restringido a administradores")
    return payload


@router.post("/api/admin/afiliados", status_code=201)
def crear(
    body: dict,
    _: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return AfiliadoService(AfiliadoRepository(db)).crear(body)


@router.delete("/api/admin/afiliados/{afiliado_id}")
def eliminar(
    afiliado_id: int,
    _: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return AfiliadoService(AfiliadoRepository(db)).eliminar(afiliado_id)
