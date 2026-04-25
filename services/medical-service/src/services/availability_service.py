"""
AvailabilityService — filters and returns available horario slots.
"""

from datetime import date, datetime, timezone, timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException
from src.repositories.horario_repository import HorarioRepository


class AvailabilityService:
    def __init__(self, db: Session):
        self.repo = HorarioRepository(db)

    def get_disponibles(self, medico_id: int, fecha: date) -> list[dict]:
        # Restricción: la fecha debe ser al menos el día de mañana (en hora local del servidor).
        # Se usa date.today() para evitar que diferencias de zona horaria bloqueen
        # al afiliado cuando intenta ver horarios de "mañana" en horas vespertinas.
        hoy = datetime.now(timezone.utc).date()
        if fecha <= hoy:
            raise HTTPException(
                status_code=422,
                detail="Solo se pueden consultar horarios a partir de mañana.",
            )

        horarios = self.repo.get_disponibles(medico_id, fecha)
        return [h.to_dict() for h in horarios]
