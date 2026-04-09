from app.extensions import db


class DiaNoHabil(db.Model):
    __tablename__ = "dias_no_habiles"

    id = db.Column(db.Integer, primary_key=True)
    fecha = db.Column(db.Date, nullable=False, unique=True)
    descripcion = db.Column(db.String(200), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "fecha": self.fecha.isoformat(),
            "descripcion": self.descripcion,
        }
