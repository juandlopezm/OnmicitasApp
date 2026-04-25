"""
RevokedTokenRepository — persistence for JWT blacklist.
"""

from datetime import datetime, timezone
from sqlalchemy.orm import Session
from src.models.revoked_token import RevokedToken


class RevokedTokenRepository:
    def __init__(self, db: Session):
        self.db = db

    def is_revoked(self, jti: str) -> bool:
        return self.db.query(RevokedToken).filter(RevokedToken.jti == jti).first() is not None

    def revoke(self, jti: str, user_id: int | None, expires_at: datetime) -> None:
        entry = RevokedToken(jti=jti, user_id=user_id, expires_at=expires_at)
        self.db.add(entry)
        self.db.commit()

    def cleanup_expired(self) -> int:
        """Remove tokens that have already expired (they can no longer be reused anyway)."""
        now = datetime.now(timezone.utc)
        deleted = (
            self.db.query(RevokedToken)
            .filter(RevokedToken.expires_at < now)
            .delete(synchronize_session=False)
        )
        self.db.commit()
        return deleted
