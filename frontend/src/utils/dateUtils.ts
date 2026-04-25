const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function formatearFecha(fecha: string): string {
  // fecha: 'YYYY-MM-DD' → 'Martes, 08 de Abril 2026'
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const date = new Date(anio, mes - 1, dia);
  const nombreDia = DIAS[date.getDay()];
  const nombreMes = MESES[mes - 1];
  return `${nombreDia}, ${String(dia).padStart(2, '0')} de ${nombreMes} ${anio}`;
}

export function formatearHora(hora: string): string {
  // hora: 'HH:mm' → '08:00 AM' / '02:00 PM'
  const [h, m] = hora.split(':').map(Number);
  const periodo = h < 12 ? 'AM' : 'PM';
  const hora12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${String(hora12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${periodo}`;
}

export function obtenerFechaEnDias(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function obtenerProximos7Dias(): string[] {
  // Retorna array de fechas YYYY-MM-DD desde mañana
  const dias: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + i);
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    dias.push(`${anio}-${mes}-${dia}`);
  }
  return dias;
}
