"""
Cita — appointment model with snapshot denormalization.
Stores names/labels at creation time so reporting is independent of other services.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Index, Integer, String, Date, Time, DateTime
from src.config.database import Base


class Cita(Base):
    __tablename__ = "citas"

    __table_args__ = (
        # HOTTEST: active appointments for a user — runs on every session load
        Index("ix_citas_afiliado_estado", "afiliado_id", "estado"),
        # User history view: all appointments ordered by date desc
        Index("ix_citas_afiliado_fecha", "afiliado_id", "fecha"),
        # Duplicate-specialty guard: check if afiliado already has active booking
        Index("ix_citas_especialidad_estado", "especialidad_id", "estado"),
        # Admin dashboard: filter by doctor + date range
        Index("ix_citas_medico_fecha", "medico_id", "fecha"),
        # Admin status board: appointments by status + date
        Index("ix_citas_estado_fecha", "estado", "fecha"),
        # Idempotency / saga compensation: lookup by slot reference
        Index("ix_citas_horario_id", "horario_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)

    # References (logical, no FK across services)
    afiliado_id = Column(Integer, nullable=False)
    beneficiario_id = Column(Integer, nullable=True)
    medico_id = Column(Integer, nullable=False)
    especialidad_id = Column(Integer, nullable=False)
    sede_id = Column(Integer, nullable=False)
    horario_id = Column(Integer, nullable=False)

    # Snapshot — frozen at creation
    paciente_nombre = Column(String(200))
    medico_nombre = Column(String(200))
    especialidad_nombre = Column(String(100))
    sede_nombre = Column(String(100))

    # Scheduling
    fecha = Column(Date, nullable=False)
    hora_inicio = Column(Time, nullable=False)
    hora_fin = Column(Time, nullable=False)

    # Metadata
    estado = Column(String(20), nullable=False, default="pendiente")
    canal = Column(String(20), default="web")
    notas = Column(String(500))
    creado_en = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    actualizado_en = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "afiliado_id": self.afiliado_id,
            "beneficiario_id": self.beneficiario_id,
            "medico_id": self.medico_id,
            "especialidad_id": self.especialidad_id,
            "sede_id": self.sede_id,
            "horario_id": self.horario_id,
            "paciente_nombre": self.paciente_nombre,
            "medico_nombre": self.medico_nombre,
            "especialidad_nombre": self.especialidad_nombre,
            "sede_nombre": self.sede_nombre,
            "fecha": str(self.fecha),
            "hora_inicio": str(self.hora_inicio),
            "hora_fin": str(self.hora_fin),
            "estado": self.estado,
            "canal": self.canal,
            "notas": self.notas,
            "creado_en": self.creado_en.isoformat() if self.creado_en else None,
            "actualizado_en": self.actualizado_en.isoformat() if self.actualizado_en else None,
        }
