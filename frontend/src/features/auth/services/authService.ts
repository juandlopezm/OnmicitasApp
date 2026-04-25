import type { LoginCredentials, AuthResult } from '../../../types';
import { api, ApiError } from '../../../api/apiClient';

export interface AfiliadoAuth {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string;
  tipo: 'cotizante' | 'beneficiario';
  estado: string;
  tipo_documento: string;
  numero_documento: string;
}

export interface RegisterData {
  tipo_documento: string;
  numero_documento: string;
  correo: string;
  password: string;
}

interface RawAuthResponse {
  token: string;
  afiliado: AfiliadoAuth;
}

export async function login(credentials: LoginCredentials): Promise<AuthResult<AfiliadoAuth>> {
  try {
    const res = await api.post<RawAuthResponse>('/api/auth/login', {
      tipo_documento: credentials.tipo_documento,
      numero_documento: credentials.numero_documento,
      password: credentials.password,
    });
    localStorage.setItem('token', res.token);
    return { ok: true, data: res.afiliado };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError
        ? err.message          // mensaje ya formateado por buildApiError
        : 'Error al iniciar sesión',
      errorLabel: err instanceof ApiError ? err.label : undefined,
    };
  }
}

export async function register(datos: RegisterData): Promise<AuthResult<AfiliadoAuth>> {
  try {
    const res = await api.post<RawAuthResponse>('/api/auth/register', datos);
    localStorage.setItem('token', res.token);
    return { ok: true, data: res.afiliado };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al registrar',
      errorLabel: err instanceof ApiError ? err.label : undefined,
    };
  }
}

export function logout(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
}
