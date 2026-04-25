from datetime import date
from sqlalchemy import select
from sqlalchemy.orm import Session
from src.models.horario import Horario
from src.models.dia_no_habil import DiaNoHabil


class HorarioRepository:
    def __init__(self, db: Session):
        self.db = db

    def find_by_id(self, horario_id: int) -> Horario | None:
        return self.db.query(Horario).filter(Horario.id == horario_id).first()

    def find_by_id_for_update(self, horario_id: int) -> Horario | None:
        """SELECT FOR UPDATE — used by internal lock/unlock endpoints."""
        return (
            self.db.execute(
                select(Horario)
                .where(Horario.id == horario_id)
                .with_for_update()
            )
            .scalars()
            .first()
        )

    def get_disponibles(self, medico_id: int, fecha: date) -> list[Horario]:
        return (
            self.db.query(Horario)
            .filter(
                Horario.medico_id == medico_id,
                Horario.fecha == fecha,
                Horario.estado == "disponible",
            )
            .order_by(Horario.hora_inicio)
            .all()
        )

    def list_all(
        self,
        medico_id: int | None = None,
        fecha: date | None = None,
        desde: date | None = None,
        hasta: date | None = None,
        estado: str | None = None,
    ) -> list[Horario]:
        q = self.db.query(Horario)
        if medico_id:
            q = q.filter(Horario.medico_id == medico_id)
        if fecha:
            q = q.filter(Horario.fecha == fecha)
        if desde:
            q = q.filter(Horario.fecha >= desde)
        if hasta:
            q = q.filter(Horario.fecha <= hasta)
        if estado:
            q = q.filter(Horario.estado == estado)
        return q.order_by(Horario.fecha, Horario.hora_inicio).all()

    def save(self, horario: Horario) -> Horario:
        self.db.add(horario)
        self.db.commit()
        self.db.refresh(horario)
        return horario

    def bulk_save(self, horarios: list[Horario]) -> int:
        self.db.add_all(horarios)
        self.db.commit()
        return len(horarios)

    def delete(self, horario: Horario) -> None:
        self.db.delete(horario)
        self.db.commit()

    def commit(self) -> None:
        self.db.commit()

    # Días no hábiles
    def get_dias_no_habiles(self) -> list[DiaNoHabil]:
        return self.db.query(DiaNoHabil).order_by(DiaNoHabil.fecha).all()

    def find_dia_no_habil(self, dia_id: int) -> DiaNoHabil | None:
        return self.db.query(DiaNoHabil).filter(DiaNoHabil.id == dia_id).first()

    def find_dia_no_habil_by_fecha(self, fecha: date) -> DiaNoHabil | None:
        return self.db.query(DiaNoHabil).filter(DiaNoHabil.fecha == fecha).first()

    def save_dia_no_habil(self, dia: DiaNoHabil) -> DiaNoHabil:
        self.db.add(dia)
        self.db.commit()
        self.db.refresh(dia)
        return dia

    def delete_dia_no_habil(self, dia: DiaNoHabil) -> None:
        self.db.delete(dia)
        self.db.commit()
