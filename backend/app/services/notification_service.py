"""
Servicio de notificaciones — desacoplado del canal de origen.

Arquitectura:
  NotificationService (ABC)
       ├── LogNotificationService        ← desarrollo/testing (solo logs)
       ├── WhatsAppNotificationService   ← stub listo para Twilio/Meta API
       └── EmailNotificationService      ← stub listo para SendGrid/SMTP

Uso en rutas:
    from app.services.notification_service import get_notification_service
    notif = get_notification_service()
    notif.confirmar_cita(afiliado, cita)

Para cambiar de implementación: ajustar NOTIFICATION_BACKEND en .env.
"""

import os
import logging
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


# ── Interfaz abstracta ─────────────────────────────────────────────────────────

class NotificationService(ABC):
    """Contrato que deben cumplir todos los adaptadores de notificación."""

    @abstractmethod
    def confirmar_cita(self, afiliado, cita) -> None:
        """Notifica al afiliado que su cita fue agendada."""

    @abstractmethod
    def cancelar_cita(self, afiliado, cita) -> None:
        """Notifica al afiliado que su cita fue cancelada."""

    @abstractmethod
    def recordatorio_cita(self, afiliado, cita) -> None:
        """Envía recordatorio 24 h antes de la cita."""


# ── Implementación de desarrollo (log) ────────────────────────────────────────

class LogNotificationService(NotificationService):
    """Registra en el log en vez de enviar mensajes reales. Útil para dev/test."""

    def confirmar_cita(self, afiliado, cita) -> None:
        logger.info(
            "[NOTIF] Confirmación | afiliado=%s | cita=#%s | canal=%s | fecha=%s %s",
            afiliado.nombres, cita.id, cita.canal, cita.fecha, cita.hora_inicio,
        )

    def cancelar_cita(self, afiliado, cita) -> None:
        logger.info(
            "[NOTIF] Cancelación | afiliado=%s | cita=#%s | fecha=%s",
            afiliado.nombres, cita.id, cita.fecha,
        )

    def recordatorio_cita(self, afiliado, cita) -> None:
        logger.info(
            "[NOTIF] Recordatorio | afiliado=%s | cita=#%s | mañana %s",
            afiliado.nombres, cita.id, cita.hora_inicio,
        )


# ── Implementación WhatsApp (stub — listo para activar) ───────────────────────

class WhatsAppNotificationService(NotificationService):
    """
    Envía mensajes vía WhatsApp Business API (Twilio como gateway).

    Para activar:
        pip install twilio
        TWILIO_ACCOUNT_SID=ACxxx
        TWILIO_AUTH_TOKEN=yyy
        TWILIO_WHATSAPP_FROM=+14155238886
    """

    def __init__(self, account_sid: str, auth_token: str, from_number: str):
        self.account_sid  = account_sid
        self.auth_token   = auth_token
        self.from_number  = from_number

    def confirmar_cita(self, afiliado, cita) -> None:
        mensaje = (
            f"✅ *OmniCitas* — Cita confirmada\n"
            f"Paciente: {afiliado.nombres} {afiliado.apellidos}\n"
            f"Especialidad: {cita.especialidad.nombre}\n"
            f"Médico: {cita.medico.nombre}\n"
            f"Fecha: {cita.fecha}  Hora: {cita.hora_inicio}\n"
            f"Sede: {cita.sede.nombre}"
        )
        self._enviar(afiliado.telefono, mensaje)

    def cancelar_cita(self, afiliado, cita) -> None:
        mensaje = (
            f"❌ *OmniCitas* — Cita cancelada\n"
            f"La cita del {cita.fecha} a las {cita.hora_inicio} fue cancelada."
        )
        self._enviar(afiliado.telefono, mensaje)

    def recordatorio_cita(self, afiliado, cita) -> None:
        mensaje = (
            f"🔔 *OmniCitas* — Recordatorio\n"
            f"Mañana tienes cita a las {cita.hora_inicio} con {cita.medico.nombre}."
        )
        self._enviar(afiliado.telefono, mensaje)

    def _enviar(self, telefono: str, mensaje: str) -> None:
        # Descomentar cuando Twilio esté configurado:
        # from twilio.rest import Client
        # Client(self.account_sid, self.auth_token).messages.create(
        #     from_=f"whatsapp:{self.from_number}",
        #     to=f"whatsapp:{telefono}",
        #     body=mensaje,
        # )
        logger.info("[WhatsApp → %s] %s", telefono, mensaje[:60])


# ── Implementación Email (stub) ────────────────────────────────────────────────

class EmailNotificationService(NotificationService):
    """
    Envía correos vía SMTP o SendGrid.

    Para activar:
        SMTP_HOST=smtp.gmail.com  SMTP_PORT=587
        SMTP_USER=noreply@omnicitas.com  SMTP_PASS=xxx
    """

    def confirmar_cita(self, afiliado, cita) -> None:
        asunto = f"OmniCitas — Cita confirmada el {cita.fecha}"
        cuerpo = (
            f"Hola {afiliado.nombres},\n\n"
            f"Tu cita ha sido agendada:\n"
            f"  Especialidad : {cita.especialidad.nombre}\n"
            f"  Médico       : {cita.medico.nombre}\n"
            f"  Fecha / Hora : {cita.fecha} {cita.hora_inicio}\n"
            f"  Sede         : {cita.sede.nombre}\n\n"
            f"Recuerda llegar 10 minutos antes.\n\nOmniCitas"
        )
        self._enviar(afiliado.correo, asunto, cuerpo)

    def cancelar_cita(self, afiliado, cita) -> None:
        asunto = "OmniCitas — Cita cancelada"
        cuerpo = f"Hola {afiliado.nombres}, tu cita del {cita.fecha} fue cancelada."
        self._enviar(afiliado.correo, asunto, cuerpo)

    def recordatorio_cita(self, afiliado, cita) -> None:
        asunto = "OmniCitas — Recordatorio de cita"
        cuerpo = f"Hola {afiliado.nombres}, mañana tienes cita a las {cita.hora_inicio}."
        self._enviar(afiliado.correo, asunto, cuerpo)

    def _enviar(self, correo: str, asunto: str, cuerpo: str) -> None:
        # Descomentar cuando SMTP esté configurado:
        # import smtplib
        # from email.mime.text import MIMEText
        # msg = MIMEText(cuerpo); msg["Subject"] = asunto
        # msg["From"] = os.environ["SMTP_USER"]; msg["To"] = correo
        # with smtplib.SMTP(os.environ["SMTP_HOST"], int(os.environ["SMTP_PORT"])) as s:
        #     s.starttls(); s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"])
        #     s.send_message(msg)
        logger.info("[Email → %s] %s", correo, asunto)


# ── Factory: selecciona implementación según variable de entorno ───────────────

def get_notification_service() -> NotificationService:
    """
    Retorna la implementación configurada vía NOTIFICATION_BACKEND.

    Valores válidos:
        log        → LogNotificationService  (default)
        whatsapp   → WhatsAppNotificationService
        email      → EmailNotificationService
    """
    backend = os.environ.get("NOTIFICATION_BACKEND", "log").lower()

    if backend == "whatsapp":
        return WhatsAppNotificationService(
            account_sid=os.environ["TWILIO_ACCOUNT_SID"],
            auth_token=os.environ["TWILIO_AUTH_TOKEN"],
            from_number=os.environ["TWILIO_WHATSAPP_FROM"],
        )
    if backend == "email":
        return EmailNotificationService()

    return LogNotificationService()
