"""
SlotService — generates Horario slots from JornadaMedico definitions.
"""

from datetime import date, timedelta, datetime, time
from sqlalchemy.orm import Session
from fastapi import HTTPException
from src.models.horario import Horario
from src.models.jornada_medico import JornadaMedico
from src.repositories.horario_repository import HorarioRepository
from src.repositories.medico_repository import MedicoRepository


class SlotService:
    def __init__(self, db: Session):
        self.db = db
        self.horario_repo = HorarioRepository(db)
        self.medico_repo = MedicoRepository(db)

    def generar(self, medico_id: int, desde: date, hasta: date) -> int:
        """Generate available horario slots for a doctor between two dates."""
        jornadas = self.medico_repo.get_jornadas(medico_id)
        if not jornadas:
            raise HTTPException(
                status_code=422,
                detail=(
                    "El médico no tiene jornadas configuradas. "
                    "Agrega jornadas en la pestaña 'Médicos y Jornadas' primero."
                ),
            )
        dias_no_habiles = {
            d.fecha for d in self.horario_repo.get_dias_no_habiles()
        }

        slots: list[Horario] = []
        current = desde
        while current <= hasta:
            if current not in dias_no_habiles:
                dia_semana = current.weekday()  # 0=Mon ... 6=Sun
                jornadas_hoy = [j for j in jornadas if j.dia_semana == dia_semana]
                for jornada in jornadas_hoy:
                    slots.extend(
                        self._slots_from_jornada(jornada, current)
                    )
            current += timedelta(days=1)

        return self.horario_repo.bulk_save(slots)

    def _slots_from_jornada(self, jornada: JornadaMedico, fecha: date) -> list[Horario]:
        slots = []
        inicio = datetime.combine(fecha, jornada.hora_inicio)
        fin = datetime.combine(fecha, jornada.hora_fin)
        duracion = timedelta(minutes=jornada.duracion_cita_min)

        current = inicio
        while current + duracion <= fin:
            slot_fin = current + duracion
            slots.append(
                Horario(
                    medico_id=jornada.medico_id,
                    sede_id=jornada.sede_id,
                    fecha=fecha,
                    hora_inicio=current.time(),
                    hora_fin=slot_fin.time(),
                    estado="disponible",
                )
            )
            current = slot_fin
        return slots
