export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  password: string;
  rol: 'paciente' | 'admin';
}

export interface AdminUsuario {
  id: string;
  nombre: string;
  email: string;
  password: string;
}

export interface Especialidad {
  id: string;
  nombre: string;
  descripcion: string;
}

export interface Medico {
  id: string;
  nombre: string;
  especialidadId: string;
}

export interface HorarioDisponible {
  id: string;
  medicoId: string;
  fecha: string; // YYYY-MM-DD
  hora: string;  // HH:mm
  estado: 'disponible' | 'ocupado';
}

export interface Sede {
  id: string;
  nombre: string;
  direccion: string;
}

export interface Cita {
  id: string;
  usuarioId: string;
  medicoId: string;
  medicoNombre: string;
  especialidadId: string;
  especialidadNombre: string;
  sedeId: string;
  sedeNombre: string;
  pacienteNombre?: string;
  fecha: string;
  hora: string;
  estado: 'programada' | 'confirmada' | 'cancelada' | 'completada' | 'no_asistio' | 'reagendada';
  canal: 'web' | 'admin' | 'whatsapp' | 'app_movil' | 'telefono';
}

export type TipoDocumento = 'CC' | 'TI' | 'PA' | 'CE';
export type GeneroAfiliado = 'M' | 'F' | 'O';
export type EstadoAfiliado = 'activo' | 'inactivo' | 'suspendido';
export type TipoAfiliado = 'cotizante' | 'beneficiario';

export interface Afiliado {
  id: string;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  genero: GeneroAfiliado;
  telefono: string;
  correo: string;
  fechaNacimiento: string; // YYYY-MM-DD
  departamento: string;
  ciudad: string;
  ipsMedica: string;
  tipo: TipoAfiliado;
  cotizanteId?: string; // solo si tipo === 'beneficiario'
  estado: EstadoAfiliado;
}

export type AuthResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface LoginCredentials {
  tipo_documento: TipoDocumento;
  numero_documento: string;
  password: string;
}

export interface AdminLoginCredentials {
  email: string;
  password: string;
}

export interface DatosRegistro {
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  nombre: string;
  email: string;
  password: string;
}

export interface NuevaCita {
  especialidadId: string;
  medicoId: string;
  sedeId: string;
  fecha: string;
  hora: string;
  horarioId: string;
}
