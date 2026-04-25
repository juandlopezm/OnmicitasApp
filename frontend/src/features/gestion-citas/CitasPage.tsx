import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/hooks/useAuth'
import { CitaCard } from './components/CitaCard'
import { ReagendarModal } from './components/ReagendarModal'
import { PacienteFiltro, filtrarCitasPorPaciente } from './components/PacienteFiltro'
import type { FiltroPaciente } from './components/PacienteFiltro'
import { Navbar } from '../../layout/Navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getCitasByUsuario, getHistorial } from './services/citasService'
import { getMisBeneficiarios } from '../gestion-afiliados/services/afiliadosService'
import type { Afiliado, Cita } from '../../types'
import { CalendarPlus, History } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'activas' | 'historial'

export function CitasPage() {
  const { usuario } = useAuth()

  const [tab, setTab] = useState<Tab>('activas')

  // Citas activas
  const [citas, setCitas] = useState<Cita[]>([])
  const [cargandoActivas, setCargandoActivas] = useState(true)
  const [errorActivas, setErrorActivas] = useState('')

  // Historial
  const [historial, setHistorial] = useState<Cita[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [historialCargado, setHistorialCargado] = useState(false)
  const [errorHistorial, setErrorHistorial] = useState('')

  const [beneficiarios, setBeneficiarios] = useState<Afiliado[]>([])
  const [filtroHistorial, setFiltroHistorial] = useState<FiltroPaciente>('')

  const [citaReagendar, setCitaReagendar] = useState<Cita | null>(null)
  const [errorAccion, setErrorAccion] = useState('')

  const cargarActivas = useCallback(() => {
    if (!usuario) return
    setErrorActivas('')
    getCitasByUsuario(usuario.id)
      .then(data => setCitas(data))
      .catch(() => setErrorActivas('No se pudieron cargar tus citas. Intenta de nuevo.'))
      .finally(() => setCargandoActivas(false))
  }, [usuario])

  const cargarHistorial = useCallback(() => {
    if (!usuario || historialCargado) return
    setCargandoHistorial(true)
    setErrorHistorial('')
    getHistorial()
      .then(data => { setHistorial(data); setHistorialCargado(true) })
      .catch(() => setErrorHistorial('No se pudo cargar el historial. Intenta de nuevo.'))
      .finally(() => setCargandoHistorial(false))
  }, [usuario, historialCargado])

  useEffect(() => { cargarActivas() }, [cargarActivas])
  useEffect(() => { getMisBeneficiarios().then(setBeneficiarios).catch(() => {}) }, [])

  // Cargar historial cuando se activa esa pestaña (lazy)
  useEffect(() => {
    if (tab === 'historial') cargarHistorial()
  }, [tab, cargarHistorial])

  async function handleCancelar(cita: Cita) {
    setErrorAccion('')
    const { cancelarCita } = await import('./services/citasService')
    const resultado = await cancelarCita(cita.id)
    if (resultado.ok) {
      setCitas(prev => prev.map(c => c.id === cita.id ? { ...c, estado: 'cancelada' } : c))
    } else {
      setErrorAccion(resultado.error ?? 'No se pudo cancelar la cita.')
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Mis Citas</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Gestiona tus citas médicas
            </p>
          </div>
          <Button asChild>
            <Link to="/citas/nueva">
              <CalendarPlus className="size-4 mr-1.5" />
              Nueva Cita
            </Link>
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit mb-6">
          <button
            onClick={() => setTab('activas')}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
              tab === 'activas'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Activas
            {citas.length > 0 && (
              <span className="ml-1.5 text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                {citas.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('historial')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all',
              tab === 'historial'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <History className="size-3.5" />
            Historial
          </button>
        </div>

        {/* Error de acción */}
        {errorAccion && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-4">
            {errorAccion}
          </p>
        )}

        {/* ── Pestaña Activas ── */}
        {tab === 'activas' && (
          <>
            {errorActivas && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-4">
                {errorActivas}
              </p>
            )}
            {cargandoActivas ? (
              <p className="text-muted-foreground text-sm">Cargando citas...</p>
            ) : citas.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-14 text-center gap-3">
                  <CalendarPlus className="size-10 text-muted-foreground/40" />
                  <div>
                    <p className="font-medium">No tienes citas activas</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Agenda una cita con un médico especialista
                    </p>
                  </div>
                  <Button asChild>
                    <Link to="/citas/nueva">Agendar cita</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {citas.map(cita => (
                  <CitaCard
                    key={cita.id}
                    cita={cita}
                    onCancelar={handleCancelar}
                    onReagendar={setCitaReagendar}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Pestaña Historial ── */}
        {tab === 'historial' && (
          <>
            {errorHistorial && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-4">
                {errorHistorial}
              </p>
            )}

            {/* Filtro por paciente (solo visible cuando hay beneficiarios) */}
            {!cargandoHistorial && historial.length > 0 && (
              <PacienteFiltro
                beneficiarios={beneficiarios}
                value={filtroHistorial}
                onChange={setFiltroHistorial}
                className="mb-4"
              />
            )}

            {cargandoHistorial ? (
              <p className="text-muted-foreground text-sm">Cargando historial...</p>
            ) : (() => {
              const citasFiltradas = filtrarCitasPorPaciente(historial, filtroHistorial)
              return historial.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-14 text-center gap-3">
                    <History className="size-10 text-muted-foreground/40" />
                    <div>
                      <p className="font-medium">Sin historial de citas</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Aquí aparecerán tus citas completadas y canceladas
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : citasFiltradas.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-2">
                    <History className="size-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      No hay citas para este paciente en el historial.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {citasFiltradas.map(cita => (
                    <CitaCard key={cita.id} cita={cita} />
                  ))}
                </div>
              )
            })()}
          </>
        )}
      </main>

      <ReagendarModal
        cita={citaReagendar}
        onClose={() => setCitaReagendar(null)}
        onSuccess={cargarActivas}
      />
    </div>
  )
}
