import { Navigate, Outlet } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';

export function AdminPrivateRoute() {
  const { adminUsuario, loading } = useAdminAuth();

  if (loading) return null;
  if (!adminUsuario) return <Navigate to="/admin" replace />;
  return <Outlet />;
}
