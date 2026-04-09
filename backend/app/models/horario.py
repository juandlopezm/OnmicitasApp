from datetime import datetime, timezone
from app.extensions import db


class Horario(db.Model):
    """Bloque de tiempo disponible u ocupado para un médico."""

    __tablename__ = "horarios"

    id = db.Column(db.Integer, primary_key=True)
    medico_id = db.Column(db.Integer, db.ForeignKey("medicos.id"), nullable=False)
    fecha = db.Column(db.Date, nullable=False)
    hora_inicio = db.Column(db.Time, nullable=False)
    hora_fin = db.Column(db.Time, nullable=False)
    estado = db.Column(
        db.Enum("disponible", "ocupado", name="estado_horario_enum"),
        nullable=False,
        default="disponible",
    )
    creado_en = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    medico = db.relationship("Medico", back_populates="horarios")
    cita = db.relationship("Cita", back_populates="horario", uselist=False)

    __table_args__ = (
        db.UniqueConstraint("medico_id", "fecha", "hora_inicio", name="uq_horario_medico"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "medico_id": self.medico_id,
            "medico_nombre": self.medico.nombre if self.medico else None,
            "fecha": self.fecha.isoformat(),
            "hora_inicio": self.hora_inicio.strftime("%H:%M"),
            "hora_fin": self.hora_fin.strftime("%H:%M"),
            "estado": self.estado,
        }
