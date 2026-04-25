"""
EventPublisher — publishes appointment events to RabbitMQ.
Best-effort: failures are logged but do not block the business transaction.
"""

import json
import logging
import pika
from src.config.settings import settings

logger = logging.getLogger(__name__)
_EXCHANGE = "omnicitas.events"


def _get_connection():
    params = pika.URLParameters(settings.RABBITMQ_URL)
    return pika.BlockingConnection(params)


def publish(routing_key: str, payload: dict) -> None:
    """Best-effort publish — swallows all exceptions."""
    try:
        conn = _get_connection()
        channel = conn.channel()
        channel.exchange_declare(exchange=_EXCHANGE, exchange_type="topic", durable=True)
        channel.basic_publish(
            exchange=_EXCHANGE,
            routing_key=routing_key,
            body=json.dumps(payload),
            properties=pika.BasicProperties(
                delivery_mode=2,  # persistent
                content_type="application/json",
            ),
        )
        conn.close()
        logger.info(f"[EventPublisher] Published {routing_key}: cita_id={payload.get('id')}")
    except Exception as exc:
        logger.warning(f"[EventPublisher] Failed to publish {routing_key}: {exc}")


def cita_created(cita: dict) -> None:
    publish("cita.created", cita)


def cita_cancelled(cita: dict) -> None:
    publish("cita.cancelled", cita)


def cita_rescheduled(cita: dict) -> None:
    publish("cita.rescheduled", cita)
