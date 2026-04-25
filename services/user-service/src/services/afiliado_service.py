"""
AfiliadoService — business logic for profile management.
"""

from fastapi import HTTPException
from src.models.afiliado import Afiliado
from src.repositories.afiliado_repository import AfiliadoRepository


class AfiliadoService:
    def __init__(self, repo: AfiliadoRepository):
        self.repo = repo

    def listar(self, tipo: str | None = None, estado: str | None = None) -> list[dict]:
        return [a.to_dict() for a in self.repo.list_all(tipo=tipo, estado=estado)]

    def obtener(self, afiliado_id: int, include_beneficiarios: bool = False) -> dict:
        afiliado = self.repo.find_by_id(afiliado_id)
        if not afiliado:
            raise HTTPException(status_code=404, detail="Afiliado no encontrado")
        return afiliado.to_dict(include_beneficiarios=include_beneficiarios)

    def crear(self, data: dict) -> dict:
        # Validate documento uniqueness
        existing = self.repo.find_by_documento(
            data["tipo_documento"], data["numero_documento"]
        )
        if existing:
            raise HTTPException(
                status_code=409, detail="Ya existe un afiliado con ese documento"
            )

        # Validate beneficiario reference
        if data.get("tipo") == "beneficiario" and not data.get("cotizante_id"):
            raise HTTPException(
                status_code=422, detail="Los beneficiarios deben tener un cotizante_id"
            )

        if data.get("cotizante_id"):
            cotizante = self.repo.find_by_id(data["cotizante_id"])
            if not cotizante or cotizante.tipo != "cotizante":
                raise HTTPException(status_code=404, detail="Cotizante no encontrado")

        afiliado = Afiliado(**{k: v for k, v in data.items() if hasattr(Afiliado, k)})
        return self.repo.save(afiliado).to_dict()

    def actualizar(self, afiliado_id: int, data: dict) -> dict:
        afiliado = self.repo.find_by_id(afiliado_id)
        if not afiliado:
            raise HTTPException(status_code=404, detail="Afiliado no encontrado")

        allowed = {
            "nombres", "apellidos", "genero", "fecha_nacimiento",
            "telefono", "departamento", "ciudad", "ips_medica", "estado",
        }
        for field in allowed:
            if field in data:
                setattr(afiliado, field, data[field])

        self.repo.commit()
        return afiliado.to_dict()

    def eliminar(self, afiliado_id: int) -> dict:
        afiliado = self.repo.find_by_id(afiliado_id)
        if not afiliado:
            raise HTTPException(status_code=404, detail="Afiliado no encontrado")
        self.repo.delete(afiliado)
        return {"mensaje": "Afiliado eliminado"}
