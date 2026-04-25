import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminNavbar } from '../../layout/AdminNavbar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Trash2, Pencil, Check, X, Loader2, ChevronLeft, ChevronRight,
  CalendarDays, Stethoscope, MapPin, ClipboardList, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getMedicos, getSedes, getEspecialidades, getCitasAdmin,
  crearMedico, actualizarMedico, eliminarMedico,
  crearSede, actualizarSede, eliminarSede,
  crearEspecialidad, actualizarEspecialidad, eliminarEspecialidad,
  trimHora,
  type MedicoAdmin, type SedeAdmin, type EspecialidadAdmin, type CitaAdmin,
} from './services/medicoAdminService'

// ── Shared styles ─────────────────────────────────────────────────────────
const inputCls = 'h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 w-full'
const selectCls = inputCls

type Tab = 'medicos' | 'sedes' | 'especialidades'

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

// ══════════════════════════════════════════════════════════════════════════════
// CALENDAR
// ══════════════════════════════════════════════════════════════════════════════

const ESTADO_COLOR: Record<string, string> = {
  programada:  'bg-blue-100 text-blue-700 border-blue-200',
  confirmada:  'bg-violet-100 text-violet-700 border-violet-200',
  completada:  'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelada:   'bg-red-100 text-red-600 border-red-200',
  no_asistio:  'bg-orange-100 text-orange-600 border-orange-200',
  reagendada:  'bg-amber-100 text-amber-700 border-amber-200',
}

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]
const DIAS_CORTOS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

function CalendarioFullPage({
  onClose,
  onMedicoClick,
}: {
  onClose: () => void
  onMedicoClick: (medicoId: string) => void
}) {
  const hoy = new Date()
  const [year, setYear]   = useState(hoy.getFullYear())
  const [month, setMonth] = useState(hoy.getMonth())   // 0-based
  const [citas, setCitas] = useState<CitaAdmin[]>([])
  const [cargando, setCargando] = useState(false)
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null)

  // Rango del mes
  function primeroDia() {
    return new Date(year, month, 1).toISOString().slice(0, 10)
  }
  function ultimoDia() {
    return new Date(year, month + 1, 0).toISOString().slice(0, 10)
  }

  useEffect(() => {
    setCargando(true)
    getCitasAdmin({ desde: primeroDia(), hasta: ultimoDia() })
      .then(setCitas)
      .finally(() => setCargando(false))
  }, [year, month])

  function navMes(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
    setDiaSeleccionado(null)
  }

  // Build calendar grid
  const diasEnMes = new Date(year, month + 1, 0).getDate()
  // getDay() returns 0=Sun…6=Sat; we want 0=Mon
  const primerDiaSemana = (new Date(year, month, 1).getDay() + 6) % 7

  const celdas: (number | null)[] = [
    ...Array(primerDiaSemana).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ]
  // pad to full weeks
  while (celdas.length % 7 !== 0) celdas.push(null)

  // Group citas by fecha
  const citasPorDia: Record<string, CitaAdmin[]> = {}
  for (const c of citas) {
    if (!citasPorDia[c.fecha]) citasPorDia[c.fecha] = []
    citasPorDia[c.fecha].push(c)
  }

  const todayStr = hoy.toISOString().slice(0, 10)
  function fechaDia(dia: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  }

  const citasDiaSeleccionado = diaSeleccionado ? (citasPorDia[diaSeleccionado] ?? []) : []

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <CalendarDays className="size-5 text-primary" />
          <span className="font-bold text-base">Calendario de Citas</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navMes(-1)} className="p-1.5 rounded hover:bg-muted transition-colors">
            <ChevronLeft className="size-4" />
          </button>
          <span className="font-semibold text-sm min-w-36 text-center">
            {MESES[month]} {year}
          </span>
          <button onClick={() => navMes(1)} className="p-1.5 rounded hover:bg-muted transition-colors">
            <ChevronRight className="size-4" />
          </button>
          {cargando && <Loader2 className="size-4 animate-spin text-muted-foreground ml-2" />}
        </div>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-muted transition-colors">
          <X className="size-5" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Grid */}
        <div className="flex-1 overflow-auto p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DIAS_CORTOS.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>
          {/* Cells */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border">
            {celdas.map((dia, i) => {
              if (dia === null) {
                return <div key={`empty-${i}`} className="bg-muted/30 min-h-24" />
              }
              const fecha = fechaDia(dia)
              const esHoy = fecha === todayStr
              const seleccionado = fecha === diaSeleccionado
              const citasDelDia = citasPorDia[fecha] ?? []
              const MAX_VISIBLE = 3

              return (
                <div
                  key={fecha}
                  onClick={() => setDiaSeleccionado(seleccionado ? null : fecha)}
                  className={cn(
                    'bg-background min-h-24 p-1.5 cursor-pointer hover:bg-muted/30 transition-colors',
                    seleccionado && 'bg-primary/5 ring-1 ring-primary ring-inset'
                  )}
                >
                  <div className={cn(
                    'size-6 flex items-center justify-center rounded-full text-xs font-semibold mb-1',
                    esHoy ? 'bg-primary text-primary-foreground' : 'text-foreground'
                  )}>
                    {dia}
                  </div>
                  <div className="space-y-0.5">
                    {citasDelDia.slice(0, MAX_VISIBLE).map(c => (
                      <div
                        key={c.id}
                        onClick={e => { e.stopPropagation(); onMedicoClick(c.medicoId) }}
                        className={cn(
                          'text-[10px] px-1 py-0.5 rounded border truncate cursor-pointer hover:opacity-80 transition-opacity leading-tight',
                          ESTADO_COLOR[c.estado] ?? 'bg-muted text-muted-foreground border-border'
                        )}
                        title={`${trimHora(c.horaInicio)} ${c.pacienteNombre} — ${c.medicoNombre}`}
                      >
                        {trimHora(c.horaInicio)} {c.pacienteNombre}
                      </div>
                    ))}
                    {citasDelDia.length > MAX_VISIBLE && (
                      <div className="text-[10px] text-muted-foreground pl-1">
                        +{citasDelDia.length - MAX_VISIBLE} más
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Side panel — día seleccionado */}
        {diaSeleccionado && (
          <div className="w-80 border-l bg-card flex flex-col">
            <div className="px-4 py-3 border-b">
              <p className="font-semibold text-sm">
                {(() => {
                  const [y, m, d] = diaSeleccionado.split('-')
                  return `${d}/${m}/${y}`
                })()}
              </p>
              <p className="text-xs text-muted-foreground">
                {citasDiaSeleccionado.length} cita{citasDiaSeleccionado.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-2">
              {citasDiaSeleccionado.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin citas este día</p>
              ) : (
                citasDiaSeleccionado
                  .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
                  .map(c => (
                    <Card
                      key={c.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => onMedicoClick(c.medicoId)}
                    >
                      <CardContent className="p-3 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-xs truncate">{c.pacienteNombre}</p>
                            <p className="text-xs text-muted-foreground truncate">{c.medicoNombre}</p>
                          </div>
                          <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0',
                            ESTADO_COLOR[c.estado] ?? 'bg-muted'
                          )}>
                            {c.estado}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {trimHora(c.horaInicio)} – {trimHora(c.horaFin)} · {c.sedeNombre}
                        </p>
                        <p className="text-xs text-muted-foreground">{c.especialidadNombre}</p>
                        <div className="flex items-center gap-1 pt-0.5">
                          <ExternalLink className="size-3 text-primary" />
                          <span className="text-[11px] text-primary">Ver médico</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-6 py-2 border-t bg-card text-xs text-muted-foreground flex-wrap">
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
// TAB MÉDICOS
// ══════════════════════════════════════════════════════════════════════════════

function TabMedicos({
  medicos, setMedicos, especialidades, onDetalle,
}: {
  medicos: MedicoAdmin[]
  setMedicos: React.Dispatch<React.SetStateAction<MedicoAdmin[]>>
  especialidades: EspecialidadAdmin[]
  onDetalle: (id: string) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [form, setForm] = useState({ nombres: '', apellidos: '', registro_medico: '', especialidad_id: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function resetForm() {
    setForm({ nombres: '', apellidos: '', registro_medico: '', especialidad_id: especialidades[0]?.id ?? '' })
    setError('')
  }

  async function handleGuardar() {
    if (!form.nombres || !form.apellidos || !form.especialidad_id) return
    setGuardando(true); setError('')
    try {
      if (editId) {
        const updated = await actualizarMedico(editId, {
          nombres: form.nombres,
          apellidos: form.apellidos,
          registro_medico: form.registro_medico,
          especialidad_id: Number(form.especialidad_id),
        })
        setMedicos(prev => prev.map(m => m.id === editId ? updated : m))
        setEditId(null)
      } else {
        const nuevo = await crearMedico({
          nombres: form.nombres,
          apellidos: form.apellidos,
          registro_medico: form.registro_medico,
          especialidad_id: Number(form.especialidad_id),
        })
        setMedicos(prev => [...prev, nuevo])
        setShowForm(false)
      }
      resetForm()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  async function handleToggleActivo(m: MedicoAdmin) {
    try {
      const updated = await actualizarMedico(m.id, { activo: !m.activo })
      setMedicos(prev => prev.map(x => x.id === m.id ? updated : x))
    } catch { /* ignore */ }
  }

  async function handleEliminar(id: string) {
    try {
      await eliminarMedico(id)
      setMedicos(prev => prev.filter(m => m.id !== id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function startEdit(m: MedicoAdmin) {
    setEditId(m.id)
    setForm({
      nombres: m.nombres,
      apellidos: m.apellidos,
      registro_medico: m.registroMedico,
      especialidad_id: m.especialidadId,
    })
    setShowForm(false)
    setError('')
  }

  const formPanel = (isEdit = false) => (
    <div className="bg-muted/30 rounded-lg p-4 border space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {isEdit ? 'Editar médico' : 'Nuevo médico'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Nombres</label>
          <input className={inputCls} value={form.nombres}
            onChange={e => setForm(p => ({ ...p, nombres: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Apellidos</label>
          <input className={inputCls} value={form.apellidos}
            onChange={e => setForm(p => ({ ...p, apellidos: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Registro médico</label>
          <input className={inputCls} placeholder="RM-XXX" value={form.registro_medico}
            onChange={e => setForm(p => ({ ...p, registro_medico: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Especialidad</label>
          <select className={selectCls} value={form.especialidad_id}
            onChange={e => setForm(p => ({ ...p, especialidad_id: e.target.value }))}>
            {especialidades.map(esp => (
              <option key={esp.id} value={esp.id}>{esp.nombre}</option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={handleGuardar} disabled={guardando}>
          {guardando ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Check className="size-3.5 mr-1" />}
          Guardar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditId(null); resetForm() }}>
          Cancelar
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      {!showForm && !editId && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { setShowForm(true); resetForm() }}>
            <Plus className="size-3.5 mr-1" />Nuevo Médico
          </Button>
        </div>
      )}
      {showForm && !editId && formPanel(false)}

      {medicos.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-8">No hay médicos registrados.</p>
      )}

      {medicos.map(m => (
        <div key={m.id}>
          <Card className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-full bg-primary/15 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                  {(m.nombres.charAt(0) + m.apellidos.charAt(0)).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{m.nombre}</p>
                  <p className="text-xs text-muted-foreground">{m.especialidadNombre}</p>
                  {m.registroMedico && (
                    <p className="text-xs text-muted-foreground">{m.registroMedico}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={m.activo ? 'default' : 'secondary'} className="text-xs">
                    {m.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => onDetalle(m.id)}>
                    <ExternalLink className="size-3.5 mr-1" />Gestionar
                  </Button>
                  <button onClick={() => startEdit(m)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1">
                    <Pencil className="size-3.5" />
                  </button>
                  <button onClick={() => handleToggleActivo(m)}
                    className="text-muted-foreground hover:text-amber-600 transition-colors p-1"
                    title={m.activo ? 'Desactivar' : 'Activar'}>
                    {m.activo ? <X className="size-3.5" /> : <Check className="size-3.5" />}
                  </button>
                  <button onClick={() => handleEliminar(m.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
          {editId === m.id && (
            <div className="mt-2">{formPanel(true)}</div>
          )}
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB SEDES
// ══════════════════════════════════════════════════════════════════════════════

function TabSedes({
  sedes, setSedes,
}: {
  sedes: SedeAdmin[]
  setSedes: React.Dispatch<React.SetStateAction<SedeAdmin[]>>
}) {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [form, setForm] = useState({
    nombre: '', ciudad: '', direccion: '', hora_apertura: '', hora_cierre: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function resetForm() {
    setForm({ nombre: '', ciudad: '', direccion: '', hora_apertura: '', hora_cierre: '' })
    setError('')
  }

  async function handleGuardar() {
    if (!form.nombre) return
    setGuardando(true); setError('')
    try {
      const payload = {
        nombre: form.nombre,
        ciudad: form.ciudad,
        direccion: form.direccion,
        hora_apertura: form.hora_apertura || null,
        hora_cierre: form.hora_cierre || null,
      }
      if (editId) {
        const updated = await actualizarSede(editId, payload)
        setSedes(prev => prev.map(s => s.id === editId ? updated : s))
        setEditId(null)
      } else {
        const nueva = await crearSede(payload as any)
        setSedes(prev => [...prev, nueva])
        setShowForm(false)
      }
      resetForm()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  async function handleEliminar(id: string) {
    try {
      await eliminarSede(id)
      setSedes(prev => prev.filter(s => s.id !== id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function startEdit(s: SedeAdmin) {
    setEditId(s.id)
    setForm({
      nombre: s.nombre,
      ciudad: s.ciudad,
      direccion: s.direccion,
      hora_apertura: s.horaApertura ?? '',
      hora_cierre: s.horaCierre ?? '',
    })
    setShowForm(false); setError('')
  }

  const formPanel = (
    <div className="bg-muted/30 rounded-lg p-4 border space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {editId ? 'Editar sede' : 'Nueva sede'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Nombre</label>
          <input className={inputCls} value={form.nombre}
            onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Ciudad</label>
          <input className={inputCls} value={form.ciudad}
            onChange={e => setForm(p => ({ ...p, ciudad: e.target.value }))} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground">Dirección</label>
          <input className={inputCls} value={form.direccion}
            onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Hora apertura</label>
          <input type="time" className={inputCls} value={form.hora_apertura}
            onChange={e => setForm(p => ({ ...p, hora_apertura: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Hora cierre</label>
          <input type="time" className={inputCls} value={form.hora_cierre}
            onChange={e => setForm(p => ({ ...p, hora_cierre: e.target.value }))} />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={handleGuardar} disabled={guardando}>
          {guardando ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Check className="size-3.5 mr-1" />}
          Guardar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditId(null); resetForm() }}>
          Cancelar
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {!showForm && !editId && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { setShowForm(true); resetForm() }}>
            <Plus className="size-3.5 mr-1" />Nueva Sede
          </Button>
        </div>
      )}
      {showForm && !editId && formPanel}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nombre</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Ciudad</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Dirección</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Horario apertura</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Estado</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {sedes.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-muted-foreground text-center text-sm">
                    No hay sedes registradas.
                  </td></tr>
                ) : sedes.map(s => (
                  <tr key={s.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2 font-medium">{s.nombre}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s.ciudad}</td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{s.direccion}</td>
                    <td className="px-4 py-2 text-xs">
                      {s.horaApertura && s.horaCierre
                        ? `${s.horaApertura} – ${s.horaCierre}`
                        : <span className="text-muted-foreground italic">Sin definir</span>}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={s.activa ? 'default' : 'secondary'} className="text-xs">
                        {s.activa ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => startEdit(s)}
                          className="text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="size-3.5" />
                        </button>
                        <button onClick={() => handleEliminar(s.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {editId && formPanel}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB ESPECIALIDADES
// ══════════════════════════════════════════════════════════════════════════════

const MODALIDAD_BADGE: Record<string, string> = {
  presencial:   'bg-blue-100 text-blue-700 border-blue-200',
  telemedicina: 'bg-violet-100 text-violet-700 border-violet-200',
  ambas:        'bg-emerald-100 text-emerald-700 border-emerald-200',
}

function TabEspecialidades({
  especialidades, setEspecialidades,
}: {
  especialidades: EspecialidadAdmin[]
  setEspecialidades: React.Dispatch<React.SetStateAction<EspecialidadAdmin[]>>
}) {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [form, setForm] = useState({
    nombre: '', descripcion: '', duracion_min: 30, modalidad: 'presencial',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function resetForm() {
    setForm({ nombre: '', descripcion: '', duracion_min: 30, modalidad: 'presencial' })
    setError('')
  }

  async function handleGuardar() {
    if (!form.nombre) return
    setGuardando(true); setError('')
    try {
      if (editId) {
        const updated = await actualizarEspecialidad(editId, {
          nombre: form.nombre,
          descripcion: form.descripcion,
          duracion_min: form.duracion_min,
          modalidad: form.modalidad,
        })
        setEspecialidades(prev => prev.map(e => e.id === editId ? updated : e))
        setEditId(null)
      } else {
        const nueva = await crearEspecialidad({
          nombre: form.nombre,
          descripcion: form.descripcion,
          duracion_min: form.duracion_min,
          modalidad: form.modalidad,
        })
        setEspecialidades(prev => [...prev, nueva])
        setShowForm(false)
      }
      resetForm()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  async function handleEliminar(id: string) {
    try {
      await eliminarEspecialidad(id)
      setEspecialidades(prev => prev.filter(e => e.id !== id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function startEdit(e: EspecialidadAdmin) {
    setEditId(e.id)
    setForm({ nombre: e.nombre, descripcion: e.descripcion, duracion_min: e.duracionMin, modalidad: e.modalidad })
    setShowForm(false); setError('')
  }

  const formPanel = (
    <div className="bg-muted/30 rounded-lg p-4 border space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {editId ? 'Editar especialidad' : 'Nueva especialidad'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Nombre</label>
          <input className={inputCls} value={form.nombre}
            onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Modalidad</label>
          <select className={selectCls} value={form.modalidad}
            onChange={e => setForm(p => ({ ...p, modalidad: e.target.value }))}>
            <option value="presencial">Presencial</option>
            <option value="telemedicina">Telemedicina</option>
            <option value="ambas">Ambas</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Duración (min)</label>
          <input type="number" min={5} max={240} step={5} className={inputCls}
            value={form.duracion_min}
            onChange={e => setForm(p => ({ ...p, duracion_min: Number(e.target.value) }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Descripción</label>
          <input className={inputCls} value={form.descripcion}
            onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={handleGuardar} disabled={guardando}>
          {guardando ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Check className="size-3.5 mr-1" />}
          Guardar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditId(null); resetForm() }}>
          Cancelar
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {!showForm && !editId && (
        <div className="flex items-center justify-between gap-3">
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 flex-1">
              {error}
            </p>
          )}
          <Button size="sm" onClick={() => { setShowForm(true); resetForm() }} className="ml-auto">
            <Plus className="size-3.5 mr-1" />Nueva Especialidad
          </Button>
        </div>
      )}
      {showForm && !editId && formPanel}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nombre</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Modalidad</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Duración</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Descripción</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Estado</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {especialidades.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-muted-foreground text-center text-sm">
                    No hay especialidades registradas.
                  </td></tr>
                ) : especialidades.map(e => (
                  <tr key={e.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2 font-medium">{e.nombre}</td>
                    <td className="px-4 py-2">
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full border font-medium',
                        MODALIDAD_BADGE[e.modalidad] ?? 'bg-muted'
                      )}>
                        {e.modalidad}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{e.duracionMin} min</td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{e.descripcion}</td>
                    <td className="px-4 py-2">
                      <Badge variant={e.activa ? 'default' : 'secondary'} className="text-xs">
                        {e.activa ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => startEdit(e)}
                          className="text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="size-3.5" />
                        </button>
                        <button onClick={() => handleEliminar(e.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {editId && formPanel}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════════════════════

export function AdminMedicosPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('medicos')
  const [showCalendario, setShowCalendario] = useState(false)

  const [medicos, setMedicos]               = useState<MedicoAdmin[]>([])
  const [sedes, setSedes]                   = useState<SedeAdmin[]>([])
  const [especialidades, setEspecialidades] = useState<EspecialidadAdmin[]>([])
  const [cargando, setCargando]             = useState(true)

  useEffect(() => {
    Promise.all([getMedicos(), getSedes(), getEspecialidades()])
      .then(([m, s, e]) => { setMedicos(m); setSedes(s); setEspecialidades(e) })
      .finally(() => setCargando(false))
  }, [])

  if (cargando) return (
    <div className="min-h-screen bg-muted/30">
      <AdminNavbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </main>
    </div>
  )

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminNavbar />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Gestión Médica</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Médicos, sedes, especialidades y agenda
            </p>
          </div>
          <Button onClick={() => setShowCalendario(true)} variant="outline">
            <CalendarDays className="size-4 mr-2" />Ver Calendario
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <TabBtn active={tab === 'medicos'} onClick={() => setTab('medicos')}
            icon={<Stethoscope className="size-3.5" />}>Médicos</TabBtn>
          <TabBtn active={tab === 'sedes'} onClick={() => setTab('sedes')}
            icon={<MapPin className="size-3.5" />}>Sedes</TabBtn>
          <TabBtn active={tab === 'especialidades'} onClick={() => setTab('especialidades')}
            icon={<ClipboardList className="size-3.5" />}>Especialidades</TabBtn>
        </div>

        {tab === 'medicos' && (
          <TabMedicos
            medicos={medicos}
            setMedicos={setMedicos}
            especialidades={especialidades}
            onDetalle={id => navigate(`/admin/medicos/${id}`)}
          />
        )}
        {tab === 'sedes' && (
          <TabSedes sedes={sedes} setSedes={setSedes} />
        )}
        {tab === 'especialidades' && (
          <TabEspecialidades especialidades={especialidades} setEspecialidades={setEspecialidades} />
        )}
      </main>

      {showCalendario && (
        <CalendarioFullPage
          onClose={() => setShowCalendario(false)}
          onMedicoClick={id => { setShowCalendario(false); navigate(`/admin/medicos/${id}`) }}
        />
      )}
    </div>
  )
}
