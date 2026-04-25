import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/hooks/useAuth'
import { useCitas } from './hooks/useCitas'
import { Navbar } from '../../layout/Navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectItem } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import {
  getEspecialidades,
  getMedicosByEspecialidad,
  getHorariosDisponibles,
  getSedes,
  getCitasByUsuario,
} from './services/citasService'
import { getMisBeneficiarios } from '../gestion-afiliados/services/afiliadosService'
import { obtenerFechaEnDias, formatearFecha, formatearHora } from '../../utils/dateUtils'
import type { Afiliado, Cita, Especialidad, HorarioDisponible, Medico, Sede } from '../../types'
import { CheckCircle2, Users, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

const PASOS = ['Especialidad', 'Médico', 'Fecha, Hora y Sede', 'Confirmar']

export function CrearCitaPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Pre-selección desde el dashboard (cuando se pulsa "Apartar cita" en un beneficiario)
  const navState = location.state as { beneficiarioId?: string; beneficiarioNombre?: string } | null
  const initBenefId   = navState?.beneficiarioId   ?? ''
  const initBenefNom  = navState?.beneficiarioNombre ?? ''

  const {
    estado, setBeneficiario, setEspecialidad, setMedico, setFecha, setHora, setSede, irAPaso, confirmar, reiniciar,
  } = useCitas(initBenefId, initBenefNom)

  const [especialidades, setEspecialidades] = useState<Especialidad[]>([])
  const [medicos, setMedicos] = useState<Medico[]>([])
  const [horarios, setHorarios] = useState<HorarioDisponible[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [beneficiarios, setBeneficiarios] = useState<Afiliado[]>([])
  const [citasActivas, setCitasActivas] = useState<Cita[]>([])
  // Cita que entra en conflicto con la selección actual (misma especialidad + mismo paciente)
  const [conflicto, setConflicto] = useState<Cita | null>(null)

  const minFecha = obtenerFechaEnDias(1)
  const maxFecha = obtenerFechaEnDias(30)

  useEffect(() => { getEspecialidades().then(setEspecialidades) }, [])
  useEffect(() => {
    if (estado.especialidadId) getMedicosByEspecialidad(estado.especialidadId).then(setMedicos)
  }, [estado.especialidadId])
  const [horariosError, setHorariosError] = useState<string | null>(null)

  useEffect(() => {
    if (estado.medicoId && estado.fecha) {
      setHorariosError(null)
      getHorariosDisponibles(estado.medicoId, estado.fecha)
        .then(setHorarios)
        .catch((e: Error) => { setHorarios([]); setHorariosError(e.message) })
    } else {
      setHorarios([])
      setHorariosError(null)
    }
  }, [estado.medicoId, estado.fecha])
  useEffect(() => { getSedes().then(setSedes) }, [])

  // Cargar beneficiarios y citas activas para el selector de paciente y la validación de duplicados
  useEffect(() => {
    getMisBeneficiarios().then(setBeneficiarios).catch(() => {})
  }, [])
  useEffect(() => {
    if (usuario) getCitasByUsuario(usuario.id).then(setCitasActivas).catch(() => {})
  }, [usuario])

  function handleSeleccionarEspecialidad(esp: Especialidad) {
    const citaExistente = citasActivas.find(c =>
      c.especialidadId === esp.id &&
      (estado.beneficiarioId
        ? c.beneficiarioId === estado.beneficiarioId
        : !c.beneficiarioId)
    ) ?? null

    if (citaExistente) {
      setConflicto(citaExistente)
    } else {
      setConflicto(null)
      setEspecialidad(esp.id, esp.nombre)
    }
  }

  function handleCambiarBeneficiario(id: string, nombre: string) {
    setBeneficiario(id, nombre)
    setConflicto(null) // al cambiar de paciente el conflicto anterior ya no aplica
  }

  async function handleConfirmar() {
    if (!usuario) return
    const cita = await confirmar(usuario.id)
    if (cita) {
      navigate('/citas/confirmacion', { state: { cita } })
      reiniciar()
    }
  }

  const especialidadSel = especialidades.find(e => e.id === estado.especialidadId)
  const medicoSel       = medicos.find(m => m.id === estado.medicoId)
  const sedeSel         = sedes.find(s => s.id === estado.sedeId)
  const puedeAvanzarPaso3 = !!estado.fecha && !!estado.hora && !!estado.sedeId

  // Texto del paciente seleccionado para mostrar en resumen
  const pacienteTexto = estado.beneficiarioId
    ? estado.beneficiarioNombre
    : usuario ? `${usuario.nombres} ${usuario.apellidos}` : 'Yo'

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Agendar Nueva Cita</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Completa los pasos para reservar tu cita médica
          </p>
        </div>

        {/* ── Selector de paciente (persiste en todos los pasos) ── */}
        {beneficiarios.length > 0 && (
          <Card className="mb-4 border-primary/20 bg-primary/5">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2.5">
                <Users className="size-4 text-primary shrink-0" />
                <label className="text-sm font-medium shrink-0">¿Para quién es la cita?</label>
                <Select
                  value={estado.beneficiarioId}
                  onChange={e => {
                    const id = e.target.value
                    if (!id) {
                      handleCambiarBeneficiario('', '')
                    } else {
                      const ben = beneficiarios.find(b => b.id === id)
                      handleCambiarBeneficiario(id, ben ? `${ben.nombres} ${ben.apellidos}` : '')
                    }
                  }}
                  className="flex-1"
                >
                  <SelectItem value="">
                    Para mí{usuario ? ` (${usuario.nombres})` : ''}
                  </SelectItem>
                  {beneficiarios.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nombres} {b.apellidos}
                    </SelectItem>
                  ))}
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step indicator */}
        <div className="wizard-steps mb-6">
          {PASOS.map((label, i) => {
            const done   = estado.paso > i + 1
            const active = estado.paso === i + 1
            return (
              <div
                key={label}
                className={cn('wizard-step', done && 'wizard-step--done', active && 'wizard-step--active')}
              >
                <span className="wizard-step__number">
                  {done ? <CheckCircle2 className="size-3" /> : i + 1}
                </span>
                <span className="wizard-step__label hidden sm:inline">{label}</span>
              </div>
            )
          })}
        </div>

        <Card>
          {/* Step 1 — Especialidad */}
          {estado.paso === 1 && (
            <>
              <CardHeader>
                <CardTitle>Selecciona la especialidad</CardTitle>
                <CardDescription>¿Qué tipo de atención médica necesitas?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Alerta de cita duplicada */}
                {conflicto && (
                  <div className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
                    <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-warning-foreground">
                        Ya existe una cita activa para{' '}
                        <span className="font-bold">{conflicto.especialidadNombre}</span>
                      </p>
                      <p className="text-muted-foreground mt-0.5">
                        {conflicto.pacienteNombre
                          ? `Para ${conflicto.pacienteNombre} — `
                          : ''
                        }
                        {formatearFecha(conflicto.fecha)} a las {formatearHora(conflicto.hora)}
                        {' '}· Estado: <span className="capitalize">{conflicto.estado}</span>
                      </p>
                      <p className="text-muted-foreground mt-1">
                        Cancela esa cita antes de agendar una nueva.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {especialidades.map(esp => {
                    const tieneConflicto = citasActivas.some(c =>
                      c.especialidadId === esp.id &&
                      (estado.beneficiarioId
                        ? c.beneficiarioId === estado.beneficiarioId
                        : !c.beneficiarioId)
                    )
                    return (
                      <button
                        key={esp.id}
                        onClick={() => handleSeleccionarEspecialidad(esp)}
                        className={cn(
                          'flex flex-col gap-1 p-4 rounded-lg border-2 text-left transition-all',
                          tieneConflicto
                            ? 'border-warning/60 bg-warning/5 opacity-70 cursor-not-allowed'
                            : 'hover:border-primary hover:bg-primary/5',
                          estado.especialidadId === esp.id
                            ? 'border-primary bg-primary/10'
                            : !tieneConflicto && 'border-border bg-background'
                        )}
                      >
                        <span className="font-semibold text-sm">{esp.nombre}</span>
                        <span className="text-xs text-muted-foreground">{esp.descripcion}</span>
                        {tieneConflicto && (
                          <span className="text-[10px] font-medium text-warning mt-1 flex items-center gap-1">
                            <AlertTriangle className="size-3" /> Cita activa
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </>
          )}

          {/* Step 2 — Médico */}
          {estado.paso === 2 && (
            <>
              <CardHeader>
                <CardTitle>Selecciona el médico</CardTitle>
                <CardDescription>
                  Especialidad: <strong>{especialidadSel?.nombre}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  {medicos.map(med => (
                    <button
                      key={med.id}
                      onClick={() => setMedico(med.id, med.nombre)}
                      className={cn(
                        'flex items-center gap-3 p-4 rounded-lg border-2 text-left transition-all',
                        'hover:border-primary hover:bg-primary/5',
                        estado.medicoId === med.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-background'
                      )}
                    >
                      <div className="size-9 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center text-sm shrink-0">
                        {med.nombre.split(' ').pop()?.charAt(0)}
                      </div>
                      <span className="font-medium text-sm">{med.nombre}</span>
                    </button>
                  ))}
                </div>
                <div className="flex justify-start pt-2">
                  <Button variant="outline" size="sm" onClick={() => irAPaso(1)}>
                    ← Atrás
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 3 — Fecha, Hora y Sede */}
          {estado.paso === 3 && (
            <>
              <CardHeader>
                <CardTitle>Fecha, Hora y Sede</CardTitle>
                <CardDescription>Médico: <strong>{medicoSel?.nombre}</strong></CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Fecha */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Fecha disponible</label>
                  <DatePicker
                    value={estado.fecha}
                    onChange={v => setFecha(v)}
                    minDate={minFecha}
                    maxDate={maxFecha}
                  />
                </div>

                {/* Horarios */}
                {estado.fecha && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Horarios disponibles</label>
                    {horariosError ? (
                      <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                        {horariosError}
                      </p>
                    ) : horarios.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No hay horarios disponibles para esta fecha.
                      </p>
                    ) : (
                      <div className="horario-grid">
                        {horarios.map(h => {
                          const sede = sedes.find(s => s.id === h.sedeId)
                          return (
                            <button
                              key={h.id}
                              onClick={() => {
                                setHora(h.hora, h.id)
                                setSede(h.sedeId, sede?.nombre ?? '')
                              }}
                              className={cn(
                                'px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all',
                                estado.hora === h.hora
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border hover:border-primary hover:bg-primary/5'
                              )}
                            >
                              {formatearHora(h.hora)}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Sede — auto-seleccionada del horario */}
                {estado.sedeId && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">Sede de atención</label>
                    <p className="text-sm rounded-lg border bg-muted/40 px-3 py-2">
                      {sedes.find(s => s.id === estado.sedeId)?.nombre ?? estado.sedeId}
                      {sedes.find(s => s.id === estado.sedeId)?.direccion
                        ? ` — ${sedes.find(s => s.id === estado.sedeId)?.direccion}`
                        : ''}
                    </p>
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <Button variant="outline" size="sm" onClick={() => irAPaso(2)}>
                    ← Atrás
                  </Button>
                  {puedeAvanzarPaso3 && (
                    <Button size="sm" onClick={() => irAPaso(4)}>
                      Continuar →
                    </Button>
                  )}
                </div>
              </CardContent>
            </>
          )}

          {/* Step 4 — Resumen y Confirmación */}
          {estado.paso === 4 && (
            <>
              <CardHeader>
                <CardTitle>Confirmar Cita</CardTitle>
                <CardDescription>Revisa los detalles antes de confirmar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border divide-y">
                  {[
                    { label: 'Paciente',     value: pacienteTexto },
                    { label: 'Especialidad', value: especialidadSel?.nombre },
                    { label: 'Médico',       value: medicoSel?.nombre },
                    { label: 'Sede',         value: sedeSel ? `${sedeSel.nombre} — ${sedeSel.direccion}` : '' },
                    { label: 'Fecha',        value: formatearFecha(estado.fecha) },
                    { label: 'Hora',         value: formatearHora(estado.hora) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center px-4 py-3">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="text-sm font-semibold text-right max-w-[60%]">{value}</span>
                    </div>
                  ))}
                </div>

                {estado.error && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                    {estado.error}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => irAPaso(3)} disabled={estado.cargando}>
                    ← Atrás
                  </Button>
                  <Button onClick={handleConfirmar} disabled={estado.cargando} className="flex-1">
                    {estado.cargando ? 'Agendando...' : '✓ Confirmar Cita'}
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </main>
    </div>
  )
}
