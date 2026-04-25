"""
auth-service — OmniCitas
Sub-domains: authentication, authorization, token-management, user-admin.
Owns: admin_usuarios, user_credentials → db-auth
JWT: RS256 (private key signs, public key verifies — shared with Kong and other services)
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from src.config.database import init_db, SessionLocal
from src.routers.authentication import router as auth_router
from src.routers.user_admin import router as user_admin_router
from src.routers.session import router as session_router
from src.resilience.circuit_breakers import USER_SERVICE_CB

logger = logging.getLogger(__name__)


async def _cleanup_revoked_tokens():
    """Background task: purge expired revoked tokens every hour."""
    from src.repositories.revoked_token_repository import RevokedTokenRepository
    while True:
        await asyncio.sleep(3600)
        try:
            db = SessionLocal()
            deleted = RevokedTokenRepository(db).cleanup_expired()
            db.close()
            if deleted:
                logger.info(f"[Cleanup] Removed {deleted} expired revoked tokens")
        except Exception as exc:
            logger.warning(f"[Cleanup] Failed: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    asyncio.create_task(_cleanup_revoked_tokens())
    yield


app = FastAPI(
    title="OmniCitas — auth-service",
    description="Identidad: login, registro, tokens RS256, administración de credenciales.",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(auth_router)
app.include_router(user_admin_router)
app.include_router(session_router)


@app.get("/api/health", tags=["Health"])
def health():
    return {
        "status": "ok"
    }
