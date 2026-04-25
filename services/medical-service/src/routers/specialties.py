from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from src.config.database import get_db
from src.models.especialidad import Especialidad
from src.repositories.catalogo_repository import EspecialidadRepository
from src.routers._auth import require_admin

router = APIRouter(tags=["Especialidades"])


@router.get("/api/especialidades")
def listar(db: Session = Depends(get_db)):
    return [e.to_dict() for e in EspecialidadRepository(db).list_all()]


@router.get("/api/especialidades/{esp_id}")
def detalle(esp_id: int, db: Session = Depends(get_db)):
    repo = EspecialidadRepository(db)
    esp = repo.find_by_id(esp_id)
    if not esp:
        raise HTTPException(status_code=404, detail="Especialidad no encontrada")
    return esp.to_dict()


@router.post("/api/admin/especialidades", status_code=201)
def crear(body: dict, _: dict = Depends(require_admin), db: Session = Depends(get_db)):
    repo = EspecialidadRepository(db)
    esp = Especialidad(**{k: v for k, v in body.items() if hasattr(Especialidad, k)})
    return repo.save(esp).to_dict()


@router.put("/api/admin/especialidades/{esp_id}")
def actualizar(esp_id: int, body: dict, _: dict = Depends(require_admin), db: Session = Depends(get_db)):
    repo = EspecialidadRepository(db)
    esp = repo.find_by_id(esp_id)
    if not esp:
        raise HTTPException(status_code=404, detail="Especialidad no encontrada")
    for field in {"nombre", "descripcion", "activa", "duracion_min", "modalidad"}:
        if field in body:
            setattr(esp, field, body[field])
    repo.commit()
    return esp.to_dict()


@router.delete("/api/admin/especialidades/{esp_id}")
def eliminar(esp_id: int, _: dict = Depends(require_admin), db: Session = Depends(get_db)):
    repo = EspecialidadRepository(db)
    esp = repo.find_by_id(esp_id)
    if not esp:
        raise HTTPException(status_code=404, detail="Especialidad no encontrada")
    try:
        repo.delete(esp)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="No se puede eliminar la especialidad porque tiene médicos asignados. "
                   "Reasigna o elimina los médicos primero.",
        )
    return {"mensaje": "Especialidad eliminada"}
