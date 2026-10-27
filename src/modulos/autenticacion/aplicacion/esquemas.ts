import { z } from 'zod';
import { ROLES, normalizarEmail } from '../dominio/usuario';

/** bcrypt solo toma en cuenta los primeros 72 bytes; más allá se ignorarían en silencio. */
const LONGITUD_MAXIMA_CONTRASENA_BYTES = 72;
const LONGITUD_MINIMA_CONTRASENA = 8;

const esquemaEmail = z
  .string({ error: 'El correo es obligatorio.' })
  .trim()
  .max(255, 'El correo es demasiado largo.')
  .pipe(z.email('El correo no tiene un formato válido.'))
  .transform(normalizarEmail);

/** Reglas de una contraseña nueva: se usan al registrarse y al restablecerla. */
const esquemaContrasenaNueva = z
  .string({ error: 'La contraseña es obligatoria.' })
  .min(LONGITUD_MINIMA_CONTRASENA, `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`)
  .refine(
    (contrasena) => Buffer.byteLength(contrasena, 'utf8') <= LONGITUD_MAXIMA_CONTRASENA_BYTES,
    'La contraseña es demasiado larga.',
  );

/** DTO de entrada para registrar un Estudiante (ADR-0009). */
export const esquemaRegistroEstudiante = z.object({
  email: esquemaEmail,
  contrasena: esquemaContrasenaNueva,
});

/** DTO de entrada para iniciar sesión. Aquí no se valida la fortaleza: solo que vengan los datos. */
export const esquemaInicioSesion = z.object({
  email: esquemaEmail,
  contrasena: z.string({ error: 'La contraseña es obligatoria.' }).min(1, 'La contraseña es obligatoria.'),
});

export const esquemaSolicitudRecuperacion = z.object({
  email: esquemaEmail,
});

export const esquemaRestablecimientoContrasena = z.object({
  token: z.string({ error: 'El token es obligatorio.' }).trim().min(1, 'El token es obligatorio.').max(200, 'El token no es válido.'),
  contrasenaNueva: esquemaContrasenaNueva,
});

export const esquemaAsignacionRol = z.object({
  usuarioId: z.coerce
    .number({ error: 'El identificador del usuario no es válido.' })
    .int('El identificador del usuario no es válido.')
    .positive('El identificador del usuario no es válido.'),
  rol: z.enum(ROLES, { error: `El rol debe ser uno de: ${ROLES.join(', ')}.` }),
});

export type DatosRegistroEstudiante = z.infer<typeof esquemaRegistroEstudiante>;
export type DatosInicioSesion = z.infer<typeof esquemaInicioSesion>;
