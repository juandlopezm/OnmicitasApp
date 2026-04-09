import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Heart, LogOut } from 'lucide-react'

export function Navbar() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <nav className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-card px-6 shadow-sm">
      <Link
        to="/dashboard"
        className="flex items-center gap-2 font-bold text-primary text-base hover:opacity-80 transition-opacity"
      >
        <Heart className="size-4 fill-primary" />
        OmniCitas
      </Link>

      <div className="flex items-center gap-1 ml-4 flex-1">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboard">Dashboard</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/citas">Mis Citas</Link>
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground hidden sm:block">
          {usuario?.nombres}
        </span>
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
