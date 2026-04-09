import { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectItem } from '@/components/ui/select';
import type { Cita, HorarioDisponible, Sede } from '../../types';
import { getHorariosDisponibles, getSedes, reagendarCita } from '../../services/citasService';
import { obtenerProximos7Dias, formatearFecha, formatearHora } from '../../utils/dateUtils';
import { cn } from '@/lib/utils';

interface ReagendarModalProps {
  cita: Cita | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReagendarModal({ cita, onClose, onSuccess }: ReagendarModalProps) {
  const open = cita !== null;
  const fechasDisponibles = obtenerProximos7Dias();

  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [horarioId, setHorarioId] = useState('');
  const [sedeId, setSedeId] = useState('');
  const [horarios, setHorarios] = useState<HorarioDisponible[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  // Cargar sedes al abrir
  useEffect(() => {
    if (open) {
      getSedes().then(setSedes);
      setFecha('');
      setHora('');
      setSedeId(cita?.sedeId ?? '');
      setHorarios([]);
      setError('');
    }
  }, [open, cita]);

  // Cargar horarios cuando cambia la fecha
  useEffect(() => {
    if (cita && fecha) {
      getHorariosDisponibles(cita.medicoId, fecha).then(setHorarios);
      setHora('');
      setHorarioId('');
    } else {
      setHorarios([]);
    }
  }, [cita, fecha]);

  async function handleConfirmar() {
    if (!cita || !fecha || !hora || !horarioId || !sedeId) {
      setError('Selecciona fecha, hora y sede.');
      return;
    }
    setCargando(true);
    setError('');
    const resultado = await reagendarCita(cita.id, sedeId, horarioId);
    setCargando(false);
    if (resultado.ok) {
      onSuccess();
      onClose();
    } else {
      setError(resultado.error ?? 'Error al reagendar.');
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Reagendar Cita"
      description={cita ? `${cita.especialidadNombre} — ${cita.medicoNombre}` : undefined}
    >
      <div className="space-y-4">
        {/* Fecha */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Nueva fecha</label>
          <Select
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            placeholder="-- Selecciona una fecha --"
          >
            {fechasDisponibles.map(f => (
              <SelectItem key={f} value={f}>{formatearFecha(f)}</SelectItem>
            ))}
          </Select>
        </div>

        {/* Horarios */}
        {fecha && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Horarios disponibles</label>
            {horarios.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay horarios disponibles para esta fecha.</p>
            ) : (
              <div className="horario-grid">
                {horarios.map(h => (
                  <button
                    key={h.id}
                    onClick={() => { setHora(h.hora); setHorarioId(h.id); }}
                    className={cn(
                      'px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all',
                      hora === h.hora
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:border-primary hover:bg-primary/5'
                    )}
                  >
                    {formatearHora(h.hora)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sede */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Sede</label>
          <Select
            value={sedeId}
            onChange={e => setSedeId(e.target.value)}
            placeholder="-- Selecciona una sede --"
          >
            {sedes.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.nombre} — {s.direccion}</SelectItem>
            ))}
          </Select>
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={cargando} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={cargando || !fecha || !hora || !horarioId || !sedeId}
            className="flex-1"
          >
            {cargando ? 'Reagendando...' : 'Confirmar'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
