import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { CitaCard } from '../components/citas/CitaCard'
import { ReagendarModal } from '../components/citas/ReagendarModal'
import { Navbar } from '../components/layout/Navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getCitasByUsuario, cancelarCita } from '../services/citasService'
import { useSSE } from '../hooks/useSSE'
import type { Cita } from '../types'
import { CalendarPlus } from 'lucide-react'

export function CitasPage() {
  const { usuario } = useAuth()
  const [citas, setCitas] = useState<Cita[]>([])
  const [cargando, setCargando] = useState(true)
  const [citaReagendar, setCitaReagendar] = useState<Cita | null>(null)
  const [errorAccion, setErrorAccion] = useState('')

  const cargarCitas = useCallback(() => {
    if (!usuario) return
    getCitasByUsuario(usuario.id).then(data => {
      setCitas(data)
      setCargando(false)
    })
  }, [usuario])

  useEffect(() => { cargarCitas() }, [cargarCitas])

  // Sincronización en tiempo real vía SSE
  useSSE(evento => {
    if (evento.type === 'connected') return
    if (!usuario) return

    const data = evento.data as Cita & { afiliado_id?: number }

    if (evento.type === 'cita_creada') {
      // Solo agregar si la cita pertenece a este afiliado
      if (String(data?.afiliado_id) === usuario.id) {
        cargarCitas()
      }
    }

    if (evento.type === 'cita_actualizada') {
      setCitas(prev => {
        const idx = prev.findIndex(c => String(c.id) === String(data?.id))
        if (idx === -1) return prev
        const updated = [...prev]
        updated[idx] = { ...updated[idx], estado: data.estado }
        return updated
      })
    }
  })

  async function handleCancelar(cita: Cita) {
    setErrorAccion('')
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Mis Citas</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {citas.length > 0
                ? `${citas.length} cita${citas.length !== 1 ? 's' : ''} agendada${citas.length !== 1 ? 's' : ''}`
                : 'Sin citas agendadas'}
            </p>
          </div>
          <Button asChild>
            <Link to="/citas/nueva">
              <CalendarPlus className="size-4 mr-1.5" />
              Nueva Cita
            </Link>
          </Button>
        </div>

        {errorAccion && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-4">
            {errorAccion}
          </p>
        )}

        {cargando ? (
          <p className="text-muted-foreground text-sm">Cargando citas...</p>
        ) : citas.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-14 text-center gap-3">
              <CalendarPlus className="size-10 text-muted-foreground/40" />
              <div>
                <p className="font-medium">No tienes citas agendadas</p>
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
      </main>

      <ReagendarModal
        cita={citaReagendar}
        onClose={() => setCitaReagendar(null)}
        onSuccess={cargarCitas}
      />
    </div>
  )
}
