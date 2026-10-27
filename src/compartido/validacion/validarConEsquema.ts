import type { z } from 'zod';
import { ErrorValidacion } from '../errores/erroresAplicacion';

/**
 * Valida datos de entrada con un esquema Zod (ADR-0009).
 * Si no son válidos, lanza ErrorValidacion con un detalle por campo,
 * que el manejador de errores convierte en una respuesta 400.
 */
export function validarConEsquema<Esquema extends z.ZodType>(esquema: Esquema, datos: unknown): z.output<Esquema> {
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) {
    throw new ErrorValidacion(
      resultado.error.issues.map((problema) => ({
        campo: problema.path.join('.') || '(cuerpo)',
        mensaje: problema.message,
      })),
    );
  }
  return resultado.data;
}
