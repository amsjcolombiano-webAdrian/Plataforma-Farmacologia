import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ErrorAplicacion, ErrorNoEncontrado, ErrorValidacion } from '../errores/erroresAplicacion';

export interface RespuestaError {
  error: {
    codigo: string;
    mensaje: string;
    detalles?: ErrorValidacion['detalles'];
  };
}

/** Para rutas que no existen: responde 404 con el mismo formato que el resto de errores. */
export const rutaNoEncontrada: RequestHandler = (_peticion, _respuesta, siguiente) => {
  siguiente(new ErrorNoEncontrado('La ruta solicitada no existe.'));
};

/**
 * Manejador de errores único de la API.
 * Los ErrorAplicacion se responden tal cual; cualquier otro error se registra
 * y se responde como 500 genérico, sin exponer detalles internos al cliente.
 */
export const manejadorErrores: ErrorRequestHandler = (error: unknown, _peticion, respuesta, _siguiente) => {
  if (error instanceof ErrorAplicacion) {
    const cuerpo: RespuestaError = { error: { codigo: error.codigoError, mensaje: error.message } };
    if (error instanceof ErrorValidacion) cuerpo.error.detalles = error.detalles;
    respuesta.status(error.codigoHttp).json(cuerpo);
    return;
  }

  // JSON mal formado en el cuerpo de la petición (lo lanza express.json()).
  if (error instanceof SyntaxError && 'body' in error) {
    const cuerpo: RespuestaError = { error: { codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo de la petición no es un JSON válido.' } };
    respuesta.status(400).json(cuerpo);
    return;
  }

  console.error('Error no controlado:', error);
  const cuerpo: RespuestaError = { error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado.' } };
  respuesta.status(500).json(cuerpo);
};
