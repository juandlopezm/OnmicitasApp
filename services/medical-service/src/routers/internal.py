"""
Internal Router — horario lock/unlock used by appointment-service Saga.
Not exposed by Kong (net-internal only).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from src.config.database import get_db
from src.repositories.horario_repository import HorarioRepository

router = APIRouter(tags=["Internal"])


@router.patch("/internal/horarios/{horario_id}/ocupar")
def ocupar(horario_id: int, db: Session = Depends(get_db)):
    """Atomically lock a horario slot (SELECT FOR UPDATE)."""
    repo = HorarioRepository(db)
    horario = repo.find_by_id_for_update(horario_id)
    if not horario:
        raise HTTPException(status_code=404, detail="Horario no encontrado")
    if horario.estado != "disponible":
        raise HTTPException(status_code=409, detail="El horario ya no está disponible")
    horario.estado = "ocupado"
    repo.commit()
    return horario.to_dict()


@router.patch("/internal/horarios/{horario_id}/liberar")
def liberar(horario_id: int, db: Session = Depends(get_db)):
    """Release a horario slot (Saga compensation)."""
    repo = HorarioRepository(db)
    horario = repo.find_by_id(horario_id)
    if not horario:
        raise HTTPException(status_code=404, detail="Horario no encontrado")
    horario.estado = "disponible"
    repo.commit()
    return horario.to_dict()


@router.get("/internal/horarios/{horario_id}")
def get_horario(horario_id: int, db: Session = Depends(get_db)):
    horario = HorarioRepository(db).find_by_id(horario_id)
    if not horario:
        raise HTTPException(status_code=404, detail="Horario no encontrado")
    return horario.to_dict()
