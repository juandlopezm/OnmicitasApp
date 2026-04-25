import strawberry
from typing import Optional


@strawberry.type
class EspecialidadType:
    id: int
    nombre: str
    descripcion: Optional[str]
    activa: bool
    duracion_min: int
    modalidad: str


@strawberry.type
class SedeType:
    id: int
    nombre: str
    ciudad: Optional[str]
    direccion: Optional[str]
    activa: bool
    hora_apertura: Optional[str]
    hora_cierre: Optional[str]


@strawberry.type
class JornadaType:
    id: int
    medico_id: int
    sede_id: int
    dia_semana: int
    hora_inicio: str
    hora_fin: str
    duracion_cita_min: int


@strawberry.type
class MedicoType:
    id: int
    nombres: str
    apellidos: str
    registro_medico: Optional[str]
    especialidad_id: int
    especialidad_nombre: Optional[str]
    activo: bool
    jornadas: list[JornadaType]


@strawberry.type
class HorarioType:
    id: int
    medico_id: int
    sede_id: int
    fecha: str
    hora_inicio: str
    hora_fin: str
    estado: str
