"""
user-service — OmniCitas
Sub-domains: registration, profile, search.
Owns: afiliados → db-users
Credentials (password_hash) live in auth-service.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from src.config.database import init_db
from src.routers.registration import router as registration_router
from src.routers.search import router as search_router
from src.routers.profile import router as profile_router
from src.routers.internal import router as internal_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="OmniCitas — user-service",
    description="Perfiles de afiliados: registro, búsqueda, beneficiarios.",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(registration_router)
app.include_router(search_router)
app.include_router(profile_router)
app.include_router(internal_router)


@app.get("/api/health", tags=["Health"])
def health():
    return {"status": "ok"}
