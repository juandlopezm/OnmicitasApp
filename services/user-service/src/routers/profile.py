"""
Profile Router — afiliado reads and updates their own profile.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session

from src.config.database import get_db
from src.repositories.afiliado_repository import AfiliadoRepository
from src.services.afiliado_service import AfiliadoService
from src.services.token_service import verify_token

router = APIRouter(tags=["Perfil"])
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


@router.get("/api/users/me")
def me(payload: dict = Depends(require_afiliado), db: Session = Depends(get_db)):
    return AfiliadoService(AfiliadoRepository(db)).obtener(
        int(payload["sub"]), include_beneficiarios=True
    )


@router.put("/api/users/me")
def actualizar_perfil(
    body: dict,
    payload: dict = Depends(require_afiliado),
    db: Session = Depends(get_db),
):
    return AfiliadoService(AfiliadoRepository(db)).actualizar(int(payload["sub"]), body)
