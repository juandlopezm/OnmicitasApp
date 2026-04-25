"""
AuthService — authentication and registration business logic.
Follows SRP: delegates token creation to token_service, DB access to repositories.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.models.admin_usuario import AdminUsuario
from src.models.user_credential import UserCredential
from src.repositories.admin_repository import AdminRepository
from src.repositories.credential_repository import CredentialRepository
from src.services import token_service
from src.services import user_client


class AdminAuthService:
    def __init__(self, repo: AdminRepository):
        self.repo = repo

    def login(self, email: str, password: str) -> dict:
        admin = self.repo.find_by_email(email)
        if not admin or not admin.check_password(password):
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
        token = token_service.create_token(subject=admin.id, role="admin")
        return {"token": token, "admin": admin.to_dict()}

    def get_me(self, admin_id: int) -> dict:
        admin = self.repo.find_by_id(admin_id)
        if not admin:
            raise HTTPException(status_code=404, detail="Administrador no encontrado")
        return admin.to_dict()


class AfiliadoAuthService:
    def __init__(self, credential_repo: CredentialRepository):
        self.repo = credential_repo

    def login(self, tipo_documento: str, numero_documento: str, password: str) -> dict:
        cred = self.repo.find_by_documento(tipo_documento, numero_documento)
        if not cred or not cred.check_password(password):
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
        if not cred.activo:
            raise HTTPException(status_code=403, detail="Cuenta inactiva")

        # Fetch profile from user-service (with circuit breaker)
        perfil = user_client.get_user(cred.user_id) if cred.user_id else None

        token = token_service.create_token(
            subject=cred.user_id or cred.id,
            role="afiliado",
            tipo=perfil.get("tipo", "cotizante") if perfil else "cotizante",
        )
        return {"token": token, "afiliado": perfil or cred.to_dict()}

    def register(
        self, tipo_documento: str, numero_documento: str, correo: str, password: str
    ) -> dict:
        if len(password) < 6:
            raise HTTPException(status_code=422, detail="La contraseña debe tener al menos 6 caracteres")

        existing = self.repo.find_by_documento(tipo_documento, numero_documento)
        if existing:
            raise HTTPException(status_code=409, detail="Ya existe una cuenta para este documento")

        if correo and self.repo.find_by_correo(correo):
            raise HTTPException(status_code=409, detail="El correo ya está registrado")

        # Verify afiliado exists in user-service
        perfil = user_client.get_user_by_documento(tipo_documento, numero_documento)
        if not perfil:
            raise HTTPException(
                status_code=404,
                detail="Afiliado no registrado en el sistema. Contacte a su administrador.",
            )
        if perfil.get("tipo") != "cotizante":
            raise HTTPException(status_code=403, detail="Solo los cotizantes pueden registrarse")

        cred = UserCredential(
            tipo_documento=tipo_documento,
            numero_documento=numero_documento,
            correo=correo,
            role="afiliado",
            user_id=perfil["id"],
            activo=True,
        )
        cred.set_password(password)
        cred = self.repo.save(cred)

        token = token_service.create_token(
            subject=perfil["id"], role="afiliado", tipo=perfil.get("tipo", "cotizante")
        )
        return {"token": token, "afiliado": perfil}

    def get_me(self, user_id: int) -> dict:
        perfil = user_client.get_user(user_id)
        if not perfil:
            raise HTTPException(status_code=503, detail="Servicio de usuarios no disponible")
        return perfil
