import type { AdminLoginCredentials, AuthResult } from '../../../types';
import { api, ApiError } from '../../../api/apiClient';

export interface AdminAuth {
  id: number;
  nombre: string;
  email: string;
}

interface RawAdminAuthResponse {
  token: string;
  admin: AdminAuth;
}

export async function adminLogin(credentials: AdminLoginCredentials): Promise<AuthResult<AdminAuth>> {
  try {
    const res = await api.post<RawAdminAuthResponse>('/api/admin/auth/login', credentials);
    localStorage.setItem('adminToken', res.token);
    return { ok: true, data: res.admin };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al iniciar sesión',
      errorLabel: err instanceof ApiError ? err.label : undefined,
    };
  }
}

export function adminLogout(): void {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminUsuario');
}
