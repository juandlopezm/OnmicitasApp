import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/hooks/useAuth'
import { CitaCard } from './components/CitaCard'
import { BeneficiarioCarousel } from './components/BeneficiarioCarousel'
import { Navbar } from '../../layout/Navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getCitasByUsuario } from './services/citasService'
import type { Cita } from '../../types'
import { CalendarPlus, ClipboardList } from 'lucide-react'

export function DashboardPage() {
  const { usuario } = useAuth()
  const [citas, setCitas] = useState<Cita[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!usuario) return
    getCitasByUsuario(usuario.id)
      .then(data => { setCitas(data) })
      .catch(() => {})
      .finally(() => { setCargando(false) })
  }, [usuario])

  const ultimasCitas = citas.slice(-3).reverse()

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">
            Bienvenido, {usuario?.nombres}
          </h1>
          <h3>
            Estado: {usuario?.estado} · Tipo: {usuario?.tipo}
          </h3>
          <p className="text-muted-foreground mt-1">¿Qué deseas hacer hoy?</p>
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <Link to="/citas/nueva">
            <Card className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group">
              <CardHeader>
                <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                  <CalendarPlus className="size-5" />
                </div>
                <CardTitle className="text-base">Agendar Cita</CardTitle>
                <CardDescription>Reserva una nueva cita médica</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link to="/citas">
            <Card className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group">
              <CardHeader>
                <div className="size-10 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center mb-2 group-hover:bg-secondary/80 transition-colors">
                  <ClipboardList className="size-5" />
                </div>
                <CardTitle className="text-base">Mis Citas</CardTitle>
                <CardDescription>Consulta tus citas agendadas</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        {/* Grupo familiar — carousel de beneficiarios */}
        {usuario && <BeneficiarioCarousel usuario={usuario} />}

        {/* Recent appointments */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Citas Recientes</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/citas">Ver todas →</Link>
            </Button>
          </div>

          {cargando ? (
            <p className="text-muted-foreground text-sm">Cargando citas...</p>
          ) : ultimasCitas.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-3">
                <CalendarPlus className="size-8 text-muted-foreground/50" />
                <div>
                  <p className="text-sm font-medium">No tienes citas agendadas</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Agenda tu primera cita médica
                  </p>
                </div>
                <Button size="sm" asChild>
                  <Link to="/citas/nueva">Agendar ahora</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ultimasCitas.map(cita => (
                <CitaCard key={cita.id} cita={cita} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
