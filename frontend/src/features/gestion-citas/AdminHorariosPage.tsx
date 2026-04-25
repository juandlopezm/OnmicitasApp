import { useEffect, useState } from 'react'
import { AdminNavbar } from '../../layout/AdminNavbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getSedes } from './services/citasService'
import {
  getMedicosAdmin, getJornadasMedico, agregarJornada, eliminarJornada,
  getHorariosAdmin, generarHorarios, eliminarHorario,
  getDiasNoHabiles, agregarDiaNoHabil, eliminarDiaNoHabil,
  labelDia, trimHora, formatFechaCorta, DIAS_SEMANA,
  type MedicoAdmin, type JornadaAdmin, type HorarioAdmin, type DiaNoHabilAdmin,
} from './services/horarioAdminService'
import type { Sede } from '../../types'
import {
  ChevronDown, ChevronRight, Plus, Trash2, Loader2,
  CalendarClock, CalendarOff, Stethoscope, RefreshCw, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Helpers de UI ──────────────────────────────────────────────────────────

type Tab = 'jornadas' | 'horarios' | 'dias'

const ESTADO_BADGE: Record<HorarioAdmin['estado'], string> = {
  disponible: 'bg-success/15 text-success border-success/30',
  ocupado:    'bg-blue-100 text-blue-700 border-blue-200',
  bloqueado:  'bg-destructive/15 text-destructive border-destructive/30',
}

const ESTADO_LABEL: Record<HorarioAdmin['estado'], string> = {
  disponible: 'Disponible',
  ocupado:    'Ocupado',
  bloqueado:  'Bloqueado',
}

const inputCls = 'h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 w-full'
const selectCls = inputCls

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2 text-sm font-medium rounded-md transition-colors',
        active ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export function AdminHorariosPage() {
  const [tab, setTab] = useState<Tab>('jornadas')

  // Datos compartidos
  const [medicos, setMedicos] = useState<MedicoAdmin[]>([])
  const [sedes, setSedes]     = useState<Sede[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    Promise.all([getMedicosAdmin(), getSedes()])
      .then(([m, s]) => { setMedicos(m); setSedes(s) })
      .finally(() => setCargando(false))
  }, [])

  if (cargando) return (
    <div className="min-h-screen bg-muted/30">
      <AdminNavbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-muted-foreground text-sm">Cargando...</p>
      </main>
    </div>
  )

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminNavbar />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Horarios</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Administra jornadas, genera slots y gestiona días no hábiles
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <TabBtn active={tab === 'jornadas'} onClick={() => setTab('jornadas')}>
            <Stethoscope className="size-3.5 inline mr-1.5" />Médicos y Jornadas
          </TabBtn>
          <TabBtn active={tab === 'horarios'} onClick={() => setTab('horarios')}>
            <CalendarClock className="size-3.5 inline mr-1.5" />Horarios
          </TabBtn>
          <TabBtn active={tab === 'dias'} onClick={() => setTab('dias')}>
            <CalendarOff className="size-3.5 inline mr-1.5" />Días no hábiles
          </TabBtn>
        </div>

        {tab === 'jornadas' && (
          <TabJornadas medicos={medicos} sedes={sedes} />
        )}
        {tab === 'horarios' && (
          <TabHorarios medicos={medicos} sedes={sedes} />
        )}
        {tab === 'dias' && (
          <TabDiasNoHabiles />
        )}
      </main>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 — Médicos y Jornadas
// ══════════════════════════════════════════════════════════════════════════════

function TabJornadas({ medicos, sedes }: { medicos: MedicoAdmin[]; sedes: Sede[] }) {
  const [expandido, setExpandido]   = useState<string | null>(null)
  const [jornadasMap, setJornadasMap] = useState<Record<string, JornadaAdmin[]>>({})
  const [cargandoId, setCargandoId] = useState<string | null>(null)
  const [errores, setErrores]       = useState<Record<string, string>>({})

  // Form nueva jornada por médico
  const [form, setForm] = useState<Record<string, {
    sedeId: string; diaSemana: number; horaInicio: string; horaFin: string; duracionCitaMin: number
  }>>({})

  function formOf(id: string) {
    return form[id] ?? { sedeId: sedes[0]?.id ?? '', diaSemana: 0, horaInicio: '08:00', horaFin: '17:00', duracionCitaMin: 30 }
  }
  function setFormField(medicoId: string, field: string, value: string | number) {
    setForm(prev => ({ ...prev, [medicoId]: { ...formOf(medicoId), [field]: value } }))
  }

  async function handleExpand(medico: MedicoAdmin) {
    if (expandido === medico.id) { setExpandido(null); return }
    setExpandido(medico.id)
    if (jornadasMap[medico.id]) return   // ya cargadas
    setCargandoId(medico.id)
    try {
      const j = await getJornadasMedico(medico.id)
      setJornadasMap(prev => ({ ...prev, [medico.id]: j }))
    } finally {
      setCargandoId(null)
    }
  }

  async function handleAgregarJornada(medicoId: string) {
    const f = formOf(medicoId)
    if (!f.sedeId) return
    setCargandoId(medicoId)
    setErrores(prev => ({ ...prev, [medicoId]: '' }))
    try {
      const nueva = await agregarJornada(medicoId, f)
      setJornadasMap(prev => ({ ...prev, [medicoId]: [...(prev[medicoId] ?? []), nueva] }))
    } catch (e) {
      setErrores(prev => ({ ...prev, [medicoId]: (e as Error).message }))
    } finally {
      setCargandoId(null)
    }
  }

  async function handleEliminarJornada(medicoId: string, jornadaId: string) {
    setCargandoId(medicoId)
    try {
      await eliminarJornada(medicoId, jornadaId)
      setJornadasMap(prev => ({
        ...prev,
        [medicoId]: (prev[medicoId] ?? []).filter(j => j.id !== jornadaId),
      }))
    } catch (e) {
      setErrores(prev => ({ ...prev, [medicoId]: (e as Error).message }))
    } finally {
      setCargandoId(null)
    }
  }

  if (medicos.length === 0) return (
    <p className="text-sm text-muted-foreground">No hay médicos activos registrados.</p>
  )

  return (
    <div className="space-y-3">
      {medicos.map(medico => {
        const abierto   = expandido === medico.id
        const jornadas  = jornadasMap[medico.id] ?? []
        const cargandoM = cargandoId === medico.id
        const f         = formOf(medico.id)

        return (
          <Card key={medico.id} className={cn('transition-shadow', abierto && 'shadow-md')}>
            {/* Encabezado del médico */}
            <button
              className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/40 transition-colors rounded-xl"
              onClick={() => handleExpand(medico)}
            >
              <div className="size-9 rounded-full bg-primary/15 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                {(medico.nombres.charAt(0) + medico.apellidos.charAt(0)).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{medico.nombre}</p>
                <p className="text-xs text-muted-foreground">{medico.especialidadNombre}</p>
              </div>
              {jornadasMap[medico.id] && (
                <span className="text-xs text-muted-foreground mr-2">
                  {jornadas.length} jornada{jornadas.length !== 1 ? 's' : ''}
                </span>
              )}
              {cargandoM
                ? <Loader2 className="size-4 animate-spin text-muted-foreground" />
                : abierto
                  ? <ChevronDown className="size-4 text-muted-foreground" />
                  : <ChevronRight className="size-4 text-muted-foreground" />
              }
            </button>

            {/* Panel expandible */}
            {abierto && !cargandoM && (
              <div className="border-t px-4 pb-4 pt-3 space-y-4">
                {errores[medico.id] && (
                  <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">
                    {errores[medico.id]}
                  </p>
                )}

                {/* Tabla de jornadas existentes */}
                {jornadas.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Día</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Sede</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Inicio</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Fin</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Duración</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {jornadas.map(j => {
                          const sede = sedes.find(s => s.id === j.sedeId)
                          return (
                            <tr key={j.id} className="hover:bg-muted/20">
                              <td className="px-3 py-2 font-medium">{labelDia(j.diaSemana)}</td>
                              <td className="px-3 py-2 text-muted-foreground">{sede?.nombre ?? `Sede ${j.sedeId}`}</td>
                              <td className="px-3 py-2">{trimHora(j.horaInicio)}</td>
                              <td className="px-3 py-2">{trimHora(j.horaFin)}</td>
                              <td className="px-3 py-2">{j.duracionCitaMin} min</td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  onClick={() => handleEliminarJornada(medico.id, j.id)}
                                  className="text-muted-foreground hover:text-destructive transition-colors"
                                  title="Eliminar jornada"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Este médico no tiene jornadas definidas.
                  </p>
                )}

                {/* Formulario agregar jornada */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                    Agregar jornada
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                    <div>
                      <label className="text-xs text-muted-foreground">Día</label>
                      <select
                        className={selectCls}
                        value={f.diaSemana}
                        onChange={e => setFormField(medico.id, 'diaSemana', Number(e.target.value))}
                      >
                        {DIAS_SEMANA.map((d, i) => (
                          <option key={i} value={i}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Sede</label>
                      <select
                        className={selectCls}
                        value={f.sedeId}
                        onChange={e => setFormField(medico.id, 'sedeId', e.target.value)}
                      >
                        {sedes.map(s => (
                          <option key={s.id} value={s.id}>{s.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Inicio</label>
                      <input
                        type="time"
                        className={inputCls}
                        value={f.horaInicio}
                        onChange={e => setFormField(medico.id, 'horaInicio', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Fin</label>
                      <input
                        type="time"
                        className={inputCls}
                        value={f.horaFin}
                        onChange={e => setFormField(medico.id, 'horaFin', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Min/cita</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          min={10}
                          max={120}
                          step={5}
                          className={cn(inputCls, 'w-20')}
                          value={f.duracionCitaMin}
                          onChange={e => setFormField(medico.id, 'duracionCitaMin', Number(e.target.value))}
                        />
                        <Button size="sm" onClick={() => handleAgregarJornada(medico.id)}>
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 — Horarios / Slots
// ══════════════════════════════════════════════════════════════════════════════

function TabHorarios({ medicos, sedes }: { medicos: MedicoAdmin[]; sedes: Sede[] }) {
  const [medicoId, setMedicoId]   = useState(medicos[0]?.id ?? '')
  const [genDesde, setGenDesde]   = useState('')
  const [genHasta, setGenHasta]   = useState('')
  const [horarios, setHorarios]   = useState<HorarioAdmin[]>([])
  const [cargando, setCargando]   = useState(false)
  const [generando, setGenerando] = useState(false)
  const [msg, setMsg]             = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null)
  // Filtros de tabla
  const [filtroFecha, setFiltroFecha]   = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  // Auto-load slots when medico changes
  useEffect(() => {
    if (medicoId) handleCargar()
  }, [medicoId])  // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCargar() {
    if (!medicoId) return
    setCargando(true); setMsg(null)
    try {
      const h = await getHorariosAdmin(medicoId)
      setHorarios(h)
    } catch (e) {
      setMsg({ tipo: 'err', texto: (e as Error).message })
    } finally {
      setCargando(false)
    }
  }

  async function handleGenerar() {
    if (!medicoId || !genDesde || !genHasta) return
    setGenerando(true); setMsg(null)
    try {
      const total = await generarHorarios(medicoId, genDesde, genHasta)
      if (total === 0) {
        setMsg({
          tipo: 'err',
          texto: 'No se generaron horarios. Verifica que el médico tiene jornadas y que el rango de fechas incluye los días configurados.',
        })
      } else {
        setMsg({ tipo: 'ok', texto: `${total} horarios generados correctamente.` })
      }
      handleCargar()          // refrescar tabla
    } catch (e) {
      setMsg({ tipo: 'err', texto: (e as Error).message })
      setGenerando(false)
    }
  }

  async function handleEliminar(id: string) {
    try {
      await eliminarHorario(id)
      setHorarios(prev => prev.filter(h => h.id !== id))
    } catch (e) {
      setMsg({ tipo: 'err', texto: (e as Error).message })
    }
  }

  const tabla = horarios
    .filter(h => !filtroFecha  || h.fecha  === filtroFecha)
    .filter(h => !filtroEstado || h.estado === filtroEstado)
    .slice(0, 200)   // max 200 filas visible

  return (
    <div className="space-y-4">
      {/* Panel de controles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Generar horarios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Médico</label>
              <select
                className={selectCls}
                value={medicoId}
                onChange={e => { setMedicoId(e.target.value); setHorarios([]); setMsg(null) }}
              >
                {medicos.map(m => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Desde</label>
              <input type="date" className={inputCls} value={genDesde} onChange={e => setGenDesde(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Hasta</label>
              <input type="date" className={inputCls} value={genHasta} onChange={e => setGenHasta(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleCargar}
                disabled={!medicoId || cargando}
              >
                {cargando ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5 mr-1" />}
                Cargar
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleGenerar}
                disabled={!medicoId || !genDesde || !genHasta || generando}
              >
                {generando ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Plus className="size-3.5 mr-1" />}
                Generar
              </Button>
            </div>
          </div>

          {msg && (
            <div className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm',
              msg.tipo === 'ok'
                ? 'bg-success/10 border border-success/30 text-success-foreground'
                : 'bg-destructive/10 border border-destructive/30 text-destructive'
            )}>
              {msg.tipo === 'ok' ? <Check className="size-4 shrink-0" /> : null}
              {msg.texto}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabla de horarios */}
      {horarios.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-base">
                Horarios — {medicos.find(m => m.id === medicoId)?.nombre}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({tabla.length} de {horarios.length})
                </span>
              </CardTitle>
              <div className="flex gap-2">
                <input
                  type="date"
                  className={cn(inputCls, 'w-auto')}
                  value={filtroFecha}
                  onChange={e => setFiltroFecha(e.target.value)}
                  placeholder="Filtrar fecha"
                  title="Filtrar por fecha"
                />
                <select
                  className={cn(selectCls, 'w-36')}
                  value={filtroEstado}
                  onChange={e => setFiltroEstado(e.target.value)}
                >
                  <option value="">Todos los estados</option>
                  <option value="disponible">Disponible</option>
                  <option value="ocupado">Ocupado</option>
                  <option value="bloqueado">Bloqueado</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Fecha</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Día</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Hora</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Sede</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Estado</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tabla.map(h => {
                    const sede = sedes.find(s => s.id === h.sedeId)
                    const diasSemana = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
                    const diaN = new Date(h.fecha + 'T00:00:00').getDay()
                    return (
                      <tr key={h.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2 font-medium">{formatFechaCorta(h.fecha)}</td>
                        <td className="px-4 py-2 text-muted-foreground">{diasSemana[diaN]}</td>
                        <td className="px-4 py-2">{trimHora(h.horaInicio)}</td>
                        <td className="px-4 py-2 text-muted-foreground text-xs">{sede?.nombre ?? `Sede ${h.sedeId}`}</td>
                        <td className="px-4 py-2">
                          <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', ESTADO_BADGE[h.estado])}>
                            {ESTADO_LABEL[h.estado]}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {h.estado !== 'ocupado' && (
                            <button
                              onClick={() => handleEliminar(h.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              title="Eliminar horario"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3 — Días no hábiles
// ══════════════════════════════════════════════════════════════════════════════

function TabDiasNoHabiles() {
  const [dias, setDias]           = useState<DiaNoHabilAdmin[]>([])
  const [cargando, setCargando]   = useState(true)
  const [fecha, setFecha]         = useState('')
  const [descripcion, setDesc]    = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    getDiasNoHabiles()
      .then(setDias)
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  async function handleAgregar() {
    if (!fecha) return
    setGuardando(true); setError('')
    try {
      const nuevo = await agregarDiaNoHabil(fecha, descripcion)
      setDias(prev => [...prev, nuevo].sort((a, b) => a.fecha.localeCompare(b.fecha)))
      setFecha(''); setDesc('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  async function handleEliminar(id: string) {
    try {
      await eliminarDiaNoHabil(id)
      setDias(prev => prev.filter(d => d.id !== id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Agregar día no hábil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Fecha</label>
              <input
                type="date"
                className={cn(inputCls, 'w-44')}
                value={fecha}
                onChange={e => setFecha(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-48">
              <label className="text-xs text-muted-foreground">Descripción (opcional)</label>
              <input
                className={inputCls}
                placeholder="Ej: Día festivo nacional"
                value={descripcion}
                onChange={e => setDesc(e.target.value)}
              />
            </div>
            <Button onClick={handleAgregar} disabled={!fecha || guardando} size="sm">
              {guardando ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Plus className="size-3.5 mr-1" />}
              Agregar
            </Button>
          </div>
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Días registrados
            <span className="ml-2 text-sm font-normal text-muted-foreground">({dias.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {cargando ? (
            <p className="text-sm text-muted-foreground px-4 py-4">Cargando...</p>
          ) : dias.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-4 italic">
              No hay días no hábiles registrados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Fecha</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Descripción</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dias.map(d => (
                    <tr key={d.id} className="hover:bg-muted/20">
                      <td className="px-4 py-2 font-medium">{formatFechaCorta(d.fecha)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{d.descripcion || '—'}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => handleEliminar(d.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
