import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AdminNavbar } from '../../layout/AdminNavbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { Badge } from '@/components/ui/badge'
import {
  getEspecialidades,
  getMedicosByEspecialidad,
  getHorariosAdmin,
  getSedes,
  crearCitaAdmin,
} from './services/citasService'
import { getAfiliados } from '../gestion-afiliados/services/afiliadosService'
import { obtenerFechaEnDias, formatearFecha, formatearHora } from '../../utils/dateUtils'
import type { Afiliado, Especialidad, HorarioDisponible, Medico, Sede } from '../../types'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const PASOS = ['Afiliado', 'Especialidad', 'Médico', 'Fecha, Hora y Sede', 'Confirmar']

interface Estado {
  paso: 1 | 2 | 3 | 4 | 5
  afiliadoId: string
  especialidadId: string
  medicoId: string
  sedeId: string
  fecha: string
  hora: string
  horarioId: string
  cargando: boolean
  error: string | null
}

const INICIAL: Estado = {
  paso: 1, afiliadoId: '', especialidadId: '', medicoId: '',
  sedeId: '', fecha: '', hora: '', horarioId: '',
  cargando: false, error: null,
}

export function AdminCrearCitaPage() {
  const navigate = useNavigate()
  const [estado, setEstado] = useState<Estado>(INICIAL)

  const [afiliados, setAfiliados] = useState<Afiliado[]>([])
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([])
  const [medicos, setMedicos] = useState<Medico[]>([])
  const [horarios, setHorarios] = useState<HorarioDisponible[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [busquedaAfiliado, setBusquedaAfiliado] = useState('')

  // Admin puede ver 30 días de disponibilidad (sin restricción de 7 días del afiliado)
  const minFecha = obtenerFechaEnDias(1)
  const maxFecha = obtenerFechaEnDias(30)

  // Cargar catálogos según el paso
  useEffect(() => {
    getAfiliados().then(all =>
      setAfiliados(all.filter(a => a.tipo === 'cotizante' && a.estado === 'activo'))
    )
  }, [])

  useEffect(() => {
    if (estado.paso >= 2) getEspecialidades().then(setEspecialidades)
  }, [estado.paso])

  useEffect(() => {
    if (estado.especialidadId) getMedicosByEspecialidad(estado.especialidadId).then(setMedicos)
  }, [estado.especialidadId])

  useEffect(() => {
    if (estado.medicoId && estado.fecha) {
      // Admin usa endpoint propio: @admin_required, sin filtro 24h
      getHorariosAdmin(estado.medicoId, estado.fecha).then(setHorarios)
    } else {
      setHorarios([])
    }
  }, [estado.medicoId, estado.fecha])

  useEffect(() => { getSedes().then(setSedes) }, [])

  function irAPaso(paso: Estado['paso']) {
    setEstado(prev => ({ ...prev, paso, error: null }))
  }

  const afiliados_filtrados = afiliados.filter(a =>
    busquedaAfiliado
      ? `${a.nombres} ${a.apellidos} ${a.numeroDocumento}`.toLowerCase()
          .includes(busquedaAfiliado.toLowerCase())
      : true
  )

  const afiliadoSel    = afiliados.find(a => a.id === estado.afiliadoId)
  const especialidadSel = especialidades.find(e => e.id === estado.especialidadId)
  const medicoSel      = medicos.find(m => m.id === estado.medicoId)
  const sedeSel        = sedes.find(s => s.id === estado.sedeId)

  const puedeAvanzarPaso4 = !!estado.fecha && !!estado.hora && !!estado.sedeId

  async function handleConfirmar() {
    setEstado(prev => ({ ...prev, cargando: true, error: null }))
    const resultado = await crearCitaAdmin({
      afiliadoId:          estado.afiliadoId,
      especialidadId:      estado.especialidadId,
      especialidadNombre:  especialidadSel?.nombre ?? '',
      sedeId:              estado.sedeId,
      sedeNombre:          sedeSel?.nombre ?? '',
      medicoNombre:        medicoSel?.nombre ?? '',
      horarioId:           estado.horarioId,
    })
    if (resultado.ok) {
      navigate('/admin/citas')
    } else {
      setEstado(prev => ({ ...prev, cargando: false, error: resultado.error ?? 'Error al crear la cita.' }))
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminNavbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Nueva Cita (Admin)</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Agenda una cita para cualquier afiliado activo</p>
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
          {/* Paso 1 — Afiliado */}
          {estado.paso === 1 && (
            <>
              <CardHeader>
                <CardTitle>Selecciona el afiliado</CardTitle>
                <CardDescription>Solo cotizantes activos pueden tener citas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <input
                  type="text"
                  value={busquedaAfiliado}
                  onChange={e => setBusquedaAfiliado(e.target.value)}
                  placeholder="Buscar por nombre o documento..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="max-h-64 overflow-y-auto flex flex-col gap-2">
                  {afiliados_filtrados.map(af => (
                    <button
                      key={af.id}
                      onClick={() => setEstado(prev => ({ ...prev, afiliadoId: af.id, paso: 2 }))}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border-2 text-left transition-all',
                        'hover:border-primary hover:bg-primary/5',
                        estado.afiliadoId === af.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-background'
                      )}
                    >
                      <div>
                        <p className="font-medium text-sm">{af.nombres} {af.apellidos}</p>
                        <p className="text-xs text-muted-foreground">{af.tipoDocumento} {af.numeroDocumento}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">{af.ipsMedica}</Badge>
                    </button>
                  ))}
                  {afiliados_filtrados.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">Sin resultados</p>
                  )}
                </div>
              </CardContent>
            </>
          )}

          {/* Paso 2 — Especialidad */}
          {estado.paso === 2 && (
            <>
              <CardHeader>
                <CardTitle>Especialidad</CardTitle>
                <CardDescription>
                  Afiliado: <strong>{afiliadoSel?.nombres} {afiliadoSel?.apellidos}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {especialidades.map(esp => (
                    <button
                      key={esp.id}
                      onClick={() => setEstado(prev => ({ ...prev, especialidadId: esp.id, medicoId: '', paso: 3 }))}
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
                <div className="flex justify-start pt-4">
                  <Button variant="outline" size="sm" onClick={() => irAPaso(1)}>← Atrás</Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Paso 3 — Médico */}
          {estado.paso === 3 && (
            <>
              <CardHeader>
                <CardTitle>Médico</CardTitle>
                <CardDescription>Especialidad: <strong>{especialidadSel?.nombre}</strong></CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  {medicos.map(med => (
                    <button
                      key={med.id}
                      onClick={() => setEstado(prev => ({ ...prev, medicoId: med.id, fecha: '', hora: '', paso: 4 }))}
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
                  <Button variant="outline" size="sm" onClick={() => irAPaso(2)}>← Atrás</Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Paso 4 — Fecha, Hora y Sede */}
          {estado.paso === 4 && (
            <>
              <CardHeader>
                <CardTitle>Fecha, Hora y Sede</CardTitle>
                <CardDescription>Médico: <strong>{medicoSel?.nombre}</strong></CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Fecha</label>
                  <DatePicker
                    value={estado.fecha}
                    onChange={v => setEstado(prev => ({ ...prev, fecha: v, hora: '' }))}
                    minDate={minFecha}
                    maxDate={maxFecha}
                  />
                </div>

                {estado.fecha && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Horarios disponibles</label>
                    {horarios.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hay horarios disponibles para esta fecha.</p>
                    ) : (
                      <div className="horario-grid">
                        {horarios.map(h => {
                          const sede = sedes.find(s => s.id === h.sedeId)
                          return (
                            <button
                              key={h.id}
                              onClick={() => setEstado(prev => ({
                                ...prev,
                                hora: h.hora,
                                horarioId: h.id,
                                sedeId: h.sedeId,
                              }))}
                              className={cn(
                                'px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all',
                                estado.hora === h.hora
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border hover:border-primary hover:bg-primary/5'
                              )}
                              title={sede ? `${sede.nombre} — ${sede.direccion}` : undefined}
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
                      {sedeSel ? `${sedeSel.nombre} — ${sedeSel.direccion}` : estado.sedeId}
                    </p>
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <Button variant="outline" size="sm" onClick={() => irAPaso(3)}>← Atrás</Button>
                  {puedeAvanzarPaso4 && (
                    <Button size="sm" onClick={() => irAPaso(5)}>Continuar →</Button>
                  )}
                </div>
              </CardContent>
            </>
          )}

          {/* Paso 5 — Confirmar */}
          {estado.paso === 5 && (
            <>
              <CardHeader>
                <CardTitle>Confirmar Cita</CardTitle>
                <CardDescription>Revisa los detalles antes de guardar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border divide-y">
                  {[
                    { label: 'Afiliado',      value: `${afiliadoSel?.nombres} ${afiliadoSel?.apellidos}` },
                    { label: 'Especialidad',  value: especialidadSel?.nombre },
                    { label: 'Médico',        value: medicoSel?.nombre },
                    { label: 'Sede',          value: sedeSel ? `${sedeSel.nombre} — ${sedeSel.direccion}` : '' },
                    { label: 'Fecha',         value: formatearFecha(estado.fecha) },
                    { label: 'Hora',          value: formatearHora(estado.hora) },
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
                  <Button variant="outline" onClick={() => irAPaso(4)} disabled={estado.cargando}>
                    ← Atrás
                  </Button>
                  <Button onClick={handleConfirmar} disabled={estado.cargando} className="flex-1">
                    {estado.cargando ? 'Guardando...' : '✓ Confirmar Cita'}
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>

        <div className="mt-4">
          <Link to="/admin/citas" className="text-sm text-muted-foreground hover:text-foreground underline">
            ← Volver a la lista de citas
          </Link>
        </div>
      </main>
    </div>
  )
}
