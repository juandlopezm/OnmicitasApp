from sqlalchemy.orm import Session
from src.models.admin_usuario import AdminUsuario


class AdminRepository:
    def __init__(self, db: Session):
        self.db = db

    def find_by_email(self, email: str) -> AdminUsuario | None:
        return self.db.query(AdminUsuario).filter_by(email=email).first()

    def find_by_id(self, admin_id: int) -> AdminUsuario | None:
        return self.db.get(AdminUsuario, admin_id)
