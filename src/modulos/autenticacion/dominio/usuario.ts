/**
 * Modelo del Bounded Context de Autenticación (ADR-0006):
 * aquí el Estudiante (o cualquier otro rol) es solo una identidad con credenciales.
 * XP, gemas, suscripción, etc. pertenecen a otros módulos.
 */
export const ROLES = ['estudiante', 'administrador', 'creador_contenido'] as const;

export type Rol = (typeof ROLES)[number];

export interface Usuario {
  id: number;
  email: string;
  contrasenaCifrada: string;
  rol: Rol;
  fechaCreacion: Date;
}

export interface DatosNuevoUsuario {
  email: string;
  contrasenaCifrada: string;
  rol: Rol;
}

/** Los correos se comparan siempre en minúsculas y sin espacios, para que no haya cuentas duplicadas por mayúsculas. */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}
