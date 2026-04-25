import { api } from '../../../api/apiClient'

// ── Types ──────────────────────────────────────────────────────────────────

export interface MedicoAdmin {
  id: string
  nombres: string
  apellidos: string
  nombre: string
  registroMedico: string
  especialidadId: string
  especialidadNombre: string
  activo: boolean
  jornadas?: JornadaAdmin[]
}

export interface JornadaAdmin {
  id: string
  medicoId: string
  sedeId: string
  diaSemana: number
  horaInicio: string
  horaFin: string
  duracionCitaMin: number
}

export interface SedeAdmin {
  id: string
  nombre: string
  ciudad: string
  direccion: string
  activa: boolean
  horaApertura: string | null
  horaCierre: string | null
}

export interface EspecialidadAdmin {
  id: string
  nombre: string
  descripcion: string
  activa: boolean
  duracionMin: number
  modalidad: 'presencial' | 'telemedicina' | 'ambas'
}

export interface CitaAdmin {
  id: string
  afiliadoId: string
  medicoId: string
  medicoNombre: string
  especialidadNombre: string
  sedeNombre: string
  pacienteNombre: string
  fecha: string
  horaInicio: string
  horaFin: string
  estado: string
  canal: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const labelDia = (n: number) => DIAS_SEMANA[n] ?? `Día ${n}`
export const trimHora = (h: string) => h.substring(0, 5)
export const formatFecha = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ── Médicos ────────────────────────────────────────────────────────────────

function mapMedico(m: any): MedicoAdmin {
  return {
    id: String(m.id),
    nombres: m.nombres,
    apellidos: m.apellidos,
    nombre: `${m.nombres} ${m.apellidos}`.trim(),
    registroMedico: m.registro_medico ?? '',
    especialidadId: String(m.especialidad_id),
    especialidadNombre: m.especialidad_nombre ?? '',
    activo: m.activo ?? true,
    jornadas: m.jornadas?.map(mapJornada),
  }
}

function mapJornada(j: any): JornadaAdmin {
  return {
    id: String(j.id),
    medicoId: String(j.medico_id),
    sedeId: String(j.sede_id),
    diaSemana: j.dia_semana,
    horaInicio: j.hora_inicio,
    horaFin: j.hora_fin,
    duracionCitaMin: j.duracion_cita_min,
  }
}

export async function getMedicos(): Promise<MedicoAdmin[]> {
  const data = await api.get<any[]>('/api/medicos')
  return data.map(mapMedico)
}

export async function getMedicoDetalle(id: string): Promise<MedicoAdmin> {
  const data = await api.get<any>(`/api/medicos/${id}`)
  return mapMedico(data)
}

export async function crearMedico(body: {
  nombres: string; apellidos: string; registro_medico: string; especialidad_id: number
}): Promise<MedicoAdmin> {
  const data = await api.post<any>('/api/admin/medicos', body)
  return mapMedico(data)
}

export async function actualizarMedico(id: string, body: Partial<{
  nombres: string; apellidos: string; registro_medico: string
  especialidad_id: number; activo: boolean
}>): Promise<MedicoAdmin> {
  const data = await api.put<any>(`/api/admin/medicos/${id}`, body)
  return mapMedico(data)
}

export async function eliminarMedico(id: string): Promise<void> {
  await api.delete(`/api/admin/medicos/${id}`)
}

// ── Jornadas ───────────────────────────────────────────────────────────────

export async function agregarJornada(
  medicoId: string,
  j: { sedeId: string; diaSemana: number; horaInicio: string; horaFin: string; duracionCitaMin: number }
): Promise<JornadaAdmin> {
  const data = await api.post<any>(`/api/admin/medicos/${medicoId}/jornadas`, {
    sede_id: Number(j.sedeId),
    dia_semana: j.diaSemana,
    hora_inicio: j.horaInicio,
    hora_fin: j.horaFin,
    duracion_cita_min: j.duracionCitaMin,
  })
  return mapJornada(data)
}

export async function eliminarJornada(medicoId: string, jornadaId: string): Promise<void> {
  await api.delete(`/api/admin/medicos/${medicoId}/jornadas/${jornadaId}`)
}

// ── Sedes ──────────────────────────────────────────────────────────────────

function mapSede(s: any): SedeAdmin {
  return {
    id: String(s.id),
    nombre: s.nombre,
    ciudad: s.ciudad ?? '',
    direccion: s.direccion ?? '',
    activa: s.activa ?? true,
    horaApertura: s.hora_apertura ? s.hora_apertura.substring(0, 5) : null,
    horaCierre: s.hora_cierre ? s.hora_cierre.substring(0, 5) : null,
  }
}

export async function getSedes(): Promise<SedeAdmin[]> {
  const data = await api.get<any[]>('/api/sedes')
  return data.map(mapSede)
}

export async function crearSede(body: {
  nombre: string; ciudad: string; direccion: string
  hora_apertura?: string; hora_cierre?: string
}): Promise<SedeAdmin> {
  const data = await api.post<any>('/api/admin/sedes', body)
  return mapSede(data)
}

export async function actualizarSede(id: string, body: Partial<{
  nombre: string; ciudad: string; direccion: string; activa: boolean
  hora_apertura: string | null; hora_cierre: string | null
}>): Promise<SedeAdmin> {
  const data = await api.put<any>(`/api/admin/sedes/${id}`, body)
  return mapSede(data)
}

export async function eliminarSede(id: string): Promise<void> {
  await api.delete(`/api/admin/sedes/${id}`)
}

// ── Especialidades ─────────────────────────────────────────────────────────

function mapEsp(e: any): EspecialidadAdmin {
  return {
    id: String(e.id),
    nombre: e.nombre,
    descripcion: e.descripcion ?? '',
    activa: e.activa ?? true,
    duracionMin: e.duracion_min ?? 30,
    modalidad: e.modalidad ?? 'presencial',
  }
}

export async function getEspecialidades(): Promise<EspecialidadAdmin[]> {
  const data = await api.get<any[]>('/api/especialidades')
  return data.map(mapEsp)
}

export async function crearEspecialidad(body: {
  nombre: string; descripcion: string; duracion_min: number; modalidad: string
}): Promise<EspecialidadAdmin> {
  const data = await api.post<any>('/api/admin/especialidades', body)
  return mapEsp(data)
}

export async function actualizarEspecialidad(id: string, body: Partial<{
  nombre: string; descripcion: string; activa: boolean; duracion_min: number; modalidad: string
}>): Promise<EspecialidadAdmin> {
  const data = await api.put<any>(`/api/admin/especialidades/${id}`, body)
  return mapEsp(data)
}

export async function eliminarEspecialidad(id: string): Promise<void> {
  await api.delete(`/api/admin/especialidades/${id}`)
}

// ── Citas (para calendario y detalle médico) ───────────────────────────────

function mapCita(c: any): CitaAdmin {
  return {
    id: String(c.id),
    afiliadoId: String(c.afiliado_id),
    medicoId: String(c.medico_id),
    medicoNombre: c.medico_nombre ?? '',
    especialidadNombre: c.especialidad_nombre ?? '',
    sedeNombre: c.sede_nombre ?? '',
    pacienteNombre: c.paciente_nombre ?? '',
    fecha: c.fecha,
    horaInicio: c.hora_inicio,
    horaFin: c.hora_fin,
    estado: c.estado,
    canal: c.canal,
  }
}

export async function getCitasAdmin(params: {
  medico_id?: string; desde?: string; hasta?: string; estado?: string
} = {}): Promise<CitaAdmin[]> {
  const qs = new URLSearchParams()
  if (params.medico_id) qs.set('medico_id', params.medico_id)
  if (params.desde) qs.set('desde', params.desde)
  if (params.hasta) qs.set('hasta', params.hasta)
  if (params.estado) qs.set('estado', params.estado)
  const data = await api.get<any[]>(`/api/admin/citas?${qs.toString()}`)
  return data.map(mapCita)
}
