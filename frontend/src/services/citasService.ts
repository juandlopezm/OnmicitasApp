import type { Cita, Especialidad, HorarioDisponible, Medico, Sede } from '../types';
import { api } from './apiClient';

// ── Catálogos ──────────────────────────────────────────────────────────────

export async function getEspecialidades(): Promise<Especialidad[]> {
  const data = await api.get<Array<{ id: number; nombre: string; descripcion: string }>>('/api/especialidades');
  return data.map(e => ({ id: String(e.id), nombre: e.nombre, descripcion: e.descripcion }));
}

export async function getMedicosByEspecialidad(especialidadId: string): Promise<Medico[]> {
  const data = await api.get<Array<{ id: number; nombre: string; especialidad_id: number }>>
    (`/api/medicos?especialidad_id=${especialidadId}`);
  return data.map(m => ({ id: String(m.id), nombre: m.nombre, especialidadId: String(m.especialidad_id) }));
}

export async function getSedes(): Promise<Sede[]> {
  const data = await api.get<Array<{ id: number; nombre: string; direccion: string }>>('/api/sedes');
  return data.map(s => ({ id: String(s.id), nombre: s.nombre, direccion: s.direccion }));
}

export async function getHorariosDisponibles(
  medicoId: string,
  fecha: string
): Promise<HorarioDisponible[]> {
  // Endpoint para afiliados: requiere JWT de afiliado, aplica filtro 24h
  const data = await api.get<Array<{
    id: number; medico_id: number; fecha: string; hora_inicio: string; estado: string;
  }>>(`/api/horarios?medico_id=${medicoId}&fecha=${fecha}`);

  return data.map(h => ({
    id: String(h.id),
    medicoId: String(h.medico_id),
    fecha: h.fecha,
    hora: h.hora_inicio,
    estado: h.estado as 'disponible' | 'ocupado',
  }));
}

export async function getHorariosAdmin(
  medicoId: string,
  fecha: string
): Promise<HorarioDisponible[]> {
  // Endpoint para admin: requiere JWT de admin, sin filtro 24h, devuelve solo disponibles
  const data = await api.get<Array<{
    id: number; medico_id: number; fecha: string; hora_inicio: string; estado: string;
  }>>(`/api/admin/horarios?medico_id=${medicoId}&fecha=${fecha}&estado=disponible`);

  return data.map(h => ({
    id: String(h.id),
    medicoId: String(h.medico_id),
    fecha: h.fecha,
    hora: h.hora_inicio,
    estado: h.estado as 'disponible' | 'ocupado',
  }));
}

// ── Citas ──────────────────────────────────────────────────────────────────

interface BackendCita {
  id: number;
  afiliado_id: number;
  beneficiario_id: number | null;
  paciente_nombre: string | null;
  medico_id: number;
  medico_nombre: string;
  especialidad_id: number;
  especialidad_nombre: string;
  sede_id: number;
  sede_nombre: string;
  horario_id: number;
  fecha: string;
  hora_inicio: string;
  estado: string;
  canal: string;
}

function mapCita(c: BackendCita): Cita {
  return {
    id: String(c.id),
    usuarioId: String(c.afiliado_id),
    medicoId: String(c.medico_id),
    medicoNombre: c.medico_nombre,
    especialidadId: String(c.especialidad_id),
    especialidadNombre: c.especialidad_nombre,
    sedeId: String(c.sede_id),
    sedeNombre: c.sede_nombre,
    pacienteNombre: c.paciente_nombre ?? undefined,
    fecha: c.fecha,
    hora: c.hora_inicio,
    estado: c.estado as Cita['estado'],
    canal: (c.canal ?? 'web') as Cita['canal'],
  };
}

export async function crearCita(
  _usuarioId: string,
  nuevaCita: {
    especialidadId: string;
    medicoId: string;
    sedeId: string;
    fecha: string;
    hora: string;
    horarioId: string;
    beneficiarioId?: string;
  }
): Promise<Cita> {
  const data = await api.post<BackendCita>('/api/citas', {
    horario_id: Number(nuevaCita.horarioId),
    especialidad_id: Number(nuevaCita.especialidadId),
    sede_id: Number(nuevaCita.sedeId),
    beneficiario_id: nuevaCita.beneficiarioId ? Number(nuevaCita.beneficiarioId) : undefined,
  });
  return mapCita(data);
}

export async function crearCitaAdmin(datos: {
  afiliadoId: string;
  especialidadId: string;
  sedeId: string;
  horarioId: string;
  notas?: string;
}): Promise<{ ok: boolean; cita?: Cita; error?: string }> {
  try {
    const data = await api.post<BackendCita>('/api/admin/citas', {
      afiliado_id: Number(datos.afiliadoId),
      horario_id: Number(datos.horarioId),
      especialidad_id: Number(datos.especialidadId),
      sede_id: Number(datos.sedeId),
      notas: datos.notas,
    });
    return { ok: true, cita: mapCita(data) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function getCitasByUsuario(_usuarioId: string): Promise<Cita[]> {
  const data = await api.get<BackendCita[]>('/api/citas/mis-citas');
  return data.map(mapCita);
}

export async function getHistorial(): Promise<Cita[]> {
  const data = await api.get<BackendCita[]>('/api/citas/historial');
  return data.map(mapCita);
}

export async function getAllCitas(): Promise<Cita[]> {
  const data = await api.get<BackendCita[]>('/api/admin/citas');
  return data.map(mapCita);
}

export async function cancelarCita(citaId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await api.delete(`/api/citas/${citaId}/cancelar`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function reagendarCita(
  citaId: string,
  nuevaSedeId: string,
  nuevoHorarioId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await api.put(`/api/citas/${citaId}/reagendar`, {
      nuevo_horario_id: Number(nuevoHorarioId),
      nueva_sede_id: Number(nuevaSedeId),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function cambiarEstadoCita(
  citaId: string,
  nuevoEstado: Cita['estado']
): Promise<{ ok: boolean; error?: string }> {
  try {
    await api.put(`/api/admin/citas/${citaId}/estado`, { estado: nuevoEstado });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
