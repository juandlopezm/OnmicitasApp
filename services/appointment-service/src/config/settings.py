import os


class Settings:
    DATABASE_URL: str = os.environ.get(
        "DATABASE_URL",
        "postgresql://omnicitas:omnicitas123@db-appointments:5432/omnicitas_appointments",
    )
    PUBLIC_KEY_PATH: str = os.environ.get("PUBLIC_KEY_PATH", "/app/keys/public.pem")
    JWT_ALGORITHM: str = "RS256"
    MEDICAL_SERVICE_URL: str = os.environ.get("MEDICAL_SERVICE_URL", "http://medical-service:8004")
    USER_SERVICE_URL: str = os.environ.get("USER_SERVICE_URL", "http://user-service:8002")
    RABBITMQ_URL: str = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")


settings = Settings()
