"""
SchedulingService — Saga pattern for appointment scheduling.

Saga steps:
  1. Validate afiliado → user-service (Circuit Breaker)
  2. Get horario details → medical-service
  3. Lock horario → medical-service PATCH /internal/horarios/{id}/ocupar (SELECT FOR UPDATE)
  4. INSERT cita
  5. If INSERT fails → compensate: liberar horario
  6. Publish cita.created to RabbitMQ (best-effort)
"""

from datetime import date, datetime, timezone, timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException

from src.models.cita import Cita
from src.repositories.cita_repository import CitaRepository
from src.clients import medical_client, user_client
from src.services import event_publisher


class SchedulingService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = CitaRepository(db)

    def agendar(self, afiliado_id: int, body: dict, admin: bool = False) -> dict:
        horario_id = body["horario_id"]

        # Step 1 — Validate afiliado
        afiliado, err = user_client.get_user(afiliado_id)
        if err:
            raise HTTPException(status_code=503, detail=err)

        # Validate beneficiario if provided
        beneficiario_id = body.get("beneficiario_id")
        beneficiario = None
        if beneficiario_id:
            beneficiario, err = user_client.get_user(beneficiario_id)
            if err:
                raise HTTPException(status_code=503, detail=err)

        # Step 1b — Duplicate check: same patient + same specialty already active
        especialidad_id = body.get("especialidad_id", 0)
        if self.repo.existe_cita_activa_para_especialidad(afiliado_id, especialidad_id, beneficiario_id):
            quien = "el beneficiario" if beneficiario_id else "usted"
            raise HTTPException(
                status_code=409,
                detail=f"Ya existe una cita activa para esta especialidad para {quien}. "
                       "Cancele la cita existente antes de agendar una nueva.",
            )

        # Step 2 — Get horario details
        horario = medical_client.get_horario(horario_id)
        if not horario:
            raise HTTPException(
                status_code=503, detail="Servicio médico en mantenimiento. Intente más tarde."
            )

        # 24h advance check (skip for admin)
        if not admin:
            fecha_cita = date.fromisoformat(horario["fecha"])
            ahora = datetime.now(timezone.utc)
            if datetime.combine(fecha_cita, datetime.min.time()).replace(tzinfo=timezone.utc) - ahora < timedelta(hours=24):
                raise HTTPException(
                    status_code=422, detail="Las citas deben agendarse con al menos 24 horas de anticipación"
                )

        # Step 3 — Lock horario (Saga step)
        locked, err = medical_client.ocupar_horario(horario_id)
        if err:
            raise HTTPException(status_code=409, detail=err)

        # Step 4 — INSERT cita
        paciente = beneficiario or afiliado
        paciente_nombre = f"{paciente.get('nombres', '')} {paciente.get('apellidos', '')}".strip()

        try:
            cita = Cita(
                afiliado_id=afiliado_id,
                beneficiario_id=beneficiario_id,
                medico_id=horario["medico_id"],
                especialidad_id=body.get("especialidad_id", 0),
                sede_id=horario["sede_id"],
                horario_id=horario_id,
                paciente_nombre=paciente_nombre,
                medico_nombre=body.get("medico_nombre", ""),
                especialidad_nombre=body.get("especialidad_nombre", ""),
                sede_nombre=body.get("sede_nombre", ""),
                fecha=date.fromisoformat(horario["fecha"]),
                hora_inicio=horario["hora_inicio"],
                hora_fin=horario["hora_fin"],
                estado="programada",
                canal=body.get("canal", "web"),
                notas=body.get("notas"),
            )
            cita = self.repo.save(cita)
        except Exception as exc:
            # Step 5 — Compensate: release horario
            medical_client.liberar_horario(horario_id)
            raise HTTPException(status_code=500, detail="Error al registrar la cita") from exc

        # Step 6 — Publish event (best-effort)
        event_publisher.cita_created(cita.to_dict())

        return cita.to_dict()

    def cancelar(self, cita_id: int, afiliado_id: int | None = None, admin: bool = False) -> dict:
        cita = self.repo.find_by_id(cita_id)
        if not cita:
            raise HTTPException(status_code=404, detail="Cita no encontrada")

        if afiliado_id and cita.afiliado_id != afiliado_id:
            raise HTTPException(status_code=403, detail="No puedes cancelar una cita de otro afiliado")

        if not admin:
            ahora = datetime.now(timezone.utc)
            fecha_cita = datetime.combine(cita.fecha, cita.hora_inicio).replace(tzinfo=timezone.utc)
            if fecha_cita - ahora < timedelta(hours=24):
                raise HTTPException(
                    status_code=422, detail="Solo se puede cancelar con al menos 24 horas de anticipación"
                )

        cita.estado = "cancelada"
        self.repo.commit()

        # Release horario (best-effort)
        medical_client.liberar_horario(cita.horario_id)
        event_publisher.cita_cancelled(cita.to_dict())

        return cita.to_dict()

    def reagendar(self, cita_id: int, body: dict, afiliado_id: int | None = None, admin: bool = False) -> dict:
        cita = self.repo.find_by_id(cita_id)
        if not cita:
            raise HTTPException(status_code=404, detail="Cita no encontrada")

        if afiliado_id and cita.afiliado_id != afiliado_id:
            raise HTTPException(status_code=403, detail="No puedes reagendar una cita de otro afiliado")

        if not admin:
            ahora = datetime.now(timezone.utc)
            fecha_cita = datetime.combine(cita.fecha, cita.hora_inicio).replace(tzinfo=timezone.utc)
            if fecha_cita - ahora < timedelta(hours=24):
                raise HTTPException(
                    status_code=422, detail="Solo se puede reagendar con al menos 24 horas de anticipación"
                )

        nuevo_horario_id = body["horario_id"]
        nuevo_horario = medical_client.get_horario(nuevo_horario_id)
        if not nuevo_horario:
            raise HTTPException(status_code=503, detail="No se pudo obtener el nuevo horario")

        # Lock new slot
        locked, err = medical_client.ocupar_horario(nuevo_horario_id)
        if err:
            raise HTTPException(status_code=409, detail=err)

        # Release old slot — from this point on the Saga is in-flight
        old_horario_id = cita.horario_id
        medical_client.liberar_horario(old_horario_id)

        # Update cita — wrap commit so we can compensate if it fails
        cita.horario_id = nuevo_horario_id
        cita.fecha = date.fromisoformat(nuevo_horario["fecha"])
        cita.hora_inicio = nuevo_horario["hora_inicio"]
        cita.hora_fin = nuevo_horario["hora_fin"]
        cita.sede_id = nuevo_horario["sede_id"]
        try:
            self.repo.commit()
        except Exception as exc:
            # Saga compensation: release the new slot (it was locked but cita wasn't updated)
            # and attempt to re-lock the old slot (best-effort; may fail if already taken)
            medical_client.liberar_horario(nuevo_horario_id)
            medical_client.ocupar_horario(old_horario_id)
            raise HTTPException(status_code=500, detail="Error al reagendar la cita") from exc

        event_publisher.cita_rescheduled(cita.to_dict())
        return cita.to_dict()
