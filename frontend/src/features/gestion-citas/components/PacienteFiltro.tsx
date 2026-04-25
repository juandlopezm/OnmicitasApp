/**
 * PacienteFiltro — Selector reutilizable para filtrar citas por paciente.
 *
 * Opciones generadas automáticamente:
 *   - "Todos"    (value = '')    → sin filtro
 *   - "Mis citas" (value = 'yo') → citas del propio afiliado (sin beneficiario)
 *   - Una entrada por cada beneficiario (value = beneficiario.id)
 *
 * Si no hay beneficiarios el componente no se renderiza (retorna null).
 *
 * Uso:
 *   <PacienteFiltro
 *     beneficiarios={beneficiarios}
 *     value={filtro}
 *     onChange={setFiltro}
 *   />
 *
 * Función helper exportada para aplicar el filtro sobre un array de citas:
 *   const citasFiltradas = filtrarCitasPorPaciente(citas, filtro)
 */

import type { Afiliado, Cita } from '../../../types'
import { Select, SelectItem } from '@/components/ui/select'
import { Users } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Tipos ──────────────────────────────────────────────────────────────────

export type FiltroPaciente = '' | 'yo' | string  // '' todos | 'yo' propio | id beneficiario

interface Props {
  beneficiarios: Afiliado[]
  value: FiltroPaciente
  onChange: (v: FiltroPaciente) => void
  className?: string
}

// ── Helper de filtrado (reutilizable fuera del componente) ─────────────────

export function filtrarCitasPorPaciente(citas: Cita[], filtro: FiltroPaciente): Cita[] {
  if (!filtro) return citas
  if (filtro === 'yo') return citas.filter(c => !c.beneficiarioId)
  return citas.filter(c => c.beneficiarioId === filtro)
}

// ── Componente ─────────────────────────────────────────────────────────────

export function PacienteFiltro({ beneficiarios, value, onChange, className }: Props) {
  if (beneficiarios.length === 0) return null

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Users className="size-4 text-muted-foreground shrink-0" />
      <label className="text-sm text-muted-foreground shrink-0">Paciente:</label>
      <Select
        value={value}
        onChange={e => onChange(e.target.value as FiltroPaciente)}
        className="text-sm"
      >
        <SelectItem value="">Todos</SelectItem>
        <SelectItem value="yo">Mis citas</SelectItem>
        {beneficiarios.map(b => (
          <SelectItem key={b.id} value={b.id}>
            {b.nombres} {b.apellidos}
          </SelectItem>
        ))}
      </Select>
    </div>
  )
}
