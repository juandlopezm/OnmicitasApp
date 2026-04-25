import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PrivateRoute } from './PrivateRoute';
import { AdminPrivateRoute } from './AdminPrivateRoute';
// auth feature
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { AdminLoginPage } from '../features/auth/AdminLoginPage';
// gestion-citas feature
import { DashboardPage } from '../features/gestion-citas/DashboardPage';
import { CitasPage } from '../features/gestion-citas/CitasPage';
import { CrearCitaPage } from '../features/gestion-citas/CrearCitaPage';
import { ConfirmacionPage } from '../features/gestion-citas/ConfirmacionPage';
import { AdminDashboardPage } from '../features/gestion-citas/AdminDashboardPage';
import { AdminCitasPage } from '../features/gestion-citas/AdminCitasPage';
import { AdminCrearCitaPage } from '../features/gestion-citas/AdminCrearCitaPage';
import { AdminMedicosPage } from '../features/gestion-medicos/AdminMedicosPage';
import { AdminMedicoDetallePage } from '../features/gestion-medicos/AdminMedicoDetallePage';
// gestion-afiliados feature
import { AfiliadosListPage } from '../features/gestion-afiliados/AfiliadosListPage';
import { CrearAfiliadoPage } from '../features/gestion-afiliados/CrearAfiliadoPage';
import { EditarAfiliadoPage } from '../features/gestion-afiliados/EditarAfiliadoPage';
import { PerfilPage } from '../features/gestion-afiliados/PerfilPage';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas públicas de pacientes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Rutas protegidas de pacientes */}
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/citas" element={<CitasPage />} />
          <Route path="/citas/nueva" element={<CrearCitaPage />} />
          <Route path="/citas/confirmacion" element={<ConfirmacionPage />} />
          <Route path="/perfil" element={<PerfilPage />} />
        </Route>

        {/* Login de administrador (público) */}
        <Route path="/admin" element={<AdminLoginPage />} />

        {/* Rutas protegidas de administrador */}
        <Route element={<AdminPrivateRoute />}>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/afiliados" element={<AfiliadosListPage />} />
          <Route path="/admin/afiliados/nuevo" element={<CrearAfiliadoPage />} />
          <Route path="/admin/afiliados/:id/editar" element={<EditarAfiliadoPage />} />
          <Route path="/admin/citas" element={<AdminCitasPage />} />
          <Route path="/admin/citas/nueva" element={<AdminCrearCitaPage />} />
          <Route path="/admin/medicos" element={<AdminMedicosPage />} />
          <Route path="/admin/medicos/:id" element={<AdminMedicoDetallePage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
