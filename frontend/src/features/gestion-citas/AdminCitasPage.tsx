import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { AdminNavbar } from '../../layout/AdminNavbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectItem } from '@/components/ui/select'
import { getAllCitas, cambiarEstadoCita } from './services/citasService'
import { formatearFecha, formatearHora } from '../../utils/dateUtils'
import type { Cita } from '../../types'
import { CalendarDays, CalendarPlus, AlertTriangle, X, Globe, MessageCircle, Smartphone, Phone, ShieldCheck } from 'lucide-react'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'

const CANAL_ICONO: Record<string, React.ReactNode> = {
  web:       <Globe className="size-3 mr-1" />,
  admin:     <ShieldCheck className="size-3 mr-1" />,
  whatsapp:  <MessageCircle className="size-3 mr-1" />,
  app_movil: <Smartphone className="size-3 mr-1" />,
  telefono:  <Phone className="size-3 mr-1" />,
}

const CANAL_TEXTO: Record<string, string> = {
  web: 'Web', admin: 'Admin', whatsapp: 'WhatsApp', app_movil: 'App', telefono: 'Teléfono',
}

const CANAL_VARIANT: Record<string, BadgeVariant> = {
  web: 'secondary', admin: 'default', whatsapp: 'success', app_movil: 'outline', telefono: 'warning',
}

const ESTADO_VARIANT: Record<Cita['estado'], BadgeVariant> = {
  programada: 'default',
  confirmada: 'secondary',
  completada: 'success',
  cancelada:  'destructive',
  no_asistio: 'warning',
  reagendada: 'outline',
}

const ESTADO_TEXTO: Record<Cita['estado'], string> = {
  programada: 'Programada',
  confirmada: 'Confirmada',
  completada: 'Atendida',
  cancelada:  'Cancelada',
  no_asistio: 'No asistió',
  reagendada: 'Reagendada',
}

const ESTADOS_OPCIONES: Cita['estado'][] = [
  'programada', 'confirmada', 'completada', 'cancelada', 'no_asistio', 'reagendada',
]

interface ConfirmandoCambio {
  citaId: string
  nuevoEstado: Cita['estado']
}

export function AdminCitasPage() {
  const [citas, setCitas] = useState<Cita[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<Cita['estado'] | ''>('')
  const [cambiando, setCambiando] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [confirmando, setConfirmando] = useState<ConfirmandoCambio | null>(null)

  const cargarCitas = useCallback(() => {
    getAllCitas().then(data => {
      setCitas(data)
      setCargando(false)
    })
  }, [])

  useEffect(() => { cargarCitas() }, [cargarCitas])

  function solicitarCambioEstado(citaId: string, nuevoEstado: Cita['estado']) {
    // Si el nuevo estado es "cancelada" pedimos confirmación
    if (nuevoEstado === 'cancelada') {
      setConfirmando({ citaId, nuevoEstado })
    } else {
      ejecutarCambioEstado(citaId, nuevoEstado)
    }
  }

  async function ejecutarCambioEstado(citaId: string, nuevoEstado: Cita['estado']) {
    setConfirmando(null)
    setCambiando(citaId)
    setError('')
    const resultado = await cambiarEstadoCita(citaId, nuevoEstado)
    setCambiando(null)
    if (resultado.ok) {
      setCitas(prev => prev.map(c => c.id === citaId ? { ...c, estado: nuevoEstado } : c))
    } else {
      setError(resultado.error ?? 'Error al actualizar el estado.')
    }
  }

  const citasFiltradas = citas.filter(c => {
    const matchBusqueda = busqueda
      ? `${c.medicoNombre} ${c.especialidadNombre} ${c.sedeNombre} ${c.pacienteNombre ?? ''}`
          .toLowerCase().includes(busqueda.toLowerCase())
      : true
    const matchEstado = filtroEstado ? c.estado === filtroEstado : true
    return matchBusqueda && matchEstado
  })

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminNavbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Gestión de Citas</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {citas.length} cita{citas.length !== 1 ? 's' : ''} en el sistema
            </p>
          </div>
          <Button asChild>
            <Link to="/admin/citas/nueva">
              <CalendarPlus className="size-4 mr-1.5" />
              Nueva Cita
            </Link>
          </Button>
        </div>

        {/* Modal de confirmación cancelar */}
        {confirmando && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-background rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="size-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="size-5 text-destructive" />
                </div>
                <div>
                  <p className="font-semibold">¿Cancelar esta cita?</p>
                  <p className="text-sm text-muted-foreground">Esta acción libera el horario y no puede deshacerse.</p>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setConfirmando(null)}
                >
                  <X className="size-4 mr-1" />
                  No, mantener
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => ejecutarCambioEstado(confirmando.citaId, confirmando.nuevoEstado)}
                >
                  Sí, cancelar cita
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por médico, especialidad, sede o paciente..."
            className="flex-1 min-w-48 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="w-44">
            <Select
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value as Cita['estado'] | '')}
              placeholder="Todos los estados"
            >
              {ESTADOS_OPCIONES.map(est => (
                <SelectItem key={est} value={est}>{ESTADO_TEXTO[est]}</SelectItem>
              ))}
            </Select>
          </div>
          {filtroEstado && (
            <button
              onClick={() => setFiltroEstado('')}
              className="text-xs text-muted-foreground hover:text-foreground underline self-center"
            >
              Limpiar filtro
            </button>
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-4">{error}</p>
        )}

        {cargando ? (
          <p className="text-muted-foreground text-sm">Cargando citas...</p>
        ) : citasFiltradas.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-14 text-center gap-3">
              <CalendarDays className="size-10 text-muted-foreground/40" />
              <p className="font-medium">
                {busqueda || filtroEstado ? 'Sin resultados para estos filtros' : 'No hay citas en el sistema'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Paciente</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Especialidad / Médico</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Sede</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Fecha y Hora</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Canal</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cambiar</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {citasFiltradas.map(cita => (
                  <tr key={cita.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-xs">{cita.pacienteNombre ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <p className="font-medium">{cita.especialidadNombre}</p>
                      <p className="text-xs text-muted-foreground">{cita.medicoNombre}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                      {cita.sedeNombre}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <p className="text-xs">{formatearFecha(cita.fecha)}</p>
                      <p className="text-xs text-muted-foreground">{formatearHora(cita.hora)}</p>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <Badge variant={CANAL_VARIANT[cita.canal] ?? 'secondary'} className="flex items-center w-fit text-xs">
                        {CANAL_ICONO[cita.canal]}
                        {CANAL_TEXTO[cita.canal] ?? cita.canal}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={ESTADO_VARIANT[cita.estado]}>
                        {ESTADO_TEXTO[cita.estado]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-36">
                        <Select
                          value={cita.estado}
                          onChange={e => solicitarCambioEstado(cita.id, e.target.value as Cita['estado'])}
                          placeholder=""
                        >
                          {ESTADOS_OPCIONES.map(est => (
                            <SelectItem key={est} value={est}>
                              {ESTADO_TEXTO[est]}
                            </SelectItem>
                          ))}
                        </Select>
                        {cambiando === cita.id && (
                          <p className="text-xs text-muted-foreground mt-1">Guardando...</p>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
