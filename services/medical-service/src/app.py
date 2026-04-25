"""
medical-service — OmniCitas
Sub-domains: doctors, specialties, availability, locations.
Owns: medicos, especialidades, sedes, horarios, jornadas, dias_no_habiles → db-medical
GraphQL: READ-ONLY (Query only, no Mutation).
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from strawberry.fastapi import GraphQLRouter

from src.config.database import init_db
from src.graphql.schema import schema
from src.routers.doctors import router as doctors_router
from src.routers.specialties import router as specialties_router
from src.routers.locations import router as locations_router
from src.routers.availability import router as availability_router
from src.routers.internal import router as internal_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="OmniCitas — medical-service",
    description="Catálogo médico: médicos, especialidades, sedes, horarios. GraphQL read-only.",
    version="1.0.0",
    lifespan=lifespan,
)

# REST routers
app.include_router(doctors_router)
app.include_router(specialties_router)
app.include_router(locations_router)
app.include_router(availability_router)
app.include_router(internal_router)

# GraphQL (read-only)
graphql_app = GraphQLRouter(schema, graphql_ide="graphiql")
app.include_router(graphql_app, prefix="/graphql")


@app.get("/api/health", tags=["Health"])
def health():
    return {"status": "ok"}
