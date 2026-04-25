from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from src.config.database import get_db
from src.models.sede import Sede
from src.repositories.catalogo_repository import SedeRepository
from src.routers._auth import require_admin

router = APIRouter(tags=["Sedes"])


@router.get("/api/sedes")
def listar(db: Session = Depends(get_db)):
    return [s.to_dict() for s in SedeRepository(db).list_all()]


@router.get("/api/sedes/{sede_id}")
def detalle(sede_id: int, db: Session = Depends(get_db)):
    sede = SedeRepository(db).find_by_id(sede_id)
    if not sede:
        raise HTTPException(status_code=404, detail="Sede no encontrada")
    return sede.to_dict()


@router.post("/api/admin/sedes", status_code=201)
def crear(body: dict, _: dict = Depends(require_admin), db: Session = Depends(get_db)):
    from datetime import time as dtime
    data = {k: v for k, v in body.items() if hasattr(Sede, k)}
    for field in ("hora_apertura", "hora_cierre"):
        if field in data and data[field]:
            data[field] = dtime.fromisoformat(data[field])
    sede = Sede(**data)
    return SedeRepository(db).save(sede).to_dict()


@router.put("/api/admin/sedes/{sede_id}")
def actualizar(sede_id: int, body: dict, _: dict = Depends(require_admin), db: Session = Depends(get_db)):
    repo = SedeRepository(db)
    sede = repo.find_by_id(sede_id)
    if not sede:
        raise HTTPException(status_code=404, detail="Sede no encontrada")
    for field in {"nombre", "ciudad", "direccion", "activa", "hora_apertura", "hora_cierre"}:
        if field in body:
            from datetime import time as dtime
            if field in {"hora_apertura", "hora_cierre"} and body[field]:
                setattr(sede, field, dtime.fromisoformat(body[field]))
            else:
                setattr(sede, field, body[field])
    repo.commit()
    return sede.to_dict()


@router.delete("/api/admin/sedes/{sede_id}")
def eliminar(sede_id: int, _: dict = Depends(require_admin), db: Session = Depends(get_db)):
    repo = SedeRepository(db)
    sede = repo.find_by_id(sede_id)
    if not sede:
        raise HTTPException(status_code=404, detail="Sede no encontrada")
    repo.delete(sede)
    return {"mensaje": "Sede eliminada"}
