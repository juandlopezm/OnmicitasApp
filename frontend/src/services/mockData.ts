import type { Afiliado, AdminUsuario, HorarioDisponible, Especialidad, Medico, Sede, Usuario } from '../types';

export const USUARIOS: Usuario[] = [
  { id: 'u1', nombre: 'Carlos Pérez', email: 'demo@omnicitas.com', password: 'demo123', rol: 'paciente' },
  { id: 'u2', nombre: 'Ana Gómez', email: 'ana@omnicitas.com', password: 'ana123', rol: 'paciente' },
];

export const ADMIN_USUARIO: AdminUsuario = {
  id: 'admin1',
  nombre: 'Administrador OmniCitas',
  email: 'admin@omnicitas.com',
  password: 'admin123',
};

export const ESPECIALIDADES: Especialidad[] = [
  { id: 'e1', nombre: 'Medicina General', descripcion: 'Atención primaria y consulta general' },
  { id: 'e2', nombre: 'Cardiología', descripcion: 'Enfermedades del corazón y sistema circulatorio' },
  { id: 'e3', nombre: 'Pediatría', descripcion: 'Atención médica a niños y adolescentes' },
  { id: 'e4', nombre: 'Dermatología', descripcion: 'Enfermedades de la piel, cabello y uñas' },
];

export const MEDICOS: Medico[] = [
  { id: 'm1', nombre: 'Dr. Juan Martínez', especialidadId: 'e1' },
  { id: 'm2', nombre: 'Dra. Laura Sánchez', especialidadId: 'e1' },
  { id: 'm3', nombre: 'Dr. Roberto Díaz', especialidadId: 'e2' },
  { id: 'm4', nombre: 'Dra. María Torres', especialidadId: 'e2' },
  { id: 'm5', nombre: 'Dr. Felipe Ruiz', especialidadId: 'e3' },
  { id: 'm6', nombre: 'Dra. Claudia Mora', especialidadId: 'e4' },
];

export const SEDES: Sede[] = [
  { id: 's1', nombre: 'Sede Centro', direccion: 'Cra 7 # 32-16, Bogotá' },
  { id: 's2', nombre: 'Sede Norte', direccion: 'Av. 19 # 127-50, Bogotá' },
  { id: 's3', nombre: 'Sede Sur', direccion: 'Calle 40 Sur # 22-18, Bogotá' },
  { id: 's4', nombre: 'Sede Occidente', direccion: 'Cra 86 # 90-12, Bogotá' },
];

// Mutable para afiliados creados durante la sesión
export let AFILIADOS: Afiliado[] = [];

// Genera horarios para los próximos 7 días, de 8:00 a 17:00 cada hora
function generarHorarios(): HorarioDisponible[] {
  const horarios: HorarioDisponible[] = [];
  const horas = ['08:00', '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];
  let idCounter = 1;

  for (let diaOffset = 1; diaOffset <= 7; diaOffset++) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + diaOffset);
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    const fechaStr = `${anio}-${mes}-${dia}`;

    for (const medico of MEDICOS) {
      for (const hora of horas) {
        // ~30% de horarios ocupados para simular realismo
        const estado: 'disponible' | 'ocupado' =
          (idCounter % 3 === 0) ? 'ocupado' : 'disponible';
        horarios.push({
          id: `h${idCounter}`,
          medicoId: medico.id,
          fecha: fechaStr,
          hora,
          estado,
        });
        idCounter++;
      }
    }
  }

  return horarios;
}

// Mutable para que crearCita/reagendarCita pueda marcar horarios como ocupados/disponibles
export let HORARIOS: HorarioDisponible[] = generarHorarios();
