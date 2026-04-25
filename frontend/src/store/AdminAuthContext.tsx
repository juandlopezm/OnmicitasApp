import { createContext, useState, useEffect, type ReactNode } from 'react';
import type { AdminLoginCredentials, AuthResult } from '../types';
import type { AdminAuth } from '../features/auth/services/adminAuthService';
import * as adminAuthService from '../features/auth/services/adminAuthService';

interface AdminAuthContextType {
  adminUsuario: AdminAuth | null;
  loading: boolean;
  login: (credentials: AdminLoginCredentials) => Promise<AuthResult<AdminAuth>>;
  logout: () => void;
}

export const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [adminUsuario, setAdminUsuario] = useState<AdminAuth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const guardado = localStorage.getItem('adminUsuario');
    if (guardado) {
      setAdminUsuario(JSON.parse(guardado));
    }
    setLoading(false);
  }, []);

  async function login(credentials: AdminLoginCredentials): Promise<AuthResult<AdminAuth>> {
    const resultado = await adminAuthService.adminLogin(credentials);
    if (resultado.ok) {
      setAdminUsuario(resultado.data);
      localStorage.setItem('adminUsuario', JSON.stringify(resultado.data));
    }
    return resultado;
  }

  function logout(): void {
    adminAuthService.adminLogout();
    setAdminUsuario(null);
  }

  return (
    <AdminAuthContext.Provider value={{ adminUsuario, loading, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}
