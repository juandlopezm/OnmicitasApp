from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from src.config.settings import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    from src.models import all_models  # noqa: F401
    from sqlalchemy import text
    Base.metadata.create_all(bind=engine)
    # Idempotent column migrations (ADD COLUMN IF NOT EXISTS)
    with engine.begin() as conn:
        conn.execute(text(
            "ALTER TABLE especialidades ADD COLUMN IF NOT EXISTS duracion_min INTEGER NOT NULL DEFAULT 30"
        ))
        conn.execute(text(
            "ALTER TABLE especialidades ADD COLUMN IF NOT EXISTS modalidad VARCHAR(20) NOT NULL DEFAULT 'presencial'"
        ))
        conn.execute(text(
            "ALTER TABLE sedes ADD COLUMN IF NOT EXISTS hora_apertura TIME"
        ))
        conn.execute(text(
            "ALTER TABLE sedes ADD COLUMN IF NOT EXISTS hora_cierre TIME"
        ))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
