import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function PrivateRoute() {
  const { usuario, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Cargando...</div>;
  }

  return usuario ? <Outlet /> : <Navigate to="/login" replace />;
}
