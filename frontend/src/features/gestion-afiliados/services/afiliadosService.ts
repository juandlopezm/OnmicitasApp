import type { Afiliado } from '../../../types';
import { api } from '../../../api/apiClient';

interface BackendAfiliado {
  id: number;
  tipo_documento: string;
  numero_documento: string;
  nombres: string;
  apellidos: string;
  genero: string;
  fecha_nacimiento: string;
  telefono: string | null;
  correo: string | null;
  departamento: string | null;
  ciudad: string | null;
  ips_medica: string | null;
  tipo: 'cotizante' | 'beneficiario';
  cotizante_id: number | null;
  estado: string;
}

function mapAfiliado(a: BackendAfiliado): Afiliado {
  return {
    id: String(a.id),
    tipoDocumento: a.tipo_documento as Afiliado['tipoDocumento'],
    numeroDocumento: a.numero_documento,
    nombres: a.nombres,
    apellidos: a.apellidos,
    genero: a.genero as Afiliado['genero'],
    fechaNacimiento: a.fecha_nacimiento,
    telefono: a.telefono ?? '',
    correo: a.correo ?? '',
    departamento: a.departamento ?? '',
    ciudad: a.ciudad ?? '',
    ipsMedica: a.ips_medica ?? '',
    tipo: a.tipo,
    cotizanteId: a.cotizante_id ? String(a.cotizante_id) : undefined,
    estado: a.estado as Afiliado['estado'],
  };
}

export async function getAfiliados(): Promise<Afiliado[]> {
  const data = await api.get<BackendAfiliado[]>('/api/admin/afiliados');
  return data.map(mapAfiliado);
}

export async function getAfiliadoById(id: string): Promise<Afiliado | null> {
  try {
    const data = await api.get<BackendAfiliado>(`/api/admin/afiliados/${id}`);
    return mapAfiliado(data);
  } catch {
    return null;
  }
}

export async function crearAfiliado(
  datos: Omit<Afiliado, 'id'>
): Promise<{ ok: boolean; afiliado?: Afiliado; error?: string }> {
  try {
    const payload = {
      tipo_documento: datos.tipoDocumento,
      numero_documento: datos.numeroDocumento,
      nombres: datos.nombres,
      apellidos: datos.apellidos,
      genero: datos.genero,
      fecha_nacimiento: datos.fechaNacimiento,
      telefono: datos.telefono,
      correo: datos.correo,
      departamento: datos.departamento,
      ciudad: datos.ciudad,
      ips_medica: datos.ipsMedica,
      tipo: datos.tipo,
      cotizante_id: datos.cotizanteId ? Number(datos.cotizanteId) : undefined,
      estado: datos.estado,
    };
    const data = await api.post<BackendAfiliado>('/api/admin/afiliados', payload);
    return { ok: true, afiliado: mapAfiliado(data) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function actualizarAfiliado(
  id: string,
  datos: Partial<Omit<Afiliado, 'id'>>
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Mapear campos camelCase → snake_case para el backend
    const payload: Record<string, unknown> = {}
    if (datos.tipoDocumento    !== undefined) payload.tipo_documento    = datos.tipoDocumento
    if (datos.numeroDocumento  !== undefined) payload.numero_documento  = datos.numeroDocumento
    if (datos.nombres          !== undefined) payload.nombres           = datos.nombres
    if (datos.apellidos        !== undefined) payload.apellidos         = datos.apellidos
    if (datos.genero           !== undefined) payload.genero            = datos.genero
    if (datos.telefono         !== undefined) payload.telefono          = datos.telefono
    if (datos.correo           !== undefined) payload.correo            = datos.correo
    if (datos.fechaNacimiento  !== undefined) payload.fecha_nacimiento  = datos.fechaNacimiento
    if (datos.departamento     !== undefined) payload.departamento      = datos.departamento
    if (datos.ciudad           !== undefined) payload.ciudad            = datos.ciudad
    if (datos.ipsMedica        !== undefined) payload.ips_medica        = datos.ipsMedica
    if (datos.estado           !== undefined) payload.estado            = datos.estado
    await api.put(`/api/admin/afiliados/${id}`, payload);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function cambiarEstadoAfiliado(
  id: string,
  estado: string
): Promise<{ ok: boolean; error?: string }> {
  // Usa el endpoint general de actualización — no existe endpoint /estado separado
  return actualizarAfiliado(id, { estado: estado as Afiliado['estado'] });
}

export async function getMisBeneficiarios(): Promise<Afiliado[]> {
  // GET /api/users/me → user-service con include_beneficiarios=True
  // Retorna el perfil del cotizante con su lista de beneficiarios embebida
  const data = await api.get<BackendAfiliado & { beneficiarios?: BackendAfiliado[] }>('/api/users/me');
  return (data.beneficiarios ?? []).map(mapAfiliado);
}

export async function getMiPerfil(): Promise<Afiliado> {
  const data = await api.get<BackendAfiliado & { beneficiarios?: BackendAfiliado[] }>('/api/users/me');
  const afiliado = mapAfiliado(data);
  if (data.beneficiarios) {
    afiliado.beneficiarios = data.beneficiarios.map(mapAfiliado);
  }
  return afiliado;
}

export async function getBeneficiarios(): Promise<Afiliado[]> {
  return getMisBeneficiarios();
}

export async function actualizarMiPerfil(
  datos: Pick<Afiliado, 'nombres' | 'apellidos' | 'genero' | 'fechaNacimiento' | 'telefono' | 'departamento' | 'ciudad' | 'ipsMedica'>
): Promise<{ ok: boolean; afiliado?: Afiliado; error?: string }> {
  try {
    const payload: Record<string, unknown> = {
      nombres:          datos.nombres,
      apellidos:        datos.apellidos,
      genero:           datos.genero,
      fecha_nacimiento: datos.fechaNacimiento || null,
      telefono:         datos.telefono || null,
      departamento:     datos.departamento || null,
      ciudad:           datos.ciudad || null,
      ips_medica:       datos.ipsMedica || null,
    }
    const data = await api.put<BackendAfiliado>('/api/users/me', payload)
    return { ok: true, afiliado: mapAfiliado(data) }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
