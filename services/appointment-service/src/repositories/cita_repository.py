from sqlalchemy.orm import Session
from src.models.cita import Cita


class CitaRepository:
    def __init__(self, db: Session):
        self.db = db

    def find_by_id(self, cita_id: int) -> Cita | None:
        return self.db.query(Cita).filter(Cita.id == cita_id).first()

    def get_activas_afiliado(self, afiliado_id: int) -> list[Cita]:
        return (
            self.db.query(Cita)
            .filter(
                Cita.afiliado_id == afiliado_id,
                Cita.estado.in_(["programada", "pendiente", "confirmada", "reagendada"]),
            )
            .order_by(Cita.fecha, Cita.hora_inicio)
            .all()
        )

    def get_historial_afiliado(self, afiliado_id: int) -> list[Cita]:
        return (
            self.db.query(Cita)
            .filter(Cita.afiliado_id == afiliado_id)
            .order_by(Cita.fecha.desc(), Cita.hora_inicio.desc())
            .all()
        )

    def list_all(
        self,
        estado: str | None = None,
        medico_id: int | None = None,
        desde=None,
        hasta=None,
    ) -> list[Cita]:
        q = self.db.query(Cita)
        if estado:
            q = q.filter(Cita.estado == estado)
        if medico_id:
            q = q.filter(Cita.medico_id == medico_id)
        if desde:
            q = q.filter(Cita.fecha >= desde)
        if hasta:
            q = q.filter(Cita.fecha <= hasta)
        return q.order_by(Cita.fecha.desc(), Cita.hora_inicio).all()

    def existe_cita_activa_para_especialidad(
        self,
        afiliado_id: int,
        especialidad_id: int,
        beneficiario_id: int | None = None,
    ) -> bool:
        """Retorna True si el paciente ya tiene una cita activa para esa especialidad."""
        estados_activos = ["programada", "pendiente", "confirmada", "reagendada"]
        q = self.db.query(Cita).filter(
            Cita.especialidad_id == especialidad_id,
            Cita.estado.in_(estados_activos),
        )
        if beneficiario_id is not None:
            q = q.filter(Cita.beneficiario_id == beneficiario_id)
        else:
            q = q.filter(
                Cita.afiliado_id == afiliado_id,
                Cita.beneficiario_id.is_(None),
            )
        return q.first() is not None

    def save(self, cita: Cita) -> Cita:
        self.db.add(cita)
        self.db.commit()
        self.db.refresh(cita)
        return cita

    def commit(self) -> None:
        self.db.commit()
