"""
UserCredential — stores login credentials for afiliados.
Profile data (nombres, apellidos, etc.) lives in user-service.
user_id is a logical reference to user-service.afiliados (no FK constraint).
"""

from datetime import datetime, timezone
from sqlalchemy import Index, Integer, String, Enum, DateTime, Boolean
from sqlalchemy.orm import mapped_column, Mapped
from werkzeug.security import generate_password_hash, check_password_hash
from src.config.database import Base


class UserCredential(Base):
    __tablename__ = "user_credentials"

    __table_args__ = (
        # Login path: lookup by document type + number (fired on every afiliado login)
        Index("ix_user_creds_tipo_numero", "tipo_documento", "numero_documento"),
        # Soft-delete filter: quickly skip inactive credentials
        Index("ix_user_creds_activo", "activo"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tipo_documento: Mapped[str] = mapped_column(
        Enum("CC", "TI", "PA", "CE", name="tipo_documento_enum"), nullable=False
    )
    numero_documento: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    correo: Mapped[str | None] = mapped_column(String(120), unique=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    role: Mapped[str] = mapped_column(
        Enum("afiliado", name="role_enum"), nullable=False, default="afiliado"
    )
    # Logical reference to user-service.afiliados.id (no FK — different DB)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "tipo_documento": self.tipo_documento,
            "numero_documento": self.numero_documento,
            "correo": self.correo,
            "role": self.role,
            "user_id": self.user_id,
            "activo": self.activo,
        }
