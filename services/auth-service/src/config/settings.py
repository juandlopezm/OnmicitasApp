import os

class Settings:
    DATABASE_URL: str = os.environ.get(
        "DATABASE_URL",
        "postgresql://omnicitas_user:omnicitas_pass@db-auth:5432/omnicitas_auth",
    )
    PRIVATE_KEY_PATH: str = os.environ.get("PRIVATE_KEY_PATH", "/app/keys/private.pem")
    PUBLIC_KEY_PATH: str = os.environ.get("PUBLIC_KEY_PATH", "/app/keys/public.pem")
    JWT_ALGORITHM: str = "RS256"
    JWT_EXPIRE_HOURS: int = int(os.environ.get("JWT_EXPIRE_HOURS", "8"))
    JWT_ISSUER: str = "omnicitas-auth"
    USER_SERVICE_URL: str = os.environ.get("USER_SERVICE_URL", "http://user-service:8002")

settings = Settings()
