from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from src.config.database import get_db
from src.models.horario import Horario
from src.models.dia_no_habil import DiaNoHabil
from src.repositories.horario_repository import HorarioRepository
from src.services.availability_service import AvailabilityService
from src.services.slot_service import SlotService
from src.routers._auth import require_admin

router = APIRouter(tags=["Horarios"])


@router.get("/api/horarios/disponibles")
def disponibles(
    medico_id: int = Query(...),
    fecha: date = Query(...),
    db: Session = Depends(get_db),
):
    return AvailabilityService(db).get_disponibles(medico_id, fecha)


@router.get("/api/admin/horarios")
def listar_admin(
    medico_id: int | None = Query(None),
    fecha: date | None = Query(None),
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    estado: str | None = Query(None),
    _: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return [h.to_dict() for h in HorarioRepository(db).list_all(
        medico_id=medico_id, fecha=fecha, desde=desde, hasta=hasta, estado=estado
    )]


@router.post("/api/admin/horarios", status_code=201)
def crear_horario(body: dict, _: dict = Depends(require_admin), db: Session = Depends(get_db)):
    from datetime import time as dtime
    horario = Horario(
        medico_id=body["medico_id"],
        sede_id=body["sede_id"],
        fecha=date.fromisoformat(body["fecha"]),
        hora_inicio=dtime.fromisoformat(body["hora_inicio"]),
        hora_fin=dtime.fromisoformat(body["hora_fin"]),
        estado=body.get("estado", "disponible"),
    )
    return HorarioRepository(db).save(horario).to_dict()


@router.post("/api/admin/horarios/generar")
def generar(body: dict, _: dict = Depends(require_admin), db: Session = Depends(get_db)):
    medico_id = body["medico_id"]
    desde = date.fromisoformat(body["desde"])
    hasta = date.fromisoformat(body["hasta"])
    total = SlotService(db).generar(medico_id, desde, hasta)
    return {"mensaje": f"{total} horarios generados"}


@router.delete("/api/admin/horarios/{horario_id}")
def eliminar_horario(horario_id: int, _: dict = Depends(require_admin), db: Session = Depends(get_db)):
    repo = HorarioRepository(db)
    horario = repo.find_by_id(horario_id)
    if not horario:
        raise HTTPException(status_code=404, detail="Horario no encontrado")
    repo.delete(horario)
    return {"mensaje": "Horario eliminado"}


# Días no hábiles
@router.get("/api/admin/horarios/dias-no-habiles")
def listar_dias(db: Session = Depends(get_db)):
    return [d.to_dict() for d in HorarioRepository(db).get_dias_no_habiles()]


@router.post("/api/admin/horarios/dias-no-habiles", status_code=201)
def crear_dia(body: dict, _: dict = Depends(require_admin), db: Session = Depends(get_db)):
    repo = HorarioRepository(db)
    fecha = date.fromisoformat(body["fecha"])
    if repo.find_dia_no_habil_by_fecha(fecha):
        raise HTTPException(status_code=409, detail="La fecha ya está registrada como no hábil")
    dia = DiaNoHabil(fecha=fecha, descripcion=body.get("descripcion"))
    return repo.save_dia_no_habil(dia).to_dict()


@router.delete("/api/admin/horarios/dias-no-habiles/{dia_id}")
def eliminar_dia(dia_id: int, _: dict = Depends(require_admin), db: Session = Depends(get_db)):
    repo = HorarioRepository(db)
    dia = repo.find_dia_no_habil(dia_id)
    if not dia:
        raise HTTPException(status_code=404, detail="Día no hábil no encontrado")
    repo.delete_dia_no_habil(dia)
    return {"mensaje": "Día no hábil eliminado"}
