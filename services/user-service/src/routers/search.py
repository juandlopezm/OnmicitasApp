"""
Search Router — admin list and detail endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session

from src.config.database import get_db
from src.repositories.afiliado_repository import AfiliadoRepository
from src.services.afiliado_service import AfiliadoService
from src.services.token_service import verify_token

router = APIRouter(tags=["Admin — Búsqueda"])
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


@router.get("/api/admin/afiliados")
def listar(
    tipo: str | None = Query(None),
    estado: str | None = Query(None),
    _: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return AfiliadoService(AfiliadoRepository(db)).listar(tipo=tipo, estado=estado)


@router.get("/api/admin/afiliados/{afiliado_id}")
def detalle(
    afiliado_id: int,
    _: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return AfiliadoService(AfiliadoRepository(db)).obtener(
        afiliado_id, include_beneficiarios=True
    )


@router.put("/api/admin/afiliados/{afiliado_id}")
def actualizar(
    afiliado_id: int,
    body: dict,
    _: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return AfiliadoService(AfiliadoRepository(db)).actualizar(afiliado_id, body)
