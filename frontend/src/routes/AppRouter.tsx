import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PrivateRoute } from './PrivateRoute';
import { AdminPrivateRoute } from './AdminPrivateRoute';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { DashboardPage } from '../pages/DashboardPage';
import { CitasPage } from '../pages/CitasPage';
import { CrearCitaPage } from '../pages/CrearCitaPage';
import { ConfirmacionPage } from '../pages/ConfirmacionPage';
import { AdminLoginPage } from '../pages/AdminLoginPage';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
import { AfiliadosListPage } from '../pages/AfiliadosListPage';
import { CrearAfiliadoPage } from '../pages/CrearAfiliadoPage';
import { EditarAfiliadoPage } from '../pages/EditarAfiliadoPage';
import { AdminCitasPage } from '../pages/AdminCitasPage';
import { AdminCrearCitaPage } from '../pages/AdminCrearCitaPage';

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
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
