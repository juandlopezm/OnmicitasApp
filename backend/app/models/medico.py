from app.extensions import db


class Medico(db.Model):
    __tablename__ = "medicos"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(120), nullable=False)
    especialidad_id = db.Column(
        db.Integer, db.ForeignKey("especialidades.id"), nullable=False
    )
    sede_id = db.Column(db.Integer, db.ForeignKey("sedes.id"), nullable=False)
    activo = db.Column(db.Boolean, nullable=False, default=True)

    especialidad = db.relationship("Especialidad", back_populates="medicos")
    sede = db.relationship("Sede")
    jornadas = db.relationship(
        "JornadaMedico", back_populates="medico", cascade="all, delete-orphan"
    )
    horarios = db.relationship(
        "Horario", back_populates="medico", cascade="all, delete-orphan"
    )

    def to_dict(self, include_jornadas=False):
        data = {
            "id": self.id,
            "nombre": self.nombre,
            "especialidad_id": self.especialidad_id,
            "especialidad_nombre": self.especialidad.nombre if self.especialidad else None,
            "sede_id": self.sede_id,
            "sede_nombre": self.sede.nombre if self.sede else None,
            "activo": self.activo,
        }
        if include_jornadas:
            data["jornadas"] = [j.to_dict() for j in self.jornadas]
        return data


class JornadaMedico(db.Model):
    """Horario laboral semanal del médico."""

    __tablename__ = "jornadas_medico"

    id = db.Column(db.Integer, primary_key=True)
    medico_id = db.Column(
        db.Integer, db.ForeignKey("medicos.id"), nullable=False
    )
    # 0=Lunes, 1=Martes, ..., 6=Domingo
    dia_semana = db.Column(db.Integer, nullable=False)
    hora_inicio = db.Column(db.Time, nullable=False)
    hora_fin = db.Column(db.Time, nullable=False)

    medico = db.relationship("Medico", back_populates="jornadas")

    def to_dict(self):
        return {
            "id": self.id,
            "medico_id": self.medico_id,
            "dia_semana": self.dia_semana,
            "hora_inicio": self.hora_inicio.strftime("%H:%M"),
            "hora_fin": self.hora_fin.strftime("%H:%M"),
        }
