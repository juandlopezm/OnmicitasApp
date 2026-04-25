import { useEffect, useState } from 'react'
import { useAuth } from '../auth/hooks/useAuth'
import { Navbar } from '../../layout/Navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getMiPerfil, actualizarMiPerfil } from './services/afiliadosService'
import type { Afiliado } from '../../types'
import {
  User, Shield, Pencil, X, Check, Loader2,
  Phone, MapPin, Building2, CreditCard, Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Helpers ────────────────────────────────────────────────────────────────

function initials(nombres: string, apellidos: string) {
  return (nombres.charAt(0) + apellidos.charAt(0)).toUpperCase()
}

function labelGenero(g: string) {
  return g === 'M' ? 'Masculino' : g === 'F' ? 'Femenino' : 'Otro'
}

function labelTipo(t: string) {
  return t === 'cotizante' ? 'Cotizante' : 'Beneficiario'
}

function labelEstado(e: string): { text: string; variant: 'success' | 'destructive' | 'warning' } {
  if (e === 'activo')     return { text: 'Activo',     variant: 'success' }
  if (e === 'inactivo')   return { text: 'Inactivo',   variant: 'destructive' }
  return                         { text: 'Suspendido', variant: 'warning' }
}

function formatFecha(iso: string | undefined | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ── Tipos internos ─────────────────────────────────────────────────────────

type PersonalForm = Pick<Afiliado,
  'nombres' | 'apellidos' | 'genero' | 'fechaNacimiento' | 'telefono' | 'departamento' | 'ciudad' | 'ipsMedica'
>

// ── Componente de fila informativa ─────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 px-4 border-b last:border-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0 min-w-[130px]">
        {Icon && <Icon className="size-3.5 shrink-0" />}
        {label}
      </div>
      <div className="text-sm font-medium text-right">{value ?? '—'}</div>
    </div>
  )
}

// ── Campo de formulario ────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50'

// ── Page ───────────────────────────────────────────────────────────────────

export function PerfilPage() {
  const { usuario } = useAuth()

  const [perfil, setPerfil]       = useState<Afiliado | null>(null)
  const [cargando, setCargando]   = useState(true)
  const [editando, setEditando]   = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito]         = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // Formulario de edición
  const [form, setForm] = useState<PersonalForm>({
    nombres: '', apellidos: '', genero: 'M',
    fechaNacimiento: '', telefono: '', departamento: '', ciudad: '', ipsMedica: '',
  })

  useEffect(() => {
    getMiPerfil()
      .then(p => {
        setPerfil(p)
        setForm({
          nombres:         p.nombres,
          apellidos:       p.apellidos,
          genero:          p.genero,
          fechaNacimiento: p.fechaNacimiento ?? '',
          telefono:        p.telefono ?? '',
          departamento:    p.departamento ?? '',
          ciudad:          p.ciudad ?? '',
          ipsMedica:       p.ipsMedica ?? '',
        })
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  function handleCancelar() {
    if (!perfil) return
    setForm({
      nombres:         perfil.nombres,
      apellidos:       perfil.apellidos,
      genero:          perfil.genero,
      fechaNacimiento: perfil.fechaNacimiento ?? '',
      telefono:        perfil.telefono ?? '',
      departamento:    perfil.departamento ?? '',
      ciudad:          perfil.ciudad ?? '',
      ipsMedica:       perfil.ipsMedica ?? '',
    })
    setEditando(false)
    setError(null)
  }

  async function handleGuardar() {
    setGuardando(true)
    setError(null)
    const resultado = await actualizarMiPerfil(form)
    setGuardando(false)
    if (resultado.ok && resultado.afiliado) {
      setPerfil(prev => ({ ...prev!, ...resultado.afiliado! }))
      setEditando(false)
      setExito(true)
      setTimeout(() => setExito(false), 3000)
    } else {
      setError(resultado.error ?? 'No se pudo guardar. Intenta de nuevo.')
    }
  }

  function set(field: keyof PersonalForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <p className="text-muted-foreground text-sm">Cargando perfil...</p>
        </main>
      </div>
    )
  }

  if (!perfil) return null

  const estadoInfo = labelEstado(perfil.estado)

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* ── Header con avatar ── */}
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-full bg-primary/15 text-primary font-bold text-xl flex items-center justify-center shrink-0">
            {initials(perfil.nombres, perfil.apellidos)}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{perfil.nombres} {perfil.apellidos}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={estadoInfo.variant} className="text-xs">{estadoInfo.text}</Badge>
              <span className="text-sm text-muted-foreground">{labelTipo(perfil.tipo)}</span>
            </div>
          </div>
        </div>

        {/* Banner de éxito */}
        {exito && (
          <div className="flex items-center gap-2 rounded-lg bg-success/10 border border-success/30 px-4 py-2.5 text-sm text-success-foreground">
            <Check className="size-4 shrink-0" />
            Perfil actualizado correctamente.
          </div>
        )}

        {/* ══════════════════════════════════════════
            SECCIÓN 1 — Información Personal
        ══════════════════════════════════════════ */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="size-4" />
                Información Personal
              </CardTitle>
              {!editando ? (
                <Button variant="ghost" size="sm" onClick={() => setEditando(true)}>
                  <Pencil className="size-3.5 mr-1.5" />
                  Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCancelar} disabled={guardando}>
                    <X className="size-3.5 mr-1" />
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleGuardar} disabled={guardando}>
                    {guardando
                      ? <Loader2 className="size-3.5 mr-1 animate-spin" />
                      : <Check className="size-3.5 mr-1" />
                    }
                    Guardar
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {/* Error de guardado */}
            {error && (
              <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}

            {!editando ? (
              /* Vista */
              <div className="rounded-lg border divide-y">
                <InfoRow icon={CreditCard} label="Documento"
                  value={`${perfil.tipoDocumento} ${perfil.numeroDocumento}`} />
                <InfoRow icon={User}       label="Nombres"        value={perfil.nombres} />
                <InfoRow icon={User}       label="Apellidos"      value={perfil.apellidos} />
                <InfoRow                   label="Género"         value={labelGenero(perfil.genero)} />
                <InfoRow icon={Calendar}   label="Fecha nac."     value={formatFecha(perfil.fechaNacimiento)} />
                <InfoRow icon={Phone}      label="Teléfono"       value={perfil.telefono || '—'} />
                <InfoRow icon={MapPin}     label="Ciudad"
                  value={perfil.ciudad
                    ? `${perfil.ciudad}${perfil.departamento ? `, ${perfil.departamento}` : ''}`
                    : '—'} />
                <InfoRow icon={Building2}  label="IPS médica"     value={perfil.ipsMedica || '—'} />
              </div>
            ) : (
              /* Formulario de edición */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Documento (read-only dentro del form) */}
                <Field label="Tipo de documento">
                  <input
                    className={cn(inputCls, 'opacity-60 cursor-not-allowed')}
                    value={perfil.tipoDocumento}
                    disabled
                  />
                </Field>
                <Field label="Número de documento">
                  <input
                    className={cn(inputCls, 'opacity-60 cursor-not-allowed')}
                    value={perfil.numeroDocumento}
                    disabled
                  />
                </Field>

                <Field label="Nombres">
                  <input
                    className={inputCls}
                    value={form.nombres}
                    onChange={e => set('nombres', e.target.value)}
                    placeholder="Nombres"
                  />
                </Field>
                <Field label="Apellidos">
                  <input
                    className={inputCls}
                    value={form.apellidos}
                    onChange={e => set('apellidos', e.target.value)}
                    placeholder="Apellidos"
                  />
                </Field>

                <Field label="Género">
                  <select
                    className={inputCls}
                    value={form.genero}
                    onChange={e => set('genero', e.target.value)}
                  >
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="O">Otro</option>
                  </select>
                </Field>
                <Field label="Fecha de nacimiento">
                  <input
                    type="date"
                    className={inputCls}
                    value={form.fechaNacimiento}
                    onChange={e => set('fechaNacimiento', e.target.value)}
                  />
                </Field>

                <Field label="Teléfono">
                  <input
                    className={inputCls}
                    value={form.telefono}
                    onChange={e => set('telefono', e.target.value)}
                    placeholder="Ej: 3001234567"
                  />
                </Field>
                <Field label="IPS médica">
                  <input
                    className={inputCls}
                    value={form.ipsMedica}
                    onChange={e => set('ipsMedica', e.target.value)}
                    placeholder="Nombre de tu IPS"
                  />
                </Field>

                <Field label="Departamento">
                  <input
                    className={inputCls}
                    value={form.departamento}
                    onChange={e => set('departamento', e.target.value)}
                    placeholder="Departamento"
                  />
                </Field>
                <Field label="Ciudad">
                  <input
                    className={inputCls}
                    value={form.ciudad}
                    onChange={e => set('ciudad', e.target.value)}
                    placeholder="Ciudad"
                  />
                </Field>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════
            SECCIÓN 2 — Información de la Cuenta
        ══════════════════════════════════════════ */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="size-4" />
              Información de la Cuenta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border divide-y">
              <InfoRow label="Tipo de afiliado"
                value={
                  <Badge variant={perfil.tipo === 'cotizante' ? 'default' : 'secondary'} className="text-xs">
                    {labelTipo(perfil.tipo)}
                  </Badge>
                }
              />
              <InfoRow label="Estado de la cuenta"
                value={
                  <Badge variant={estadoInfo.variant} className="text-xs">
                    {estadoInfo.text}
                  </Badge>
                }
              />
              {usuario && (
                <InfoRow label="Usuario" value={`${usuario.nombres} ${usuario.apellidos}`} />
              )}
              <InfoRow label="Cuenta registrada" value="—" />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Para cambiar tu contraseña o correo electrónico, contacta al soporte.
            </p>
          </CardContent>
        </Card>

      </main>
    </div>
  )
}
