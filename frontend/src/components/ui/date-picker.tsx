import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const DIAS_CORTO = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa']
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function toYMD(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

interface DatePickerProps {
  value: string              // YYYY-MM-DD o ''
  onChange: (value: string) => void
  minDate: string            // YYYY-MM-DD — primer día seleccionable
  maxDate: string            // YYYY-MM-DD — último día seleccionable
}

export function DatePicker({ value, onChange, minDate, maxDate }: DatePickerProps) {
  // Inicializar la vista en el mes del valor seleccionado, o en el mes de minDate
  const seed = value || minDate
  const [seedY, seedM] = seed.split('-').map(Number)

  const [viewYear, setViewYear]   = useState(seedY)
  const [viewMonth, setViewMonth] = useState(seedM - 1) // 0-based

  const todayStr = toYMD(new Date())

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // ¿Se puede navegar hacia atrás / adelante?
  const [minY, minMNum] = minDate.split('-').map(Number)
  const [maxY, maxMNum] = maxDate.split('-').map(Number)
  const canPrev = viewYear > minY || (viewYear === minY && viewMonth > minMNum - 1)
  const canNext = viewYear < maxY || (viewYear === maxY && viewMonth < maxMNum - 1)

  // Construir la cuadrícula del mes actual
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay() // 0=Dom
  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function handleDay(day: number) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (dateStr >= minDate && dateStr <= maxDate) onChange(dateStr)
  }

  return (
    <div className="rounded-lg border bg-background shadow-sm p-3 w-full select-none">
      {/* Cabecera: mes anterior / título / mes siguiente */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          disabled={!canPrev}
          className="size-7 flex items-center justify-center rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>

        <span className="text-sm font-semibold">
          {MESES[viewMonth]} {viewYear}
        </span>

        <button
          type="button"
          onClick={nextMonth}
          disabled={!canNext}
          className="size-7 flex items-center justify-center rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Nombres de los días */}
      <div className="grid grid-cols-7 mb-1">
        {DIAS_CORTO.map(d => (
          <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Celdas de días */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (day === null) return <div key={idx} />

          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isSelected = dateStr === value
          const isToday    = dateStr === todayStr
          const isDisabled = dateStr < minDate || dateStr > maxDate

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleDay(day)}
              disabled={isDisabled}
              className={cn(
                'h-8 w-full rounded-md text-sm transition-colors',
                isSelected && 'bg-primary text-primary-foreground font-semibold',
                !isSelected && isToday && 'border border-primary text-primary font-medium',
                !isSelected && !isDisabled && 'hover:bg-muted cursor-pointer',
                isDisabled && 'text-muted-foreground/35 cursor-not-allowed',
              )}
            >
              {day}
            </button>
          )
        })}
      </div>

      {/* Fecha seleccionada */}
      {value && (
        <p className="mt-3 text-center text-xs text-muted-foreground border-t pt-2">
          Seleccionado:{' '}
          <span className="font-medium text-foreground">
            {new Date(value + 'T00:00:00').toLocaleDateString('es-CO', {
              weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
            })}
          </span>
        </p>
      )}
    </div>
  )
}
