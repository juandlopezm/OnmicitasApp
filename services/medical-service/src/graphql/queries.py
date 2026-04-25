import strawberry
from typing import Optional
from sqlalchemy.orm import Session
from src.graphql.types import MedicoType, EspecialidadType, SedeType, HorarioType, JornadaType
from src.repositories.medico_repository import MedicoRepository
from src.repositories.catalogo_repository import EspecialidadRepository, SedeRepository
from src.repositories.horario_repository import HorarioRepository
from src.config.database import SessionLocal
from datetime import date


def _db() -> Session:
    return SessionLocal()


def _medico_to_type(m) -> MedicoType:
    return MedicoType(
        id=m.id,
        nombres=m.nombres,
        apellidos=m.apellidos,
        registro_medico=m.registro_medico,
        especialidad_id=m.especialidad_id,
        especialidad_nombre=m.especialidad_nombre,
        activo=m.activo,
        jornadas=[
            JornadaType(
                id=j.id,
                medico_id=j.medico_id,
                sede_id=j.sede_id,
                dia_semana=j.dia_semana,
                hora_inicio=str(j.hora_inicio),
                hora_fin=str(j.hora_fin),
                duracion_cita_min=j.duracion_cita_min,
            )
            for j in m.jornadas
        ],
    )


@strawberry.type
class Query:
    @strawberry.field
    def medicos(
        self,
        especialidad_id: Optional[int] = None,
        activo: Optional[bool] = None,
    ) -> list[MedicoType]:
        db = _db()
        try:
            repo = MedicoRepository(db)
            return [_medico_to_type(m) for m in repo.list_all(especialidad_id=especialidad_id, activo=activo)]
        finally:
            db.close()

    @strawberry.field
    def medico(self, id: int) -> Optional[MedicoType]:
        db = _db()
        try:
            m = MedicoRepository(db).find_by_id(id)
            return _medico_to_type(m) if m else None
        finally:
            db.close()

    @strawberry.field
    def especialidades(self) -> list[EspecialidadType]:
        db = _db()
        try:
            return [
                EspecialidadType(
                    id=e.id,
                    nombre=e.nombre,
                    descripcion=e.descripcion,
                    activa=e.activa,
                )
                for e in EspecialidadRepository(db).list_all()
            ]
        finally:
            db.close()

    @strawberry.field
    def especialidad(self, id: int) -> Optional[EspecialidadType]:
        db = _db()
        try:
            e = EspecialidadRepository(db).find_by_id(id)
            if not e:
                return None
            return EspecialidadType(id=e.id, nombre=e.nombre, descripcion=e.descripcion, activa=e.activa)
        finally:
            db.close()

    @strawberry.field
    def sedes(self) -> list[SedeType]:
        db = _db()
        try:
            return [
                SedeType(id=s.id, nombre=s.nombre, ciudad=s.ciudad, direccion=s.direccion, activa=s.activa)
                for s in SedeRepository(db).list_all()
            ]
        finally:
            db.close()

    @strawberry.field
    def horarios_disponibles(self, medico_id: int, fecha: str) -> list[HorarioType]:
        db = _db()
        try:
            fecha_d = date.fromisoformat(fecha)
            horarios = HorarioRepository(db).get_disponibles(medico_id, fecha_d)
            return [
                HorarioType(
                    id=h.id,
                    medico_id=h.medico_id,
                    sede_id=h.sede_id,
                    fecha=str(h.fecha),
                    hora_inicio=str(h.hora_inicio),
                    hora_fin=str(h.hora_fin),
                    estado=h.estado,
                )
                for h in horarios
            ]
        finally:
            db.close()

    @strawberry.field
    def buscar_medicos(
        self,
        especialidad_id: Optional[int] = None,
        sede_id: Optional[int] = None,
    ) -> list[MedicoType]:
        db = _db()
        try:
            medicos = MedicoRepository(db).list_all(especialidad_id=especialidad_id, activo=True)
            if sede_id is not None:
                medicos = [
                    m for m in medicos
                    if any(j.sede_id == sede_id for j in m.jornadas)
                ]
            return [_medico_to_type(m) for m in medicos]
        finally:
            db.close()
