from datetime import datetime, timezone, date
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db


class Afiliado(db.Model):
    __tablename__ = "afiliados"

    id = db.Column(db.Integer, primary_key=True)

    # Identificación
    tipo_documento = db.Column(
        db.Enum("CC", "TI", "PA", "CE", name="tipo_documento_enum"), nullable=False
    )
    numero_documento = db.Column(db.String(30), nullable=False, unique=True)

    # Datos personales
    nombres = db.Column(db.String(100), nullable=False)
    apellidos = db.Column(db.String(100), nullable=False)
    genero = db.Column(
        db.Enum("M", "F", "O", name="genero_enum"), nullable=False
    )
    fecha_nacimiento = db.Column(db.Date, nullable=False)
    telefono = db.Column(db.String(20), nullable=True)
    departamento = db.Column(db.String(80), nullable=True)
    ciudad = db.Column(db.String(80), nullable=True)
    ips_medica = db.Column(db.String(120), nullable=True)

    # Acceso al sistema (solo cotizantes activos pueden loguearse)
    correo = db.Column(db.String(120), unique=True, nullable=True)
    password_hash = db.Column(db.String(256), nullable=True)

    # Tipo y vínculo
    tipo = db.Column(
        db.Enum("cotizante", "beneficiario", name="tipo_afiliado_enum"),
        nullable=False,
        default="cotizante",
    )
    # cotizante_id apunta al afiliado cotizante al que pertenece este beneficiario
    cotizante_id = db.Column(
        db.Integer, db.ForeignKey("afiliados.id"), nullable=True
    )

    estado = db.Column(
        db.Enum("activo", "inactivo", "suspendido", name="estado_afiliado_enum"),
        nullable=False,
        default="activo",
    )

    creado_en = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    actualizado_en = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relaciones
    beneficiarios = db.relationship(
        "Afiliado",
        backref=db.backref("cotizante", remote_side=[id]),
        foreign_keys=[cotizante_id],
        lazy="select",
    )
    citas_agendadas = db.relationship(
        "Cita",
        foreign_keys="Cita.afiliado_id",
        back_populates="afiliado",
        lazy="select",
    )

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def calcular_edad(self) -> int:
        hoy = date.today()
        edad = hoy.year - self.fecha_nacimiento.year
        if (hoy.month, hoy.day) < (self.fecha_nacimiento.month, self.fecha_nacimiento.day):
            edad -= 1
        return edad

    def verificar_inactivacion_por_edad(self):
        """Inactiva automáticamente beneficiarios mayores de 24 años."""
        if self.tipo == "beneficiario" and self.calcular_edad() > 24:
            if self.estado == "activo":
                self.estado = "inactivo"
                return True
        return False

    def to_dict(self, include_beneficiarios=False):
        data = {
            "id": self.id,
            "tipo_documento": self.tipo_documento,
            "numero_documento": self.numero_documento,
            "nombres": self.nombres,
            "apellidos": self.apellidos,
            "genero": self.genero,
            "fecha_nacimiento": self.fecha_nacimiento.isoformat(),
            "telefono": self.telefono,
            "correo": self.correo,
            "departamento": self.departamento,
            "ciudad": self.ciudad,
            "ips_medica": self.ips_medica,
            "tipo": self.tipo,
            "cotizante_id": self.cotizante_id,
            "estado": self.estado,
            "edad": self.calcular_edad(),
        }
        if include_beneficiarios and self.tipo == "cotizante":
            bens = list(self.beneficiarios)
            for b in bens:
                b.verificar_inactivacion_por_edad()
            data["beneficiarios"] = [b.to_dict() for b in bens]
        return data
