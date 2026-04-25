import { useState } from 'react';
import type { Cita, NuevaCita } from '../../../types';
import * as citasService from '../services/citasService';

interface EstadoWizard {
  paso: 1 | 2 | 3 | 4;
  // Paciente (puede ser el propio afiliado o un beneficiario)
  beneficiarioId: string;     // '' = para el propio afiliado
  beneficiarioNombre: string; // '' = para el propio afiliado
  // Datos de la cita
  especialidadId: string;
  especialidadNombre: string;
  medicoId: string;
  medicoNombre: string;
  sedeId: string;
  sedeNombre: string;
  fecha: string;
  hora: string;
  horarioId: string;
  citaConfirmada: Cita | null;
  cargando: boolean;
  error: string | null;
}

const estadoInicial: EstadoWizard = {
  paso: 1,
  beneficiarioId: '',
  beneficiarioNombre: '',
  especialidadId: '',
  especialidadNombre: '',
  medicoId: '',
  medicoNombre: '',
  sedeId: '',
  sedeNombre: '',
  fecha: '',
  hora: '',
  horarioId: '',
  citaConfirmada: null,
  cargando: false,
  error: null,
};

export function useCitas(initialBeneficiarioId = '', initialBeneficiarioNombre = '') {
  const [estado, setEstado] = useState<EstadoWizard>({
    ...estadoInicial,
    beneficiarioId:     initialBeneficiarioId,
    beneficiarioNombre: initialBeneficiarioNombre,
  });

  function setBeneficiario(id: string, nombre: string) {
    setEstado(prev => ({
      ...prev,
      beneficiarioId:     id,
      beneficiarioNombre: nombre,
    }));
  }

  function setEspecialidad(especialidadId: string, especialidadNombre: string) {
    setEstado(prev => ({ ...prev, especialidadId, especialidadNombre, medicoId: '', medicoNombre: '', paso: 2 }));
  }

  function setMedico(medicoId: string, medicoNombre: string) {
    setEstado(prev => ({ ...prev, medicoId, medicoNombre, fecha: '', hora: '', sedeId: '', sedeNombre: '', paso: 3 }));
  }

  function setFecha(fecha: string) {
    setEstado(prev => ({ ...prev, fecha, hora: '' }));
  }

  function setHora(hora: string, horarioId: string) {
    setEstado(prev => ({ ...prev, hora, horarioId }));
  }

  function setSede(sedeId: string, sedeNombre: string) {
    setEstado(prev => {
      const puedeAvanzar = !!prev.fecha && !!prev.hora && !!sedeId;
      return { ...prev, sedeId, sedeNombre, paso: puedeAvanzar ? 4 : prev.paso };
    });
  }

  function irAPaso(paso: 1 | 2 | 3 | 4) {
    setEstado(prev => ({ ...prev, paso }));
  }

  async function confirmar(usuarioId: string) {
    const nuevaCita: NuevaCita & { beneficiarioId?: string } = {
      especialidadId:     estado.especialidadId,
      especialidadNombre: estado.especialidadNombre,
      medicoId:           estado.medicoId,
      medicoNombre:       estado.medicoNombre,
      sedeId:             estado.sedeId,
      sedeNombre:         estado.sedeNombre,
      fecha:              estado.fecha,
      hora:               estado.hora,
      horarioId:          estado.horarioId,
      ...(estado.beneficiarioId ? { beneficiarioId: estado.beneficiarioId } : {}),
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

  return { estado, setBeneficiario, setEspecialidad, setMedico, setFecha, setHora, setSede, irAPaso, confirmar, reiniciar };
}
