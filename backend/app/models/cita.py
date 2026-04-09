from datetime import datetime, timezone
from app.extensions import db


class Cita(db.Model):
    __tablename__ = "citas"

    id = db.Column(db.Integer, primary_key=True)

    # Quien agenda (cotizante)
    afiliado_id = db.Column(db.Integer, db.ForeignKey("afiliados.id"), nullable=False)

    # Para quién es la cita: null = para el propio afiliado, set = para un beneficiario
    beneficiario_id = db.Column(
        db.Integer, db.ForeignKey("afiliados.id"), nullable=True
    )

    medico_id = db.Column(db.Integer, db.ForeignKey("medicos.id"), nullable=False)
    especialidad_id = db.Column(
        db.Integer, db.ForeignKey("especialidades.id"), nullable=False
    )
    sede_id = db.Column(db.Integer, db.ForeignKey("sedes.id"), nullable=False)
    horario_id = db.Column(db.Integer, db.ForeignKey("horarios.id"), nullable=False)

    fecha = db.Column(db.Date, nullable=False)
    hora_inicio = db.Column(db.Time, nullable=False)

    estado = db.Column(
        db.Enum(
            "programada",
            "confirmada",
            "cancelada",
            "completada",
            "no_asistio",
            "reagendada",
            name="estado_cita_enum",
        ),
        nullable=False,
        default="programada",
    )
    # Canal de origen: permite distinguir citas creadas por web, WhatsApp, app móvil, etc.
    canal = db.Column(
        db.Enum("web", "admin", "whatsapp", "app_movil", "telefono", name="canal_enum"),
        nullable=False,
        default="web",
    )
    notas = db.Column(db.Text, nullable=True)
    creado_en = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    actualizado_en = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relaciones
    afiliado = db.relationship(
        "Afiliado", foreign_keys=[afiliado_id], back_populates="citas_agendadas"
    )
    beneficiario = db.relationship("Afiliado", foreign_keys=[beneficiario_id])
    medico = db.relationship("Medico")
    especialidad = db.relationship("Especialidad")
    sede = db.relationship("Sede")
    horario = db.relationship("Horario", back_populates="cita")

    def to_dict(self):
        paciente = self.beneficiario if self.beneficiario_id else self.afiliado
        return {
            "id": self.id,
            "afiliado_id": self.afiliado_id,
            "beneficiario_id": self.beneficiario_id,
            "paciente_nombre": f"{paciente.nombres} {paciente.apellidos}" if paciente else None,
            "medico_id": self.medico_id,
            "medico_nombre": self.medico.nombre if self.medico else None,
            "especialidad_id": self.especialidad_id,
            "especialidad_nombre": self.especialidad.nombre if self.especialidad else None,
            "sede_id": self.sede_id,
            "sede_nombre": self.sede.nombre if self.sede else None,
            "horario_id": self.horario_id,
            "fecha": self.fecha.isoformat(),
            "hora_inicio": self.hora_inicio.strftime("%H:%M"),
            "hora_fin": self.horario.hora_fin.strftime("%H:%M") if self.horario else None,
            "estado": self.estado,
            "canal": self.canal,
            "notas": self.notas,
            "creado_en": self.creado_en.isoformat() if self.creado_en else None,
        }
