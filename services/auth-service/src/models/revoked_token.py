"""
RevokedToken — JWT blacklist for token revocation (Escenario 5).
Tokens are added here on logout. /api/internal/auth/validate checks this table.
Rows are cleaned up after expires_at passes.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Index
from src.config.database import Base


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    jti        = Column(String(36), nullable=False, unique=True)
    user_id    = Column(Integer, nullable=True)
    revoked_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=False)  # used for cleanup

    __table_args__ = (
        Index("ix_revoked_tokens_jti", "jti"),
        Index("ix_revoked_tokens_expires_at", "expires_at"),
    )
