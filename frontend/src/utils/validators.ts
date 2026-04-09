export function validarEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validarCampoRequerido(valor: string): string | null {
  if (!valor.trim()) return 'Este campo es requerido';
  return null;
}
