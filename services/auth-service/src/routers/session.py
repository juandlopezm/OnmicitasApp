"""
Session Router — logout (token revocation) + internal token validation.

Endpoints:
  POST /api/auth/logout          — afiliado or admin logs out (blacklists JTI)
  GET  /api/internal/auth/validate — Kong pre-function calls this for every
                                     protected request (Escenarios 3, 4 y 5).
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session

from src.config.database import get_db
from src.repositories.revoked_token_repository import RevokedTokenRepository
from src.services.token_service import verify_token

router = APIRouter(tags=["Session"])
_bearer = HTTPBearer(auto_error=False)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_token(credentials: HTTPAuthorizationCredentials | None) -> str:
    if not credentials:
        raise HTTPException(status_code=401, detail="Token requerido")
    return credentials.credentials


def _decode_or_401(token: str) -> dict:
    try:
        return verify_token(token)
    except JWTError as exc:
        detail = "Token expirado" if "expired" in str(exc) else "Token inválido"
        raise HTTPException(status_code=401, detail=detail)


# ── Logout — afiliado y admin ─────────────────────────────────────────────────

@router.post("/api/auth/logout")
def logout(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
):
    """
    Revoca el JWT actual del afiliado.
    Escenario 5 — Revoke Access: el token queda inválido de inmediato.
    """
    token = _extract_token(credentials)
    payload = _decode_or_401(token)

    jti = payload.get("jti")
    if not jti:
        raise HTTPException(status_code=400, detail="Token sin JTI — no puede revocarse")

    # Convert exp to datetime for storage
    exp_ts = payload.get("exp")
    expires_at = datetime.fromtimestamp(exp_ts, tz=timezone.utc) if exp_ts else None
    if not expires_at:
        raise HTTPException(status_code=400, detail="Token sin expiración")

    repo = RevokedTokenRepository(db)
    if not repo.is_revoked(jti):
        repo.revoke(jti=jti, user_id=int(payload.get("sub", 0)), expires_at=expires_at)

    return {"mensaje": "Sesión cerrada"}


@router.post("/api/admin/auth/logout")
def admin_logout(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
):
    """Revoca el JWT actual del administrador."""
    token = _extract_token(credentials)
    payload = _decode_or_401(token)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acceso restringido a administradores")

    jti = payload.get("jti")
    exp_ts = payload.get("exp")
    if not jti or not exp_ts:
        raise HTTPException(status_code=400, detail="Token inválido para revocación")

    expires_at = datetime.fromtimestamp(exp_ts, tz=timezone.utc)
    repo = RevokedTokenRepository(db)
    if not repo.is_revoked(jti):
        repo.revoke(jti=jti, user_id=int(payload.get("sub", 0)), expires_at=expires_at)

    return {"mensaje": "Sesión de administrador cerrada"}


# ── Internal validate — llamado por Kong pre-function ─────────────────────────

@router.get("/api/internal/auth/validate")
def validate(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    x_required_role: str | None = Header(None, alias="X-Required-Role"),
    db: Session = Depends(get_db),
):
    """
    Valida el JWT para Kong (forward-auth).

    Escenario 3 — detecta token inválido o expirado → 401
    Escenario 4 — evalúa claim role vs X-Required-Role → 403
    Escenario 5 — consulta blacklist por jti → 401 si revocado

    Kong llama este endpoint para CADA request protegida.
    No requiere autenticación propia (es un endpoint interno — net-internal).
    En caso de éxito retorna {sub, role, jti} que Kong reenvía como headers.
    """
    token = _extract_token(credentials)

    # Escenario 3 — verificar firma y expiración
    payload = _decode_or_401(token)

    # Escenario 5 — verificar revocación por JTI
    jti = payload.get("jti")
    if jti:
        repo = RevokedTokenRepository(db)
        if repo.is_revoked(jti):
            raise HTTPException(status_code=401, detail="Token revocado")

    # Escenario 4 — verificar rol si el gateway lo exige
    if x_required_role and x_required_role != "":
        if payload.get("role") != x_required_role:
            raise HTTPException(status_code=403, detail="Rol insuficiente para este recurso")

    return {
        "sub": payload.get("sub"),
        "role": payload.get("role"),
        "jti": jti,
    }
