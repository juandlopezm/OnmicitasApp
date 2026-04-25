from sqlalchemy.orm import Session
from src.models.medico import Medico
from src.models.jornada_medico import JornadaMedico


class MedicoRepository:
    def __init__(self, db: Session):
        self.db = db

    def find_by_id(self, medico_id: int) -> Medico | None:
        return self.db.query(Medico).filter(Medico.id == medico_id).first()

    def list_all(self, especialidad_id: int | None = None, activo: bool | None = None) -> list[Medico]:
        q = self.db.query(Medico)
        if especialidad_id is not None:
            q = q.filter(Medico.especialidad_id == especialidad_id)
        if activo is not None:
            q = q.filter(Medico.activo == activo)
        return q.order_by(Medico.apellidos).all()

    def save(self, medico: Medico) -> Medico:
        self.db.add(medico)
        self.db.commit()
        self.db.refresh(medico)
        return medico

    def delete(self, medico: Medico) -> None:
        self.db.delete(medico)
        self.db.commit()

    def commit(self) -> None:
        self.db.commit()

    # Jornadas
    def find_jornada(self, jornada_id: int) -> JornadaMedico | None:
        return self.db.query(JornadaMedico).filter(JornadaMedico.id == jornada_id).first()

    def get_jornadas(self, medico_id: int) -> list[JornadaMedico]:
        return self.db.query(JornadaMedico).filter(JornadaMedico.medico_id == medico_id).all()

    def save_jornada(self, jornada: JornadaMedico) -> JornadaMedico:
        self.db.add(jornada)
        self.db.commit()
        self.db.refresh(jornada)
        return jornada

    def delete_jornada(self, jornada: JornadaMedico) -> None:
        self.db.delete(jornada)
        self.db.commit()
