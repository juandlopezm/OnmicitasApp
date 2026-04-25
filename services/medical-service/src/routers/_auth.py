"""Shared auth dependency for medical-service routers."""

from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from src.services.token_service import verify_token

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
