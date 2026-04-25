from sqlalchemy import Column, Index, Integer, String, Boolean, Time
from src.config.database import Base


class Sede(Base):
    __tablename__ = "sedes"

    __table_args__ = (
        # Catalog endpoint: filter active sedes only
        Index("ix_sedes_activa", "activa"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(100), nullable=False)
    ciudad = Column(String(60))
    direccion = Column(String(150))
    activa = Column(Boolean, default=True)
    hora_apertura = Column(Time, nullable=True)
    hora_cierre = Column(Time, nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "nombre": self.nombre,
            "ciudad": self.ciudad,
            "direccion": self.direccion,
            "activa": self.activa,
            "hora_apertura": str(self.hora_apertura) if self.hora_apertura else None,
            "hora_cierre": str(self.hora_cierre) if self.hora_cierre else None,
        }
