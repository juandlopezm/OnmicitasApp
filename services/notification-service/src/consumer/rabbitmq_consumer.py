"""
RabbitMQ Consumer — PLACEHOLDER (not active).
Future implementation: consume cita.created / cita.cancelled events
and send SMTP email + SMS notifications.
"""

# TODO: Implement in next iteration
# import pika
# import json
# from src.config.settings import settings
#
# def start_consumer():
#     params = pika.URLParameters(settings.RABBITMQ_URL)
#     conn = pika.BlockingConnection(params)
#     channel = conn.channel()
#     channel.exchange_declare(exchange="omnicitas.events", exchange_type="topic", durable=True)
#     queue = channel.queue_declare("notification-service", durable=True)
#     channel.queue_bind(queue.method.queue, "omnicitas.events", "cita.*")
#     channel.basic_consume(queue.method.queue, on_message_callback=_handle, auto_ack=False)
#     channel.start_consuming()
#
# def _handle(channel, method, properties, body):
#     event = json.loads(body)
#     # ... send email/SMS
#     channel.basic_ack(method.delivery_tag)
