import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AdminNavbar } from '../../layout/AdminNavbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Loader2, Plus, Trash2,
  ChevronLeft, ChevronRight, Stethoscope, CalendarDays, ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getMedicoDetalle, getSedes, getCitasAdmin, agregarJornada, eliminarJornada,
  labelDia, trimHora, formatFecha, DIAS_SEMANA,
  type MedicoAdmin, type JornadaAdmin, type SedeAdmin, type CitaAdmin,
} from './services/medicoAdminService'

// ── Shared ─────────────────────────────────────────────────────────────────
const inputCls = 'h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 w-full'
const selectCls = inputCls

type Tab = 'jornadas' | 'calendario' | 'citas'

const ESTADO_COLOR: Record<string, string> = {
  programada:  'bg-blue-100 text-blue-700 border-blue-200',
  confirmada:  'bg-violet-100 text-violet-700 border-violet-200',
  completada:  'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelada:   'bg-red-100 text-red-600 border-red-200',
  no_asistio:  'bg-orange-100 text-orange-600 border-orange-200',
  reagendada:  'bg-amber-100 text-amber-700 border-amber-200',
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB JORNADAS
// ══════════════════════════════════════════════════════════════════════════════

function TabJornadas({
  medico, sedes, jornadas, setJornadas,
}: {
  medico: MedicoAdmin
  sedes: SedeAdmin[]
  jornadas: JornadaAdmin[]
  setJornadas: React.Dispatch<React.SetStateAction<JornadaAdmin[]>>
}) {
  const [form, setForm] = useState({
    sedeId: sedes[0]?.id ?? '',
    diaSemana: 0,
    horaInicio: '08:00',
    horaFin: '17:00',
    duracionCitaMin: 30,
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function handleAgregar() {
    if (!form.sedeId) return
    setGuardando(true); setError('')
    try {
      const nueva = await agregarJornada(medico.id, form)
      setJornadas(prev => [...prev, nueva])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  async function handleEliminar(j: JornadaAdmin) {
    try {
      await eliminarJornada(medico.id, j.id)
      setJornadas(prev => prev.filter(x => x.id !== j.id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      {/* Jornadas existentes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Jornadas definidas
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({jornadas.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {jornadas.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 pb-4 italic">
              No hay jornadas definidas. Agrégalas abajo para poder generar horarios.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Día</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Sede</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Inicio</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Fin</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Duración</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {jornadas.map(j => {
                    const sede = sedes.find(s => s.id === j.sedeId)
                    return (
                      <tr key={j.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2 font-medium">{labelDia(j.diaSemana)}</td>
                        <td className="px-4 py-2 text-muted-foreground">{sede?.nombre ?? `Sede ${j.sedeId}`}</td>
                        <td className="px-4 py-2">{trimHora(j.horaInicio)}</td>
                        <td className="px-4 py-2">{trimHora(j.horaFin)}</td>
                        <td className="px-4 py-2">{j.duracionCitaMin} min</td>
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => handleEliminar(j)}
                            className="text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Formulario agregar jornada */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Agregar jornada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Día</label>
              <select className={selectCls} value={form.diaSemana}
                onChange={e => setForm(p => ({ ...p, diaSemana: Number(e.target.value) }))}>
                {DIAS_SEMANA.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Sede</label>
              <select className={selectCls} value={form.sedeId}
                onChange={e => setForm(p => ({ ...p, sedeId: e.target.value }))}>
                {sedes.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Inicio</label>
              <input type="time" className={inputCls} value={form.horaInicio}
                onChange={e => setForm(p => ({ ...p, horaInicio: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Fin</label>
              <input type="time" className={inputCls} value={form.horaFin}
                onChange={e => setForm(p => ({ ...p, horaFin: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Min/cita</label>
              <div className="flex gap-2 items-center">
                <input type="number" min={10} max={120} step={5}
                  className={cn(inputCls, 'w-20')}
                  value={form.duracionCitaMin}
                  onChange={e => setForm(p => ({ ...p, duracionCitaMin: Number(e.target.value) }))} />
                <Button size="sm" onClick={handleAgregar} disabled={guardando}>
                  {guardando ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB CALENDARIO (del médico)
// ══════════════════════════════════════════════════════════════════════════════

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]
const DIAS_CORTOS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

function TabCalendario({ medicoId }: { medicoId: string }) {
  const hoy = new Date()
  const [year, setYear]   = useState(hoy.getFullYear())
  const [month, setMonth] = useState(hoy.getMonth())
  const [citas, setCitas] = useState<CitaAdmin[]>([])
  const [cargando, setCargando] = useState(false)
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null)

  function primeroDia() {
    return new Date(year, month, 1).toISOString().slice(0, 10)
  }
  function ultimoDia() {
    return new Date(year, month + 1, 0).toISOString().slice(0, 10)
  }

  useEffect(() => {
    setCargando(true)
    getCitasAdmin({ medico_id: medicoId, desde: primeroDia(), hasta: ultimoDia() })
      .then(setCitas)
      .finally(() => setCargando(false))
  }, [medicoId, year, month])

  function navMes(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
    setDiaSeleccionado(null)
  }

  const diasEnMes = new Date(year, month + 1, 0).getDate()
  const primerDiaSemana = (new Date(year, month, 1).getDay() + 6) % 7

  const celdas: (number | null)[] = [
    ...Array(primerDiaSemana).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ]
  while (celdas.length % 7 !== 0) celdas.push(null)

  const citasPorDia: Record<string, CitaAdmin[]> = {}
  for (const c of citas) {
    if (!citasPorDia[c.fecha]) citasPorDia[c.fecha] = []
    citasPorDia[c.fecha].push(c)
  }

  const todayStr = hoy.toISOString().slice(0, 10)
  function fechaDia(dia: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  }

  const citasSeleccionadas = diaSeleccionado ? (citasPorDia[diaSeleccionado] ?? []) : []

  return (
    <div className="space-y-4">
      {/* Nav */}
      <div className="flex items-center gap-3">
        <button onClick={() => navMes(-1)} className="p-1.5 rounded hover:bg-muted transition-colors border">
          <ChevronLeft className="size-4" />
        </button>
        <span className="font-semibold text-sm min-w-36 text-center">
          {MESES[month]} {year}
        </span>
        <button onClick={() => navMes(1)} className="p-1.5 rounded hover:bg-muted transition-colors border">
          <ChevronRight className="size-4" />
        </button>
        {cargando && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        <span className="text-xs text-muted-foreground ml-auto">
          {citas.length} cita{citas.length !== 1 ? 's' : ''} este mes
        </span>
      </div>

      <div className="flex gap-4">
        {/* Grid */}
        <div className="flex-1">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DIAS_CORTOS.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          {/* Cells */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border">
            {celdas.map((dia, i) => {
              if (dia === null) return <div key={`e-${i}`} className="bg-muted/30 min-h-20" />
              const fecha = fechaDia(dia)
              const esHoy = fecha === todayStr
              const sel   = fecha === diaSeleccionado
              const lista = citasPorDia[fecha] ?? []

              return (
                <div
                  key={fecha}
                  onClick={() => setDiaSeleccionado(sel ? null : fecha)}
                  className={cn(
                    'bg-background min-h-20 p-1.5 cursor-pointer hover:bg-muted/30 transition-colors',
                    sel && 'bg-primary/5 ring-1 ring-primary ring-inset'
                  )}
                >
                  <div className={cn(
                    'size-5 flex items-center justify-center rounded-full text-xs font-semibold mb-1',
                    esHoy ? 'bg-primary text-primary-foreground' : 'text-foreground'
                  )}>
                    {dia}
                  </div>
                  <div className="space-y-0.5">
                    {lista.slice(0, 3).map(c => (
                      <div key={c.id} className={cn(
                        'text-[10px] px-1 py-0.5 rounded border truncate leading-tight',
                        ESTADO_COLOR[c.estado] ?? 'bg-muted'
                      )}>
                        {trimHora(c.horaInicio)} {c.pacienteNombre}
                      </div>
                    ))}
                    {lista.length > 3 && (
                      <div className="text-[10px] text-muted-foreground pl-1">+{lista.length - 3} más</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Panel lateral */}
        {diaSeleccionado && (
          <div className="w-64 shrink-0">
            <Card className="h-full">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm">{formatFecha(diaSeleccionado)}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {citasSeleccionadas.length} cita{citasSeleccionadas.length !== 1 ? 's' : ''}
                </p>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-2">
                {citasSeleccionadas.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Sin citas</p>
                ) : citasSeleccionadas
                  .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
                  .map(c => (
                    <div key={c.id} className="border rounded-md p-2 space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-medium truncate">{c.pacienteNombre}</p>
                        <span className={cn(
                          'text-[10px] px-1 py-0.5 rounded-full border font-medium shrink-0',
                          ESTADO_COLOR[c.estado] ?? 'bg-muted'
                        )}>
                          {c.estado}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {trimHora(c.horaInicio)} – {trimHora(c.horaFin)}
                      </p>
                      <p className="text-xs text-muted-foreground">{c.sedeNombre}</p>
                    </div>
                  ))
                }
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(ESTADO_COLOR).map(([estado, cls]) => (
          <span key={estado} className={cn('px-2 py-0.5 rounded-full border font-medium', cls)}>
            {estado}
          </span>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB CITAS
// ══════════════════════════════════════════════════════════════════════════════

function TabCitas({ medicoId }: { medicoId: string }) {
  const [citas, setCitas]     = useState<CitaAdmin[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')

  useEffect(() => {
    getCitasAdmin({ medico_id: medicoId })
      .then(setCitas)
      .finally(() => setCargando(false))
  }, [medicoId])

  const tabla = citas.filter(c => !filtroEstado || c.estado === filtroEstado)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {tabla.length} de {citas.length} citas
        </p>
        <select className={cn(selectCls, 'w-44')} value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {['programada','confirmada','completada','cancelada','no_asistio','reagendada'].map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {cargando ? (
            <p className="text-sm text-muted-foreground px-4 py-6">Cargando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Fecha</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Hora</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Paciente</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Especialidad</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Sede</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Estado</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Canal</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tabla.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-6 text-muted-foreground text-center">
                      Sin citas registradas.
                    </td></tr>
                  ) : tabla.map(c => (
                    <tr key={c.id} className="hover:bg-muted/20">
                      <td className="px-4 py-2 font-medium text-sm">{formatFecha(c.fecha)}</td>
                      <td className="px-4 py-2 text-sm">{trimHora(c.horaInicio)}</td>
                      <td className="px-4 py-2">{c.pacienteNombre}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{c.especialidadNombre}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{c.sedeNombre}</td>
                      <td className="px-4 py-2">
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full border font-medium',
                          ESTADO_COLOR[c.estado] ?? 'bg-muted'
                        )}>
                          {c.estado}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{c.canal}</td>
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

// ══════════════════════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════════════════════

function TabBtn({ active, onClick, icon, children }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors',
        active ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {icon}{children}
    </button>
  )
}

export function AdminMedicoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('jornadas')

  const [medico, setMedico]     = useState<MedicoAdmin | null>(null)
  const [sedes, setSedes]       = useState<SedeAdmin[]>([])
  const [jornadas, setJornadas] = useState<JornadaAdmin[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([getMedicoDetalle(id), getSedes()])
      .then(([m, s]) => {
        setMedico(m)
        setJornadas(m.jornadas ?? [])
        setSedes(s)
      })
      .catch(() => setError('No se pudo cargar el médico.'))
      .finally(() => setCargando(false))
  }, [id])

  if (cargando) return (
    <div className="min-h-screen bg-muted/30">
      <AdminNavbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </main>
    </div>
  )

  if (error || !medico) return (
    <div className="min-h-screen bg-muted/30">
      <AdminNavbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-sm text-destructive">{error || 'Médico no encontrado.'}</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => navigate('/admin/medicos')}>
          <ArrowLeft className="size-3.5 mr-1" />Volver
        </Button>
      </main>
    </div>
  )

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminNavbar />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/medicos')}>
          <ArrowLeft className="size-3.5 mr-1" />Volver a Médicos
        </Button>

        {/* Doctor card */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-full bg-primary/15 text-primary font-bold text-lg flex items-center justify-center shrink-0">
                {(medico.nombres.charAt(0) + medico.apellidos.charAt(0)).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold">{medico.nombre}</h1>
                  <Badge variant={medico.activo ? 'default' : 'secondary'}>
                    {medico.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm">{medico.especialidadNombre}</p>
                {medico.registroMedico && (
                  <p className="text-muted-foreground text-xs mt-0.5">Reg. {medico.registroMedico}</p>
                )}
              </div>
              <div className="text-right text-xs text-muted-foreground shrink-0">
                <p>{jornadas.length} jornada{jornadas.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <TabBtn active={tab === 'jornadas'} onClick={() => setTab('jornadas')}
            icon={<Stethoscope className="size-3.5" />}>Jornadas</TabBtn>
          <TabBtn active={tab === 'calendario'} onClick={() => setTab('calendario')}
            icon={<CalendarDays className="size-3.5" />}>Calendario</TabBtn>
          <TabBtn active={tab === 'citas'} onClick={() => setTab('citas')}
            icon={<ClipboardList className="size-3.5" />}>Citas</TabBtn>
        </div>

        {tab === 'jornadas' && (
          <TabJornadas medico={medico} sedes={sedes} jornadas={jornadas} setJornadas={setJornadas} />
        )}
        {tab === 'calendario' && <TabCalendario medicoId={medico.id} />}
        {tab === 'citas' && <TabCitas medicoId={medico.id} />}
      </main>
    </div>
  )
}
