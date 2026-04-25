"""
Authentication Router — login, register.
Public endpoints: no JWT required (Kong routes without jwt plugin).
"""

from fastapi import APIRouter, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.config.database import get_db
from src.repositories.admin_repository import AdminRepository
from src.repositories.credential_repository import CredentialRepository
from src.services.auth_service import AdminAuthService, AfiliadoAuthService
from src.services.token_service import verify_token

router = APIRouter(tags=["Authentication"])
_bearer = HTTPBearer()


def require_afiliado(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    try:
        payload = verify_token(credentials.credentials)
    except JWTError as exc:
        from fastapi import HTTPException
        detail = "Token expirado" if "expired" in str(exc) else "Token inválido"
        raise HTTPException(status_code=401, detail=detail)
    from fastapi import HTTPException
    if payload.get("role") != "afiliado":
        raise HTTPException(status_code=403, detail="Acceso restringido a afiliados")
    return payload


class LoginRequest(BaseModel):
    tipo_documento: str
    numero_documento: str
    password: str


class RegisterRequest(BaseModel):
    tipo_documento: str
    numero_documento: str
    correo: str
    password: str


class AdminLoginRequest(BaseModel):
    email: str
    password: str


@router.post("/api/auth/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    return AfiliadoAuthService(CredentialRepository(db)).login(
        body.tipo_documento, body.numero_documento, body.password
    )


@router.post("/api/auth/register", status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    return AfiliadoAuthService(CredentialRepository(db)).register(
        body.tipo_documento, body.numero_documento, body.correo, body.password
    )


@router.get("/api/auth/me")
def me(payload: dict = Depends(require_afiliado), db: Session = Depends(get_db)):
    return AfiliadoAuthService(CredentialRepository(db)).get_me(int(payload["sub"]))


@router.post("/api/admin/auth/login")
def admin_login(body: AdminLoginRequest, db: Session = Depends(get_db)):
    return AdminAuthService(AdminRepository(db)).login(body.email, body.password)


@router.get("/api/admin/auth/me")
def admin_me(credentials: HTTPAuthorizationCredentials = Depends(_bearer), db: Session = Depends(get_db)):
    try:
        payload = verify_token(credentials.credentials)
    except JWTError:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Token inválido")
    from fastapi import HTTPException
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acceso restringido a administradores")
    return AdminAuthService(AdminRepository(db)).get_me(int(payload["sub"]))
