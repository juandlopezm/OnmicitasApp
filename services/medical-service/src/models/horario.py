from datetime import datetime, timezone
from sqlalchemy import Column, Index, Integer, String, Date, Time, DateTime, ForeignKey
from src.config.database import Base


class Horario(Base):
    __tablename__ = "horarios"

    __table_args__ = (
        # THE HOTTEST QUERY: availability check per doctor+date+status
        # Covers: get_disponibles(medico_id, fecha) and SELECT FOR UPDATE on booking
        Index("ix_horarios_medico_fecha_estado", "medico_id", "fecha", "estado"),
        # Admin date-range listing: filter slots across date window
        Index("ix_horarios_fecha_estado", "fecha", "estado"),
        # Sede-based queries: admin may list slots by sede
        Index("ix_horarios_sede_fecha", "sede_id", "fecha"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    medico_id = Column(Integer, ForeignKey("medicos.id"), nullable=False)
    sede_id = Column(Integer, nullable=False)
    fecha = Column(Date, nullable=False)
    hora_inicio = Column(Time, nullable=False)
    hora_fin = Column(Time, nullable=False)
    estado = Column(String(20), nullable=False, default="disponible")  # disponible | ocupado | bloqueado
    creado_en = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "medico_id": self.medico_id,
            "sede_id": self.sede_id,
            "fecha": str(self.fecha),
            "hora_inicio": str(self.hora_inicio),
            "hora_fin": str(self.hora_fin),
            "estado": self.estado,
        }
