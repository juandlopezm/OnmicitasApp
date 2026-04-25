import { Link, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../features/auth/hooks/useAdminAuth'
import { Button } from '@/components/ui/button'
import { Shield, Users, CalendarDays, LayoutDashboard, LogOut, Stethoscope } from 'lucide-react'

export function AdminNavbar() {
  const { adminUsuario, logout } = useAdminAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/admin')
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-2">
          <Shield className="size-5 text-primary" />
          <span className="font-bold text-sm">OmniCitas Admin</span>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-1 flex-1">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/dashboard">
              <LayoutDashboard className="size-3.5 mr-1.5" />
              Pagina Principal
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/afiliados">
              <Users className="size-3.5 mr-1.5" />
              Afiliados
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/citas">
              <CalendarDays className="size-3.5 mr-1.5" />
              Citas
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/medicos">
              <Stethoscope className="size-3.5 mr-1.5" />
              Médicos
            </Link>
          </Button>
        </nav>

        {/* Usuario + logout */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block">
            {adminUsuario?.nombre}
          </span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="size-3.5 mr-1.5" />
            Salir
          </Button>
        </div>
      </div>
    </header>
  )
}
