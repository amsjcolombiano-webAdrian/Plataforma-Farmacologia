import { createHash, randomBytes } from 'node:crypto';

/** El enlace de recuperación deja de servir pasado este tiempo. */
export const MINUTOS_VIGENCIA_TOKEN_RECUPERACION = 30;

/** 32 bytes aleatorios: imposible de adivinar. Va en el enlace que recibe el usuario por correo. */
export function generarTokenRecuperacion(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * En la base de datos solo se guarda este hash. SHA-256 es suficiente (no hace falta bcrypt)
 * porque el token es aleatorio y largo: no se puede adivinar por fuerza bruta como una contraseña.
 */
export function calcularHashTokenRecuperacion(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
