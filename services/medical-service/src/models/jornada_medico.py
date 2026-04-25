from sqlalchemy import Column, Index, Integer, String, Time, ForeignKey
from sqlalchemy.orm import relationship
from src.config.database import Base


class JornadaMedico(Base):
    """
    Defines a doctor's weekly schedule for slot generation.
    dia_semana: 0=Mon, 1=Tue, ..., 6=Sun
    """

    __tablename__ = "jornadas_medico"

    __table_args__ = (
        # Slot generation: fetch all shifts for a given doctor (runs on every generar call)
        Index("ix_jornadas_medico_id", "medico_id"),
        # Schedule lookup: doctor's pattern for a specific day of the week
        Index("ix_jornadas_medico_dia", "medico_id", "dia_semana"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    medico_id = Column(Integer, ForeignKey("medicos.id"), nullable=False)
    sede_id = Column(Integer, nullable=False)  # logical ref to sedes (same DB)
    dia_semana = Column(Integer, nullable=False)  # 0-6
    hora_inicio = Column(Time, nullable=False)
    hora_fin = Column(Time, nullable=False)
    duracion_cita_min = Column(Integer, nullable=False, default=30)

    medico = relationship("Medico", back_populates="jornadas")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "medico_id": self.medico_id,
            "sede_id": self.sede_id,
            "dia_semana": self.dia_semana,
            "hora_inicio": str(self.hora_inicio),
            "hora_fin": str(self.hora_fin),
            "duracion_cita_min": self.duracion_cita_min,
        }
