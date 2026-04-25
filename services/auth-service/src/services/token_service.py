"""
TokenService — RS256 JWT emission and verification.
Single Responsibility: only handles token lifecycle.
Dependency Inversion: depends on key paths from settings, not hardcoded values.
"""

import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from jose import jwt, JWTError
from src.config.settings import settings


def _load_key(path: str) -> str:
    return Path(path).read_text()


def create_token(subject: str, role: str, **extra_claims) -> str:
    private_key = _load_key(settings.PRIVATE_KEY_PATH)
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(subject),
        "iss": settings.JWT_ISSUER,
        "iat": now,
        "exp": now + timedelta(hours=settings.JWT_EXPIRE_HOURS),
        "jti": str(uuid.uuid4()),  # JWT ID único — usado para revocación
        "role": role,
        **extra_claims,
    }
    return jwt.encode(payload, private_key, algorithm=settings.JWT_ALGORITHM)


def verify_token(token: str) -> dict:
    """Raises JWTError on invalid/expired token."""
    public_key = _load_key(settings.PUBLIC_KEY_PATH)
    return jwt.decode(token, public_key, algorithms=[settings.JWT_ALGORITHM])
