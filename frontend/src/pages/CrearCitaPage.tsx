import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCitas } from '../hooks/useCitas'
import { Navbar } from '../components/layout/Navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectItem } from '@/components/ui/select'
import {
  getEspecialidades,
  getMedicosByEspecialidad,
  getHorariosDisponibles,
  getSedes,
} from '../services/citasService'
import { obtenerProximos7Dias, formatearFecha, formatearHora } from '../utils/dateUtils'
import type { Especialidad, HorarioDisponible, Medico, Sede } from '../types'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const PASOS = ['Especialidad', 'Médico', 'Fecha, Hora y Sede', 'Confirmar']

export function CrearCitaPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const {
    estado, setEspecialidad, setMedico, setFecha, setHora, setSede, irAPaso, confirmar, reiniciar,
  } = useCitas()

  const [especialidades, setEspecialidades] = useState<Especialidad[]>([])
  const [medicos, setMedicos] = useState<Medico[]>([])
  const [horarios, setHorarios] = useState<HorarioDisponible[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const fechasDisponibles = obtenerProximos7Dias()

  useEffect(() => { getEspecialidades().then(setEspecialidades) }, [])
  useEffect(() => {
    if (estado.especialidadId) getMedicosByEspecialidad(estado.especialidadId).then(setMedicos)
  }, [estado.especialidadId])
  useEffect(() => {
    if (estado.medicoId && estado.fecha) {
      getHorariosDisponibles(estado.medicoId, estado.fecha).then(setHorarios)
    } else {
      setHorarios([])
    }
  }, [estado.medicoId, estado.fecha])
  useEffect(() => {
    if (estado.paso === 3) getSedes().then(setSedes)
  }, [estado.paso])

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

  // El paso 3 avanza al 4 solo cuando hay fecha + hora + sede
  const puedeAvanzarPaso3 = !!estado.fecha && !!estado.hora && !!estado.sedeId

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
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {especialidades.map(esp => (
                    <button
                      key={esp.id}
                      onClick={() => setEspecialidad(esp.id)}
                      className={cn(
                        'flex flex-col gap-1 p-4 rounded-lg border-2 text-left transition-all',
                        'hover:border-primary hover:bg-primary/5',
                        estado.especialidadId === esp.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-background'
                      )}
                    >
                      <span className="font-semibold text-sm">{esp.nombre}</span>
                      <span className="text-xs text-muted-foreground">{esp.descripcion}</span>
                    </button>
                  ))}
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
                      onClick={() => setMedico(med.id)}
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
                  <Select
                    value={estado.fecha}
                    onChange={e => setFecha(e.target.value)}
                    placeholder="-- Selecciona una fecha --"
                  >
                    {fechasDisponibles.map(f => (
                      <SelectItem key={f} value={f}>{formatearFecha(f)}</SelectItem>
                    ))}
                  </Select>
                </div>

                {/* Horarios */}
                {estado.fecha && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Horarios disponibles</label>
                    {horarios.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No hay horarios disponibles para esta fecha.
                      </p>
                    ) : (
                      <div className="horario-grid">
                        {horarios.map(h => (
                          <button
                            key={h.id}
                            onClick={() => setHora(h.hora, h.id)}
                            className={cn(
                              'px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all',
                              estado.hora === h.hora
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border hover:border-primary hover:bg-primary/5'
                            )}
                          >
                            {formatearHora(h.hora)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Sede */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Sede de atención</label>
                  <Select
                    value={estado.sedeId}
                    onChange={e => setSede(e.target.value)}
                    placeholder="-- Selecciona una sede --"
                  >
                    {sedes.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre} — {s.direccion}
                      </SelectItem>
                    ))}
                  </Select>
                </div>

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
