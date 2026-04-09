import { createContext, useState, useEffect, type ReactNode } from 'react';
import type { LoginCredentials, AuthResult } from '../types';
import type { AfiliadoAuth } from '../services/authService';
import * as authService from '../services/authService';

interface AuthContextType {
  usuario: AfiliadoAuth | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthResult<AfiliadoAuth>>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<AfiliadoAuth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const guardado = localStorage.getItem('usuario');
    if (guardado) {
      setUsuario(JSON.parse(guardado));
    }
    setLoading(false);
  }, []);

  async function login(credentials: LoginCredentials): Promise<AuthResult<AfiliadoAuth>> {
    const resultado = await authService.login(credentials);
    if (resultado.ok) {
      setUsuario(resultado.data);
      localStorage.setItem('usuario', JSON.stringify(resultado.data));
    }
    return resultado;
  }

  function logout(): void {
    authService.logout();
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
