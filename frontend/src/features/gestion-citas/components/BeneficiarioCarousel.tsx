import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMiPerfil } from '../../gestion-afiliados/services/afiliadosService'
import type { Afiliado } from '../../../types'
import type { AfiliadoAuth } from '../../auth/services/authService'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CalendarPlus, User, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  usuario: AfiliadoAuth
}

function initials(nombres: string, apellidos: string) {
  const a = nombres.trim().charAt(0).toUpperCase()
  const b = apellidos.trim().charAt(0).toUpperCase()
  return a + b
}

function avatarColor(id: string) {
  const palette = [
    'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700',
    'bg-violet-100 text-violet-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-cyan-100 text-cyan-700',
  ]
  return palette[Number(id) % palette.length]
}

export function BeneficiarioCarousel(_: Props) {
  const navigate = useNavigate()

  const [miPerfil, setMiPerfil] = useState<Afiliado | null>(null)
  const [beneficiarios, setBeneficiarios] = useState<Afiliado[]>([])
  const [cargando, setCargando] = useState(true)

  // ID de la tarjeta con el menú de acciones abierto
  const [menuId, setMenuId] = useState<string | null>(null)
  // Perfil expandido (vista detalle)
  const [perfilId, setPerfilId] = useState<string | null>(null)

  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getMiPerfil()
      .then(perfil => {
        setMiPerfil(perfil)
        setBeneficiarios(perfil.beneficiarios ?? [])
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    if (!menuId) return
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuId])

  if (cargando) return null

  // Si no hay beneficiarios, no mostrar la sección
  if (!miPerfil || beneficiarios.length === 0) return null

  const todos: Afiliado[] = [miPerfil, ...beneficiarios]
  const perfilSeleccionado = todos.find(a => a.id === perfilId) ?? null

  function handleCardClick(id: string) {
    if (menuId === id) {
      setMenuId(null)
    } else {
      setMenuId(id)
      setPerfilId(null)
    }
  }

  function handleVerPerfil(af: Afiliado) {
    setMenuId(null)
    setPerfilId(af.id)
  }

  function handleApartarCita(af: Afiliado) {
    setMenuId(null)
    navigate('/citas/nueva', {
      state: {
        beneficiarioId: af.id === miPerfil?.id ? null : af.id,
        beneficiarioNombre: af.id === miPerfil?.id
          ? null
          : `${af.nombres} ${af.apellidos}`,
      },
    })
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Grupo Familiar</h2>
        <span className="text-xs text-muted-foreground">
          {todos.length} {todos.length === 1 ? 'persona' : 'personas'}
        </span>
      </div>

      {/* Carousel + panel de detalle */}
      <div ref={menuRef}>
        {/* Scroll horizontal */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {todos.map(af => {
            const esTitular = af.id === miPerfil?.id
            const menuAbierto = menuId === af.id

            return (
              <button
                key={af.id}
                onClick={() => handleCardClick(af.id)}
                className={cn(
                  'relative flex-shrink-0 w-36 rounded-xl border-2 p-3 text-left',
                  'transition-all cursor-pointer focus:outline-none',
                  menuAbierto
                    ? 'border-primary shadow-md bg-primary/5'
                    : 'border-border bg-background hover:border-primary/50 hover:shadow-sm'
                )}
              >
                {/* Avatar */}
                <div className={cn(
                  'size-10 rounded-full flex items-center justify-center text-sm font-bold mb-2',
                  avatarColor(af.id)
                )}>
                  {initials(af.nombres, af.apellidos)}
                </div>

                {/* Nombre */}
                <p className="font-medium text-xs leading-tight truncate">
                  {af.nombres}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {af.apellidos}
                </p>

                {/* Tipo + estado */}
                <div className="flex flex-col gap-1 mt-2">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {esTitular ? 'Titular' : 'Beneficiario'}
                  </span>
                  <Badge
                    variant={af.estado === 'activo' ? 'success' : 'destructive'}
                    className="text-[10px] px-1.5 py-0 w-fit"
                  >
                    {af.estado}
                  </Badge>
                </div>

                {/* Indicador de flecha */}
                <ChevronRight className={cn(
                  'absolute right-2 top-3 size-3.5 text-muted-foreground/40 transition-transform',
                  menuAbierto && 'rotate-90 text-primary'
                )} />
              </button>
            )
          })}
        </div>

        {/* Panel de acciones (aparece bajo el carousel cuando hay menú abierto) */}
        {menuId && !perfilId && (() => {
          const af = todos.find(a => a.id === menuId)
          if (!af) return null
          const esTitular = af.id === miPerfil?.id

          return (
            <div className="mt-2 rounded-xl border bg-background shadow-sm p-4 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    'size-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
                    avatarColor(af.id)
                  )}>
                    {initials(af.nombres, af.apellidos)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm leading-tight">
                      {af.nombres} {af.apellidos}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {esTitular ? 'Titular' : 'Beneficiario'} · {af.estado}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setMenuId(null)}
                  className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => handleVerPerfil(af)}
                >
                  <User className="size-3.5 mr-1.5" />
                  Ver perfil
                </Button>
                <Button
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => handleApartarCita(af)}
                >
                  <CalendarPlus className="size-3.5 mr-1.5" />
                  Apartar cita
                </Button>
              </div>
            </div>
          )
        })()}

        {/* Panel de perfil detallado */}
        {perfilSeleccionado && (
          <div className="mt-2 rounded-xl border bg-background shadow-sm p-4 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'size-12 rounded-full flex items-center justify-center text-base font-bold shrink-0',
                  avatarColor(perfilSeleccionado.id)
                )}>
                  {initials(perfilSeleccionado.nombres, perfilSeleccionado.apellidos)}
                </div>
                <div>
                  <p className="font-semibold text-sm leading-tight">
                    {perfilSeleccionado.nombres} {perfilSeleccionado.apellidos}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {perfilSeleccionado.id === miPerfil?.id ? 'Titular' : 'Beneficiario'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPerfilId(null)}
                className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="rounded-lg border divide-y text-sm mb-4">
              {[
                { label: 'Documento',   value: `${perfilSeleccionado.tipoDocumento} ${perfilSeleccionado.numeroDocumento}` },
                { label: 'Género',      value: perfilSeleccionado.genero === 'M' ? 'Masculino' : perfilSeleccionado.genero === 'F' ? 'Femenino' : 'Otro' },
                { label: 'Fecha nac.',  value: perfilSeleccionado.fechaNacimiento || '—' },
                { label: 'Teléfono',    value: perfilSeleccionado.telefono || '—' },
                { label: 'Ciudad',      value: perfilSeleccionado.ciudad ? `${perfilSeleccionado.ciudad}, ${perfilSeleccionado.departamento}` : '—' },
                { label: 'IPS',         value: perfilSeleccionado.ipsMedica || '—' },
                { label: 'Estado',      value: perfilSeleccionado.estado },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center px-3 py-2">
                  <span className="text-muted-foreground text-xs">{label}</span>
                  <span className="font-medium text-xs text-right max-w-[55%] truncate">{value}</span>
                </div>
              ))}
            </div>

            {perfilSeleccionado.id !== miPerfil?.id && (
              <Button
                size="sm"
                className="w-full text-xs"
                onClick={() => handleApartarCita(perfilSeleccionado)}
              >
                <CalendarPlus className="size-3.5 mr-1.5" />
                Apartar cita para {perfilSeleccionado.nombres}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
