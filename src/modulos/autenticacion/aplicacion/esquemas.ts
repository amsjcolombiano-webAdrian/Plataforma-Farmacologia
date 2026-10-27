import { z } from 'zod';
import { normalizarEmail } from '../dominio/usuario';

/** bcrypt solo toma en cuenta los primeros 72 bytes; más allá se ignorarían en silencio. */
const LONGITUD_MAXIMA_CONTRASENA_BYTES = 72;
const LONGITUD_MINIMA_CONTRASENA = 8;

const esquemaEmail = z
  .string({ error: 'El correo es obligatorio.' })
  .trim()
  .max(255, 'El correo es demasiado largo.')
  .pipe(z.email('El correo no tiene un formato válido.'))
  .transform(normalizarEmail);

/** DTO de entrada para registrar un Estudiante (ADR-0009). */
export const esquemaRegistroEstudiante = z.object({
  email: esquemaEmail,
  contrasena: z
    .string({ error: 'La contraseña es obligatoria.' })
    .min(LONGITUD_MINIMA_CONTRASENA, `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`)
    .refine(
      (contrasena) => Buffer.byteLength(contrasena, 'utf8') <= LONGITUD_MAXIMA_CONTRASENA_BYTES,
      'La contraseña es demasiado larga.',
    ),
});

/** DTO de entrada para iniciar sesión. Aquí no se valida la fortaleza: solo que vengan los datos. */
export const esquemaInicioSesion = z.object({
  email: esquemaEmail,
  contrasena: z.string({ error: 'La contraseña es obligatoria.' }).min(1, 'La contraseña es obligatoria.'),
});

export type DatosRegistroEstudiante = z.infer<typeof esquemaRegistroEstudiante>;
export type DatosInicioSesion = z.infer<typeof esquemaInicioSesion>;
