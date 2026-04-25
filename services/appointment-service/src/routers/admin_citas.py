"""Admin — full appointment management without 24h restriction."""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session

from src.config.database import get_db
from src.services.token_service import verify_token
from src.services.scheduling_service import SchedulingService
from src.repositories.cita_repository import CitaRepository

router = APIRouter(tags=["Admin — Citas"])
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


@router.get("/api/admin/citas")
def listar(
    estado: str | None = Query(None),
    medico_id: int | None = Query(None),
    desde: str | None = Query(None),
    hasta: str | None = Query(None),
    _: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from datetime import date
    return [c.to_dict() for c in CitaRepository(db).list_all(
        estado=estado,
        medico_id=medico_id,
        desde=date.fromisoformat(desde) if desde else None,
        hasta=date.fromisoformat(hasta) if hasta else None,
    )]


@router.post("/api/admin/citas", status_code=201)
def crear(
    body: dict,
    _: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    afiliado_id = body.pop("afiliado_id")
    return SchedulingService(db).agendar(afiliado_id, body, admin=True)


@router.put("/api/admin/citas/{cita_id}/estado")
def cambiar_estado(
    cita_id: int,
    body: dict,
    _: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    repo = CitaRepository(db)
    cita = repo.find_by_id(cita_id)
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    cita.estado = body["estado"]
    repo.commit()
    return cita.to_dict()


@router.delete("/api/admin/citas/{cita_id}/cancelar")
def cancelar_admin(
    cita_id: int,
    _: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return SchedulingService(db).cancelar(cita_id, admin=True)
