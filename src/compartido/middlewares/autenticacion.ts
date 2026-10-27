import type { RequestHandler } from 'express';
import { ErrorNoAutenticado, ErrorNoAutorizado } from '../errores/erroresAplicacion';

/**
 * Datos de la sesión que viajan en cada petición autenticada.
 * Se definen aquí (y no en el módulo de Autenticación) para que compartido/ no dependa de ningún módulo:
 * quien monta el middleware le inyecta la función que verifica el token.
 */
export interface SesionActual {
  usuarioId: number;
  rol: string;
}

export type VerificadorToken = (token: string) => SesionActual;

declare global {
  namespace Express {
    interface Locals {
      sesion?: SesionActual;
    }
  }
}

const PREFIJO_BEARER = 'Bearer ';

/** Exige un JWT válido en la cabecera Authorization y deja la sesión en respuesta.locals.sesion. */
export function requerirSesion(verificarToken: VerificadorToken): RequestHandler {
  return (peticion, respuesta, siguiente) => {
    const cabecera = peticion.headers.authorization;
    if (cabecera === undefined || !cabecera.startsWith(PREFIJO_BEARER)) {
      throw new ErrorNoAutenticado();
    }
    respuesta.locals.sesion = verificarToken(cabecera.slice(PREFIJO_BEARER.length).trim());
    siguiente();
  };
}

/** Debe ir después de requerirSesion. Deja pasar solo a los roles indicados. */
export function requerirRol(...rolesPermitidos: string[]): RequestHandler {
  return (_peticion, respuesta, siguiente) => {
    const sesion = respuesta.locals.sesion;
    if (sesion === undefined) throw new ErrorNoAutenticado();
    if (!rolesPermitidos.includes(sesion.rol)) throw new ErrorNoAutorizado();
    siguiente();
  };
}
