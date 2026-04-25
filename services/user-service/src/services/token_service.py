"""
token_service — RS256 JWT verification only (user-service never issues tokens).
"""

from jose import jwt
from src.config.settings import settings

_key_cache: dict[str, str] = {}


def _load_key(path: str) -> str:
    if path not in _key_cache:
        with open(path, "r") as f:
            _key_cache[path] = f.read()
    return _key_cache[path]


def verify_token(token: str) -> dict:
    public_key = _load_key(settings.PUBLIC_KEY_PATH)
    return jwt.decode(
        token,
        public_key,
        algorithms=[settings.JWT_ALGORITHM],
        options={"verify_aud": False},
    )
