import { useState } from 'react'
import type { Cita } from '../../types'
import { formatearFecha, formatearHora } from '../../utils/dateUtils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CalendarDays, Clock, MapPin, Stethoscope, CalendarClock, XCircle, AlertTriangle } from 'lucide-react'

interface CitaCardProps {
  cita: Cita
  onCancelar?: (cita: Cita) => void
  onReagendar?: (cita: Cita) => void
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'

const BADGE_VARIANT: Record<Cita['estado'], BadgeVariant> = {
  programada:  'default',
  confirmada:  'secondary',
  cancelada:   'destructive',
  completada:  'success',
  no_asistio:  'warning',
  reagendada:  'outline',
}

const ESTADO_TEXTO: Record<Cita['estado'], string> = {
  programada:  'Programada',
  confirmada:  'Confirmada',
  cancelada:   'Cancelada',
  completada:  'Atendida',
  no_asistio:  'No asistió',
  reagendada:  'Reagendada',
}

function puedeModificar(cita: Cita): boolean {
  const ahora = new Date()
  const fechaHoraCita = new Date(`${cita.fecha}T${cita.hora}:00`)
  return fechaHoraCita.getTime() - ahora.getTime() > 24 * 60 * 60 * 1000
}

export function CitaCard({ cita, onCancelar, onReagendar }: CitaCardProps) {
  const [confirmando, setConfirmando] = useState(false)

  const modificable  = puedeModificar(cita)
  const esProgramada = cita.estado === 'programada' || cita.estado === 'confirmada' || cita.estado === 'reagendada'
  const mostrarAcciones = (onCancelar || onReagendar) && esProgramada && modificable

  function handleCancelarClick() {
    setConfirmando(true)
  }

  function handleConfirmar() {
    setConfirmando(false)
    onCancelar?.(cita)
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-base leading-tight">{cita.especialidadNombre}</p>
          <Badge variant={BADGE_VARIANT[cita.estado]}>
            {ESTADO_TEXTO[cita.estado]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Stethoscope className="size-3.5 shrink-0" />
          <span>{cita.medicoNombre}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span>{cita.sedeNombre}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-3.5 shrink-0" />
          <span>{formatearFecha(cita.fecha)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-3.5 shrink-0" />
          <span>{formatearHora(cita.hora)}</span>
        </div>

        {/* Diálogo inline de confirmación para cancelar */}
        {confirmando && (
          <div className="mt-2 pt-2 border-t rounded-lg bg-destructive/5 border-destructive/20 p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-destructive font-medium">
              <AlertTriangle className="size-4 shrink-0" />
              ¿Cancelar esta cita?
            </div>
            <p className="text-xs text-muted-foreground">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setConfirmando(false)}
              >
                No, mantener
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1 text-xs"
                onClick={handleConfirmar}
              >
                Sí, cancelar
              </Button>
            </div>
          </div>
        )}

        {!confirmando && mostrarAcciones && (
          <div className="flex gap-2 mt-2 pt-2 border-t">
            {onReagendar && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => onReagendar(cita)}
              >
                <CalendarClock className="size-3.5 mr-1" />
                Reagendar
              </Button>
            )}
            {onCancelar && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs text-destructive border-destructive/40 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
                onClick={handleCancelarClick}
              >
                <XCircle className="size-3.5 mr-1" />
                Cancelar
              </Button>
            )}
          </div>
        )}

        {esProgramada && !modificable && !confirmando && (
          <p className="text-xs text-muted-foreground mt-1 italic">
            Esta cita ya no puede cancelarse ni reagendarse (menos de 24 h).
          </p>
        )}
      </CardContent>
    </Card>
  )
}
