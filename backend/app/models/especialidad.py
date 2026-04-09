from app.extensions import db


class Especialidad(db.Model):
    __tablename__ = "especialidades"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    descripcion = db.Column(db.Text, nullable=True)
    # Duración en minutos por consulta: 30 general, 45 especialidad
    duracion_minutos = db.Column(db.Integer, nullable=False, default=30)
    activo = db.Column(db.Boolean, nullable=False, default=True)

    medicos = db.relationship("Medico", back_populates="especialidad", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "descripcion": self.descripcion,
            "duracion_minutos": self.duracion_minutos,
            "activo": self.activo,
        }
