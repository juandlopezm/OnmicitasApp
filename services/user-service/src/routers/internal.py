"""
Internal Router — endpoints consumed only by other services (not exposed by Kong).
Called by auth-service (Circuit Breaker) and appointment-service.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.config.database import get_db
from src.repositories.afiliado_repository import AfiliadoRepository

router = APIRouter(tags=["Internal"])


@router.get("/internal/users/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    repo = AfiliadoRepository(db)
    afiliado = repo.find_by_id(user_id)
    if not afiliado:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return afiliado.to_dict()


@router.get("/internal/users/by-documento")
def get_user_by_documento(
    tipo_documento: str,
    numero_documento: str,
    db: Session = Depends(get_db),
):
    repo = AfiliadoRepository(db)
    afiliado = repo.find_by_documento(tipo_documento, numero_documento)
    if not afiliado:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return afiliado.to_dict()
