from sqlalchemy import Column, Integer, String, Date
from src.config.database import Base


class DiaNoHabil(Base):
    __tablename__ = "dias_no_habiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    fecha = Column(Date, nullable=False, unique=True)
    descripcion = Column(String(100))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "fecha": str(self.fecha),
            "descripcion": self.descripcion,
        }
