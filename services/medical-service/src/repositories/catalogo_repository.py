from sqlalchemy.orm import Session
from src.models.especialidad import Especialidad
from src.models.sede import Sede


class EspecialidadRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_all(self, activa: bool | None = None) -> list[Especialidad]:
        q = self.db.query(Especialidad)
        if activa is not None:
            q = q.filter(Especialidad.activa == activa)
        return q.order_by(Especialidad.nombre).all()

    def find_by_id(self, esp_id: int) -> Especialidad | None:
        return self.db.query(Especialidad).filter(Especialidad.id == esp_id).first()

    def save(self, esp: Especialidad) -> Especialidad:
        self.db.add(esp)
        self.db.commit()
        self.db.refresh(esp)
        return esp

    def delete(self, esp: Especialidad) -> None:
        self.db.delete(esp)
        self.db.commit()

    def commit(self) -> None:
        self.db.commit()


class SedeRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_all(self, activa: bool | None = None) -> list[Sede]:
        q = self.db.query(Sede)
        if activa is not None:
            q = q.filter(Sede.activa == activa)
        return q.order_by(Sede.nombre).all()

    def find_by_id(self, sede_id: int) -> Sede | None:
        return self.db.query(Sede).filter(Sede.id == sede_id).first()

    def save(self, sede: Sede) -> Sede:
        self.db.add(sede)
        self.db.commit()
        self.db.refresh(sede)
        return sede

    def delete(self, sede: Sede) -> None:
        self.db.delete(sede)
        self.db.commit()

    def commit(self) -> None:
        self.db.commit()
