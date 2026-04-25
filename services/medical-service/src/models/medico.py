from sqlalchemy import Column, Index, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from src.config.database import Base


class Medico(Base):
    __tablename__ = "medicos"

    __table_args__ = (
        # Availability flow: list doctors by specialty + active status (per request)
        Index("ix_medicos_especialidad_activo", "especialidad_id", "activo"),
        # Alphabetical listing: admin view orders by apellidos
        Index("ix_medicos_apellidos", "apellidos"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombres = Column(String(100), nullable=False)
    apellidos = Column(String(100), nullable=False)
    registro_medico = Column(String(30), unique=True)
    especialidad_id = Column(Integer, ForeignKey("especialidades.id"), nullable=False)
    especialidad_nombre = Column(String(100))  # desnormalizado para snapshot
    activo = Column(Boolean, default=True)

    especialidad = relationship("Especialidad", back_populates="medicos")
    jornadas = relationship("JornadaMedico", back_populates="medico", cascade="all, delete-orphan")

    def to_dict(self, include_jornadas: bool = False) -> dict:
        data = {
            "id": self.id,
            "nombres": self.nombres,
            "apellidos": self.apellidos,
            "registro_medico": self.registro_medico,
            "especialidad_id": self.especialidad_id,
            "especialidad_nombre": self.especialidad_nombre,
            "activo": self.activo,
        }
        if include_jornadas:
            data["jornadas"] = [j.to_dict() for j in self.jornadas]
        return data
