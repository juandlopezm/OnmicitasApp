import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Heart, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Navbar() {
  const { usuario, logout } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const initials = usuario
    ? (usuario.nombres.charAt(0) + usuario.apellidos.charAt(0)).toUpperCase()
    : '?'

  function navLink(to: string) {
    return cn(
      'text-sm font-medium px-3 py-1.5 rounded-md transition-colors',
      location.pathname === to || location.pathname.startsWith(to + '/')
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
    )
  }

  return (
    <nav className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-card px-6 shadow-sm">
      <Link
        to="/dashboard"
        className="flex items-center gap-2 font-bold text-primary text-base hover:opacity-80 transition-opacity shrink-0"
      >
        <Heart className="size-4 fill-primary" />
        OmniCitas
      </Link>

      <div className="flex items-center gap-1 ml-4 flex-1">
        <Link to="/dashboard" className={navLink('/dashboard')}>Dashboard</Link>
        <Link to="/citas"     className={navLink('/citas')}>Mis Citas</Link>
      </div>

      <div className="flex items-center gap-2">
        {/* Avatar / perfil */}
        <Link
          to="/perfil"
          className={cn(
            'flex items-center gap-2 rounded-full pl-1 pr-3 py-1 transition-colors',
            'hover:bg-muted',
            location.pathname === '/perfil' && 'bg-primary/10'
          )}
        >
          <div className="size-7 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">
            {initials}
          </div>
          <span className="text-sm font-medium hidden sm:block">
            {usuario?.nombres}
          </span>
        </Link>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-muted-foreground hover:text-destructive"
        >
          <LogOut className="size-4" />
          <span className="hidden sm:inline ml-1">Salir</span>
        </Button>
      </div>
    </nav>
  )
}
