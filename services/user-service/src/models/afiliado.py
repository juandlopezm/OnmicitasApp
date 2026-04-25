"""
Afiliado — perfil de usuario sin credenciales.
Las credenciales (password_hash) viven en auth-service/user_credentials.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Index, Integer, String, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from src.config.database import Base


class Afiliado(Base):
    __tablename__ = "afiliados"

    __table_args__ = (
        # Admin list: filter by tipo (cotizante/beneficiario) + estado (activo/inactivo)
        Index("ix_afiliados_tipo_estado", "tipo", "estado"),
        # Beneficiary tree: fetch all dependents of a cotizante in one scan
        Index("ix_afiliados_cotizante_id", "cotizante_id"),
        # Alphabetical listing: admin view always orders by apellidos
        Index("ix_afiliados_apellidos", "apellidos"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    tipo_documento = Column(String(10), nullable=False)
    numero_documento = Column(String(20), nullable=False, unique=True)
    nombres = Column(String(100), nullable=False)
    apellidos = Column(String(100), nullable=False)
    genero = Column(String(1))  # M / F / O
    fecha_nacimiento = Column(Date)
    telefono = Column(String(20))
    departamento = Column(String(60))
    ciudad = Column(String(60))
    ips_medica = Column(String(120))
    tipo = Column(String(20), nullable=False, default="cotizante")  # cotizante | beneficiario
    cotizante_id = Column(Integer, ForeignKey("afiliados.id"), nullable=True)
    estado = Column(String(20), nullable=False, default="activo")
    creado_en = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    actualizado_en = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    beneficiarios = relationship(
        "Afiliado",
        foreign_keys=[cotizante_id],
        back_populates="cotizante",
        lazy="select",
    )
    cotizante = relationship(
        "Afiliado",
        foreign_keys=[cotizante_id],
        remote_side=[id],
        back_populates="beneficiarios",
        lazy="select",
    )

    def to_dict(self, include_beneficiarios: bool = False) -> dict:
        data = {
            "id": self.id,
            "tipo_documento": self.tipo_documento,
            "numero_documento": self.numero_documento,
            "nombres": self.nombres,
            "apellidos": self.apellidos,
            "genero": self.genero,
            "fecha_nacimiento": str(self.fecha_nacimiento) if self.fecha_nacimiento else None,
            "telefono": self.telefono,
            "departamento": self.departamento,
            "ciudad": self.ciudad,
            "ips_medica": self.ips_medica,
            "tipo": self.tipo,
            "cotizante_id": self.cotizante_id,
            "estado": self.estado,
            "creado_en": self.creado_en.isoformat() if self.creado_en else None,
            "actualizado_en": self.actualizado_en.isoformat() if self.actualizado_en else None,
        }
        if include_beneficiarios:
            data["beneficiarios"] = [b.to_dict() for b in self.beneficiarios]
        return data
