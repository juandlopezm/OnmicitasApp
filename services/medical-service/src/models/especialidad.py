from sqlalchemy import Column, Index, Integer, String, Boolean
from sqlalchemy.orm import relationship
from src.config.database import Base


class Especialidad(Base):
    __tablename__ = "especialidades"

    __table_args__ = (
        # Catalog endpoint: filter active specialties only
        Index("ix_especialidades_activa", "activa"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(100), nullable=False, unique=True)
    descripcion = Column(String(255))
    activa = Column(Boolean, default=True)
    duracion_min = Column(Integer, nullable=False, default=30)
    modalidad = Column(String(20), nullable=False, default="presencial")  # presencial | telemedicina | ambas

    medicos = relationship("Medico", back_populates="especialidad", lazy="select")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "nombre": self.nombre,
            "descripcion": self.descripcion,
            "activa": self.activa,
            "duracion_min": self.duracion_min,
            "modalidad": self.modalidad,
        }
