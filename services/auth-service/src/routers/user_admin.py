"""
User Admin Router — CRUD of user credentials (admin only).
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session

from src.config.database import get_db
from src.repositories.credential_repository import CredentialRepository
from src.services.token_service import verify_token

router = APIRouter(tags=["User Admin"])
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


@router.get("/api/admin/users")
def listar(_: dict = Depends(require_admin), db: Session = Depends(get_db)):
    repo = CredentialRepository(db)
    return [c.to_dict() for c in repo.list_all()]


@router.put("/api/admin/users/{cred_id}")
def actualizar(
    cred_id: int,
    body: dict,
    _: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    repo = CredentialRepository(db)
    cred = repo.find_by_id(cred_id)
    if not cred:
        raise HTTPException(status_code=404, detail="Credencial no encontrada")
    allowed = {"activo", "correo"}
    for field in allowed:
        if field in body:
            setattr(cred, field, body[field])
    repo.commit()
    return cred.to_dict()
