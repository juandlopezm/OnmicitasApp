"""
Servicio de lógica de negocio para citas médicas.

Reglas:
- Solo cotizantes activos pueden agendar.
- Una cita puede ser para el cotizante mismo o para un beneficiario a su cargo.
- Cancelar/reagendar: solo con > 24 horas de anticipación.
- Al cancelar: liberar horario; la cita queda en BD con estado='cancelada'.
- Al reagendar: liberar slot anterior, bloquear nuevo (previa verificación disponibilidad).
- Un slot ocupado no puede ser asignado a otro usuario.
"""

from datetime import datetime, timedelta
from app.extensions import db
from app.models.cita import Cita
from app.models.horario import Horario
from app.models.afiliado import Afiliado


def _puede_modificar(cita: Cita) -> bool:
    """Valida la regla de > 24 horas de anticipación."""
    fecha_hora_cita = datetime.combine(cita.fecha, cita.hora_inicio)
    return (fecha_hora_cita - datetime.now()) > timedelta(hours=24)


def crear_cita(
    afiliado_id: int,
    horario_id: int,
    especialidad_id: int,
    sede_id: int,
    beneficiario_id: int | None = None,
    notas: str | None = None,
    es_admin: bool = False,
    canal: str = "web",
) -> tuple[Cita | None, str | None]:
    """
    Crea una nueva cita bloqueando el horario seleccionado.
    Retorna (cita, None) en éxito o (None, mensaje_error) en fallo.
    es_admin=True omite la restricción de 24 horas.
    """
    afiliado = Afiliado.query.get(afiliado_id)
    if not afiliado or afiliado.tipo != "cotizante" or afiliado.estado != "activo":
        return None, "Afiliado no válido para agendar citas"

    if beneficiario_id:
        beneficiario = Afiliado.query.get(beneficiario_id)
        if not beneficiario:
            return None, "Beneficiario no encontrado"
        if beneficiario.cotizante_id != afiliado_id:
            return None, "El beneficiario no pertenece a este cotizante"
        if beneficiario.estado != "activo":
            return None, "El beneficiario no está activo"

    horario = Horario.query.with_for_update().get(horario_id)
    if not horario:
        return None, "Horario no encontrado"
    if horario.estado == "ocupado":
        return None, "Este horario ya no está disponible"

    # Verificar regla de 24 horas (solo para afiliados; el admin puede omitirla)
    if not es_admin:
        fecha_hora = datetime.combine(horario.fecha, horario.hora_inicio)
        if (fecha_hora - datetime.now()) <= timedelta(hours=24):
            return None, "Solo se pueden agendar citas con más de 24 horas de anticipación"

    # Bloquear slot
    horario.estado = "ocupado"

    cita = Cita(
        afiliado_id=afiliado_id,
        beneficiario_id=beneficiario_id,
        medico_id=horario.medico_id,
        especialidad_id=especialidad_id,
        sede_id=sede_id,
        horario_id=horario_id,
        fecha=horario.fecha,
        hora_inicio=horario.hora_inicio,
        estado="programada",
        canal=canal,
        notas=notas,
    )
    db.session.add(cita)
    db.session.commit()
    return cita, None


def cancelar_cita(cita_id: int, afiliado_id: int, es_admin: bool = False) -> tuple[bool, str | None]:
    """
    Cancela una cita y libera el horario.
    El registro queda con estado='cancelada' para el historial.
    """
    cita = Cita.query.get(cita_id)
    if not cita:
        return False, "Cita no encontrada"

    if not es_admin and cita.afiliado_id != afiliado_id:
        return False, "No tienes permiso para cancelar esta cita"

    if cita.estado in ("cancelada", "completada"):
        return False, f"La cita ya está {cita.estado}"

    if not es_admin and not _puede_modificar(cita):
        return False, "No se puede cancelar con menos de 24 horas de anticipación"

    # Liberar el slot para que otros puedan agendar
    horario = Horario.query.get(cita.horario_id)
    if horario:
        horario.estado = "disponible"

    cita.estado = "cancelada"
    db.session.commit()
    return True, None


def reagendar_cita(
    cita_id: int,
    afiliado_id: int,
    nuevo_horario_id: int,
    nueva_sede_id: int,
) -> tuple[Cita | None, str | None]:
    """
    Reagenda una cita: libera slot antiguo y bloquea el nuevo.
    """
    cita = Cita.query.get(cita_id)
    if not cita:
        return None, "Cita no encontrada"

    if cita.afiliado_id != afiliado_id:
        return None, "No tienes permiso para reagendar esta cita"

    if cita.estado not in ("programada", "confirmada"):
        return None, f"No se puede reagendar una cita con estado '{cita.estado}'"

    if not _puede_modificar(cita):
        return None, "No se puede reagendar con menos de 24 horas de anticipación"

    # Verificar nuevo horario con lock de fila para evitar race condition
    nuevo_horario = Horario.query.with_for_update().get(nuevo_horario_id)
    if not nuevo_horario:
        return None, "El nuevo horario no existe"
    if nuevo_horario.estado == "ocupado":
        return None, "El horario seleccionado ya no está disponible"
    if nuevo_horario.medico_id != cita.medico_id:
        return None, "El nuevo horario debe ser del mismo médico"

    # Verificar regla de 24 horas para el nuevo slot
    fecha_hora_nuevo = datetime.combine(nuevo_horario.fecha, nuevo_horario.hora_inicio)
    if (fecha_hora_nuevo - datetime.now()) <= timedelta(hours=24):
        return None, "El nuevo horario debe ser con más de 24 horas de anticipación"

    # Liberar slot antiguo
    horario_anterior = Horario.query.get(cita.horario_id)
    if horario_anterior:
        horario_anterior.estado = "disponible"

    # Bloquear slot nuevo
    nuevo_horario.estado = "ocupado"

    # Actualizar cita
    cita.horario_id = nuevo_horario_id
    cita.sede_id = nueva_sede_id
    cita.fecha = nuevo_horario.fecha
    cita.hora_inicio = nuevo_horario.hora_inicio
    cita.estado = "reagendada"

    db.session.commit()
    return cita, None


def get_citas_activas_afiliado(afiliado_id: int) -> list[Cita]:
    """Citas pendientes (programada/confirmada) del afiliado y sus beneficiarios."""
    return (
        Cita.query.filter(
            Cita.afiliado_id == afiliado_id,
            Cita.estado.in_(["programada", "confirmada", "reagendada"]),
        )
        .order_by(Cita.fecha, Cita.hora_inicio)
        .all()
    )


def get_historial_afiliado(afiliado_id: int) -> list[Cita]:
    """Historial completo (todos los estados) del afiliado y sus beneficiarios."""
    return (
        Cita.query.filter(Cita.afiliado_id == afiliado_id)
        .order_by(Cita.fecha.desc(), Cita.hora_inicio.desc())
        .all()
    )
