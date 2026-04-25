from sqlalchemy.orm import Session
from src.models.afiliado import Afiliado


class AfiliadoRepository:
    def __init__(self, db: Session):
        self.db = db

    def find_by_id(self, afiliado_id: int) -> Afiliado | None:
        return self.db.query(Afiliado).filter(Afiliado.id == afiliado_id).first()

    def find_by_documento(self, tipo: str, numero: str) -> Afiliado | None:
        return (
            self.db.query(Afiliado)
            .filter(Afiliado.tipo_documento == tipo, Afiliado.numero_documento == numero)
            .first()
        )

    def list_all(self, tipo: str | None = None, estado: str | None = None) -> list[Afiliado]:
        q = self.db.query(Afiliado)
        if tipo:
            q = q.filter(Afiliado.tipo == tipo)
        if estado:
            q = q.filter(Afiliado.estado == estado)
        return q.order_by(Afiliado.apellidos).all()

    def save(self, afiliado: Afiliado) -> Afiliado:
        self.db.add(afiliado)
        self.db.commit()
        self.db.refresh(afiliado)
        return afiliado

    def delete(self, afiliado: Afiliado) -> None:
        self.db.delete(afiliado)
        self.db.commit()

    def commit(self) -> None:
        self.db.commit()
