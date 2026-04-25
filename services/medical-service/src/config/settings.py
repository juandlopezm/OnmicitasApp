import os


class Settings:
    DATABASE_URL: str = os.environ.get(
        "DATABASE_URL",
        "postgresql://omnicitas:omnicitas123@db-medical:5432/omnicitas_medical",
    )
    PUBLIC_KEY_PATH: str = os.environ.get("PUBLIC_KEY_PATH", "/app/keys/public.pem")
    JWT_ALGORITHM: str = "RS256"


settings = Settings()
