import { api } from '../../../api/apiClient'

// ── Types ──────────────────────────────────────────────────────────────────

export interface MedicoAdmin {
  id: string
  nombres: string
  apellidos: string
  nombre: string          // nombres + apellidos
  registroMedico: string
  especialidadId: string
  especialidadNombre: string
  activo: boolean
}

export interface JornadaAdmin {
  id: string
  medicoId: string
  sedeId: string
  diaSemana: number       // 0=Lun … 6=Dom
  horaInicio: string      // "HH:MM:SS"
  horaFin: string
  duracionCitaMin: number
}

export interface HorarioAdmin {
  id: string
  medicoId: string
  sedeId: string
  fecha: string           // "YYYY-MM-DD"
  horaInicio: string
  horaFin: string
  estado: 'disponible' | 'ocupado' | 'bloqueado'
}

export interface DiaNoHabilAdmin {
  id: string
  fecha: string
  descripcion: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const labelDia = (n: number) => DIAS_SEMANA[n] ?? `Día ${n}`

/** "08:00:00" → "08:00" */
export const trimHora = (h: string) => h.substring(0, 5)

/** "2025-01-15" → "15/01/2025" */
export const formatFechaCorta = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ── Médicos ────────────────────────────────────────────────────────────────

export async function getMedicosAdmin(): Promise<MedicoAdmin[]> {
  const data = await api.get<any[]>('/api/medicos')
  return data.map(m => ({
    id: String(m.id),
    nombres: m.nombres,
    apellidos: m.apellidos,
    nombre: `${m.nombres} ${m.apellidos}`.trim(),
    registroMedico: m.registro_medico ?? '',
    especialidadId: String(m.especialidad_id),
    especialidadNombre: m.especialidad_nombre ?? '',
    activo: m.activo ?? true,
  }))
}

// ── Jornadas ───────────────────────────────────────────────────────────────

export async function getJornadasMedico(medicoId: string): Promise<JornadaAdmin[]> {
  const data = await api.get<any>(`/api/medicos/${medicoId}`)
  return (data.jornadas ?? []).map((j: any) => ({
    id: String(j.id),
    medicoId: String(j.medico_id),
    sedeId: String(j.sede_id),
    diaSemana: j.dia_semana,
    horaInicio: j.hora_inicio,
    horaFin: j.hora_fin,
    duracionCitaMin: j.duracion_cita_min,
  }))
}

export async function agregarJornada(
  medicoId: string,
  jornada: { sedeId: string; diaSemana: number; horaInicio: string; horaFin: string; duracionCitaMin: number }
): Promise<JornadaAdmin> {
  const data = await api.post<any>(`/api/admin/medicos/${medicoId}/jornadas`, {
    sede_id:           Number(jornada.sedeId),
    dia_semana:        jornada.diaSemana,
    hora_inicio:       jornada.horaInicio,
    hora_fin:          jornada.horaFin,
    duracion_cita_min: jornada.duracionCitaMin,
  })
  return {
    id: String(data.id),
    medicoId: String(data.medico_id),
    sedeId: String(data.sede_id),
    diaSemana: data.dia_semana,
    horaInicio: data.hora_inicio,
    horaFin: data.hora_fin,
    duracionCitaMin: data.duracion_cita_min,
  }
}

export async function eliminarJornada(medicoId: string, jornadaId: string): Promise<void> {
  await api.delete(`/api/admin/medicos/${medicoId}/jornadas/${jornadaId}`)
}

// ── Horarios / Slots ───────────────────────────────────────────────────────

export async function getHorariosAdmin(medicoId: string): Promise<HorarioAdmin[]> {
  const data = await api.get<any[]>(`/api/admin/horarios?medico_id=${medicoId}`)
  return data.map(h => ({
    id: String(h.id),
    medicoId: String(h.medico_id),
    sedeId: String(h.sede_id),
    fecha: h.fecha,
    horaInicio: h.hora_inicio,
    horaFin: h.hora_fin,
    estado: h.estado as HorarioAdmin['estado'],
  }))
}

export async function generarHorarios(
  medicoId: string,
  desde: string,
  hasta: string
): Promise<number> {
  const data = await api.post<{ mensaje: string }>('/api/admin/horarios/generar', {
    medico_id: Number(medicoId),
    desde,
    hasta,
  })
  const match = data.mensaje.match(/\d+/)
  return match ? Number(match[0]) : 0
}

export async function eliminarHorario(horarioId: string): Promise<void> {
  await api.delete(`/api/admin/horarios/${horarioId}`)
}

// ── Días no hábiles ────────────────────────────────────────────────────────

export async function getDiasNoHabiles(): Promise<DiaNoHabilAdmin[]> {
  const data = await api.get<any[]>('/api/admin/horarios/dias-no-habiles')
  return data.map(d => ({
    id: String(d.id),
    fecha: d.fecha,
    descripcion: d.descripcion ?? '',
  }))
}

export async function agregarDiaNoHabil(fecha: string, descripcion: string): Promise<DiaNoHabilAdmin> {
  const data = await api.post<any>('/api/admin/horarios/dias-no-habiles', { fecha, descripcion })
  return { id: String(data.id), fecha: data.fecha, descripcion: data.descripcion ?? '' }
}

export async function eliminarDiaNoHabil(id: string): Promise<void> {
  await api.delete(`/api/admin/horarios/dias-no-habiles/${id}`)
}
