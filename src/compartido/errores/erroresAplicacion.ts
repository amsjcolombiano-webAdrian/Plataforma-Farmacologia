/**
 * Errores controlados de la aplicación.
 * Cada error lleva el código HTTP que le corresponde y un código interno estable,
 * para que el middleware de errores responda siempre con el mismo formato
 * y nunca exponga detalles internos al cliente.
 */
export class ErrorAplicacion extends Error {
  public readonly codigoHttp: number;
  public readonly codigoError: string;

  constructor(mensaje: string, codigoHttp: number, codigoError: string) {
    super(mensaje);
    this.name = new.target.name;
    this.codigoHttp = codigoHttp;
    this.codigoError = codigoError;
  }
}

export interface DetalleValidacion {
  campo: string;
  mensaje: string;
}

export class ErrorValidacion extends ErrorAplicacion {
  public readonly detalles: DetalleValidacion[];

  constructor(detalles: DetalleValidacion[], mensaje = 'Los datos enviados no son válidos.') {
    super(mensaje, 400, 'VALIDACION_FALLIDA');
    this.detalles = detalles;
  }
}

export class ErrorNoAutenticado extends ErrorAplicacion {
  constructor(mensaje = 'Debes iniciar sesión para continuar.') {
    super(mensaje, 401, 'NO_AUTENTICADO');
  }
}

export class ErrorNoAutorizado extends ErrorAplicacion {
  constructor(mensaje = 'No tienes permiso para realizar esta acción.') {
    super(mensaje, 403, 'NO_AUTORIZADO');
  }
}

export class ErrorNoEncontrado extends ErrorAplicacion {
  constructor(mensaje = 'El recurso solicitado no existe.') {
    super(mensaje, 404, 'NO_ENCONTRADO');
  }
}

export class ErrorConflicto extends ErrorAplicacion {
  constructor(mensaje = 'La operación entra en conflicto con el estado actual.') {
    super(mensaje, 409, 'CONFLICTO');
  }
}
