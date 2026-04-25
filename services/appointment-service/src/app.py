"""
appointment-service — OmniCitas
Sub-domains: scheduling, management, history, events.
Owns: citas → db-appointments
Saga: HTTP lock (medical-service) → INSERT → compensate on failure → publish RabbitMQ event.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from src.config.database import init_db
from src.routers.scheduling import router as scheduling_router
from src.routers.management import router as management_router
from src.routers.admin_citas import router as admin_router
from src.resilience.circuit_breakers import MEDICAL_SERVICE_CB, USER_SERVICE_CB


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="OmniCitas — appointment-service",
    description="Gestión de citas: agendamiento (Saga), cancelación, reagendamiento, historial.",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(scheduling_router)
app.include_router(management_router)
app.include_router(admin_router)


@app.get("/api/health", tags=["Health"])
def health():
    return {
        "status": "ok"
    }
