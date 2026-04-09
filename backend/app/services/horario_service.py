"""
Servicio de generación y gestión de horarios.

Reglas:
- Slots generados según jornada laboral del médico (días y horas).
- Duración del slot: especialidad.duracion_minutos.
- Excluye días no hábiles y fines de semana (sábado/domingo) si no están en jornada.
- Mínimo 24 horas de anticipación para agendar.
- Un slot bloqueado no puede ser asignado a otro usuario.
"""

from datetime import date, time, timedelta, datetime
from app.extensions import db
from app.models.medico import Medico, JornadaMedico
from app.models.horario import Horario
from app.models.dia_no_habil import DiaNoHabil


def generar_horarios_medico(medico_id: int, fecha_inicio: date, fecha_fin: date) -> dict:
    """
    Genera los bloques de horario disponibles para un médico en un rango de fechas.
    Retorna dict con slots creados y omitidos (duplicados).
    """
    medico = Medico.query.get(medico_id)
    if not medico or not medico.activo:
        return {"error": "Médico no encontrado o inactivo"}

    duracion = medico.especialidad.duracion_minutos

    # Obtener días no hábiles en el rango
    dias_no_habiles = {
        d.fecha
        for d in DiaNoHabil.query.filter(
            DiaNoHabil.fecha >= fecha_inicio, DiaNoHabil.fecha <= fecha_fin
        ).all()
    }

    # Obtener jornadas del médico indexadas por día de semana
    jornadas_por_dia: dict[int, list[JornadaMedico]] = {}
    for j in medico.jornadas:
        jornadas_por_dia.setdefault(j.dia_semana, []).append(j)

    creados = 0
    omitidos = 0
    fecha_actual = fecha_inicio

    while fecha_actual <= fecha_fin:
        # Día de semana Python: 0=Lunes, 6=Domingo
        dia_semana = fecha_actual.weekday()

        if fecha_actual in dias_no_habiles:
            fecha_actual += timedelta(days=1)
            continue

        if dia_semana not in jornadas_por_dia:
            fecha_actual += timedelta(days=1)
            continue

        for jornada in jornadas_por_dia[dia_semana]:
            hora_actual = datetime.combine(fecha_actual, jornada.hora_inicio)
            hora_limite = datetime.combine(fecha_actual, jornada.hora_fin)

            while hora_actual + timedelta(minutes=duracion) <= hora_limite:
                hora_fin_slot = hora_actual + timedelta(minutes=duracion)

                # Verificar si ya existe ese slot
                existe = Horario.query.filter_by(
                    medico_id=medico_id,
                    fecha=fecha_actual,
                    hora_inicio=hora_actual.time(),
                ).first()

                if not existe:
                    slot = Horario(
                        medico_id=medico_id,
                        fecha=fecha_actual,
                        hora_inicio=hora_actual.time(),
                        hora_fin=hora_fin_slot.time(),
                        estado="disponible",
                    )
                    db.session.add(slot)
                    creados += 1
                else:
                    omitidos += 1

                hora_actual += timedelta(minutes=duracion)

        fecha_actual += timedelta(days=1)

    db.session.commit()
    return {"creados": creados, "omitidos": omitidos}


def get_horarios_disponibles(medico_id: int, fecha: date) -> list[Horario]:
    """
    Retorna horarios disponibles para un médico en una fecha,
    respetando la regla de 24 horas de anticipación.
    """
    ahora = datetime.now()
    limite_anticipacion = ahora + timedelta(hours=24)

    horarios = (
        Horario.query.filter_by(medico_id=medico_id, fecha=fecha, estado="disponible")
        .order_by(Horario.hora_inicio)
        .all()
    )

    # Filtrar los que cumplen la regla de 24h
    return [
        h
        for h in horarios
        if datetime.combine(h.fecha, h.hora_inicio) > limite_anticipacion
    ]
