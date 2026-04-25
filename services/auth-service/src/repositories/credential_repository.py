from sqlalchemy.orm import Session
from src.models.user_credential import UserCredential


class CredentialRepository:
    def __init__(self, db: Session):
        self.db = db

    def find_by_documento(self, tipo: str, numero: str) -> UserCredential | None:
        return self.db.query(UserCredential).filter_by(
            tipo_documento=tipo, numero_documento=numero
        ).first()

    def find_by_correo(self, correo: str) -> UserCredential | None:
        return self.db.query(UserCredential).filter_by(correo=correo).first()

    def find_by_id(self, cred_id: int) -> UserCredential | None:
        return self.db.get(UserCredential, cred_id)

    def list_all(self) -> list[UserCredential]:
        return self.db.query(UserCredential).all()

    def save(self, cred: UserCredential) -> UserCredential:
        self.db.add(cred)
        self.db.commit()
        self.db.refresh(cred)
        return cred

    def commit(self) -> None:
        self.db.commit()
