from dotenv import load_dotenv
load_dotenv()

from app import create_app
from app.extensions import db
from app.models import (  # noqa: F401 — necesario para que SQLAlchemy registre los modelos
    AdminUsuario, Especialidad, Sede, Medico, JornadaMedico,
    Afiliado, Horario, Cita, DiaNoHabil,
)

app = create_app()

with app.app_context():
    db.create_all()
    # Migración incremental: añade columna 'canal' a citas si no existe.
    # db.create_all() solo crea tablas nuevas; no modifica las existentes.
    from sqlalchemy import text
    try:
        db.session.execute(text(
            "ALTER TABLE citas ADD COLUMN IF NOT EXISTS "
            "canal VARCHAR(20) NOT NULL DEFAULT 'web'"
        ))
        db.session.commit()
    except Exception:
        db.session.rollback()  # Columna ya existe o BD no disponible aún

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
