import { useLocation, useNavigate } from 'react-router-dom'
import { Navbar } from '../components/layout/Navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatearFecha, formatearHora } from '../utils/dateUtils'
import type { Cita } from '../types'
import { CheckCircle2, CalendarPlus, ClipboardList } from 'lucide-react'

interface LocationState {
  cita: Cita
}

export function ConfirmacionPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state    = location.state as LocationState | null
  const cita     = state?.cita

  if (!cita) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-8 text-center">
          <p className="text-muted-foreground">No hay información de cita disponible.</p>
          <Button className="mt-4" onClick={() => navigate('/citas')}>Ver mis citas</Button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <main className="max-w-md mx-auto px-4 py-10">
        <Card>
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-3">
              <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <CheckCircle2 className="size-7" />
              </div>
            </div>
            <h1 className="text-xl font-bold">¡Cita agendada con éxito!</h1>
            <p className="text-sm text-muted-foreground">Tu cita ha sido registrada correctamente</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Resumen */}
            <div className="rounded-lg border divide-y">
              {[
                { label: 'Especialidad', value: cita.especialidadNombre },
                { label: 'Médico',       value: cita.medicoNombre },
                { label: 'Fecha',        value: formatearFecha(cita.fecha) },
                { label: 'Hora',         value: formatearHora(cita.hora) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center px-4 py-3">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-semibold">{value}</span>
                </div>
              ))}
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-sm text-muted-foreground">Estado</span>
                <Badge>Confirmada</Badge>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={() => navigate('/citas')} variant="outline" className="w-full">
                <ClipboardList className="size-4 mr-2" />
                Ver mis citas
              </Button>
              <Button onClick={() => navigate('/citas/nueva')} className="w-full">
                <CalendarPlus className="size-4 mr-2" />
                Agendar otra cita
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
