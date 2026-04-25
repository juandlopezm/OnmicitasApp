from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from src.config.database import get_db
from src.models.medico import Medico
from src.models.jornada_medico import JornadaMedico
from src.repositories.medico_repository import MedicoRepository
from src.repositories.catalogo_repository import EspecialidadRepository
from src.routers._auth import require_admin

router = APIRouter(tags=["Médicos"])


@router.get("/api/medicos")
def listar(
    especialidad_id: int | None = Query(None),
    sede_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    repo = MedicoRepository(db)
    medicos = repo.list_all(especialidad_id=especialidad_id, activo=True)
    return [m.to_dict() for m in medicos]


@router.get("/api/medicos/{medico_id}")
def detalle(medico_id: int, db: Session = Depends(get_db)):
    medico = MedicoRepository(db).find_by_id(medico_id)
    if not medico:
        raise HTTPException(status_code=404, detail="Médico no encontrado")
    return medico.to_dict(include_jornadas=True)


@router.post("/api/admin/medicos", status_code=201)
def crear(body: dict, _: dict = Depends(require_admin), db: Session = Depends(get_db)):
    esp = EspecialidadRepository(db).find_by_id(body.get("especialidad_id", 0))
    if not esp:
        raise HTTPException(status_code=404, detail="Especialidad no encontrada")
    medico = Medico(
        nombres=body["nombres"],
        apellidos=body["apellidos"],
        registro_medico=body.get("registro_medico"),
        especialidad_id=esp.id,
        especialidad_nombre=esp.nombre,
        activo=body.get("activo", True),
    )
    return MedicoRepository(db).save(medico).to_dict()


@router.put("/api/admin/medicos/{medico_id}")
def actualizar(medico_id: int, body: dict, _: dict = Depends(require_admin), db: Session = Depends(get_db)):
    repo = MedicoRepository(db)
    medico = repo.find_by_id(medico_id)
    if not medico:
        raise HTTPException(status_code=404, detail="Médico no encontrado")
    for field in {"nombres", "apellidos", "registro_medico", "activo"}:
        if field in body:
            setattr(medico, field, body[field])
    if "especialidad_id" in body:
        esp = EspecialidadRepository(db).find_by_id(body["especialidad_id"])
        if not esp:
            raise HTTPException(status_code=404, detail="Especialidad no encontrada")
        medico.especialidad_id = esp.id
        medico.especialidad_nombre = esp.nombre
    repo.commit()
    return medico.to_dict()


@router.delete("/api/admin/medicos/{medico_id}")
def eliminar(medico_id: int, _: dict = Depends(require_admin), db: Session = Depends(get_db)):
    repo = MedicoRepository(db)
    medico = repo.find_by_id(medico_id)
    if not medico:
        raise HTTPException(status_code=404, detail="Médico no encontrado")
    repo.delete(medico)
    return {"mensaje": "Médico eliminado"}


@router.post("/api/admin/medicos/{medico_id}/jornadas", status_code=201)
def agregar_jornada(medico_id: int, body: dict, _: dict = Depends(require_admin), db: Session = Depends(get_db)):
    repo = MedicoRepository(db)
    if not repo.find_by_id(medico_id):
        raise HTTPException(status_code=404, detail="Médico no encontrado")
    from datetime import time as dtime
    jornada = JornadaMedico(
        medico_id=medico_id,
        sede_id=body["sede_id"],
        dia_semana=body["dia_semana"],
        hora_inicio=dtime.fromisoformat(body["hora_inicio"]),
        hora_fin=dtime.fromisoformat(body["hora_fin"]),
        duracion_cita_min=body.get("duracion_cita_min", 30),
    )
    return repo.save_jornada(jornada).to_dict()


@router.delete("/api/admin/medicos/{medico_id}/jornadas/{jornada_id}")
def eliminar_jornada(medico_id: int, jornada_id: int, _: dict = Depends(require_admin), db: Session = Depends(get_db)):
    repo = MedicoRepository(db)
    jornada = repo.find_jornada(jornada_id)
    if not jornada or jornada.medico_id != medico_id:
        raise HTTPException(status_code=404, detail="Jornada no encontrada")
    repo.delete_jornada(jornada)
    return {"mensaje": "Jornada eliminada"}
