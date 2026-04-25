"""
notification-service — OmniCitas (PLACEHOLDER)
Health endpoint only. RabbitMQ consumer planned for next iteration.
"""

from fastapi import FastAPI

app = FastAPI(
    title="OmniCitas — notification-service",
    description="Placeholder. Futuro: consumidor RabbitMQ + SMTP + SMS.",
    version="0.1.0",
)


@app.get("/api/health", tags=["Health"])
def health():
    return {
        "status": "ok"
    }
