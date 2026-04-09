import { useState } from 'react';
import type { Cita, NuevaCita } from '../types';
import * as citasService from '../services/citasService';

interface EstadoWizard {
  paso: 1 | 2 | 3 | 4;
  especialidadId: string;
  medicoId: string;
  sedeId: string;
  fecha: string;
  hora: string;
  horarioId: string;
  citaConfirmada: Cita | null;
  cargando: boolean;
  error: string | null;
}

const estadoInicial: EstadoWizard = {
  paso: 1,
  especialidadId: '',
  medicoId: '',
  sedeId: '',
  fecha: '',
  hora: '',
  horarioId: '',
  citaConfirmada: null,
  cargando: false,
  error: null,
};

export function useCitas() {
  const [estado, setEstado] = useState<EstadoWizard>(estadoInicial);

  function setEspecialidad(especialidadId: string) {
    setEstado(prev => ({ ...prev, especialidadId, medicoId: '', paso: 2 }));
  }

  function setMedico(medicoId: string) {
    setEstado(prev => ({ ...prev, medicoId, fecha: '', hora: '', sedeId: '', paso: 3 }));
  }

  function setFecha(fecha: string) {
    setEstado(prev => ({ ...prev, fecha, hora: '' }));
  }

  function setHora(hora: string, horarioId: string) {
    setEstado(prev => ({ ...prev, hora, horarioId }));
  }

  function setSede(sedeId: string) {
    // Avanzar al paso 4 solo cuando hay fecha, hora y sede seleccionados
    setEstado(prev => {
      const puedeAvanzar = !!prev.fecha && !!prev.hora && !!sedeId;
      return { ...prev, sedeId, paso: puedeAvanzar ? 4 : prev.paso };
    });
  }

  function irAPaso(paso: 1 | 2 | 3 | 4) {
    setEstado(prev => ({ ...prev, paso }));
  }

  async function confirmar(usuarioId: string) {
    const nuevaCita: NuevaCita = {
      especialidadId: estado.especialidadId,
      medicoId: estado.medicoId,
      sedeId: estado.sedeId,
      fecha: estado.fecha,
      hora: estado.hora,
      horarioId: estado.horarioId,
    };

    setEstado(prev => ({ ...prev, cargando: true, error: null }));
    try {
      const cita = await citasService.crearCita(usuarioId, nuevaCita);
      setEstado(prev => ({ ...prev, citaConfirmada: cita, cargando: false }));
      return cita;
    } catch (e) {
      setEstado(prev => ({
        ...prev,
        cargando: false,
        error: (e as Error).message || 'Error al crear la cita. Intenta de nuevo.',
      }));
      return null;
    }
  }

  function reiniciar() {
    setEstado(estadoInicial);
  }

  return { estado, setEspecialidad, setMedico, setFecha, setHora, setSede, irAPaso, confirmar, reiniciar };
}
