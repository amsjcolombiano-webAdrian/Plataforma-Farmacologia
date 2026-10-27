import 'dotenv/config';

export type EntornoEjecucion = 'desarrollo' | 'pruebas' | 'produccion';

export interface ConfiguracionBaseDeDatos {
  servidor: string;
  puerto: number;
  usuario: string;
  contrasena: string;
  nombre: string;
  conexionesMaximas: number;
}

export interface ConfiguracionAutenticacion {
  secretoJwt: string;
  expiracionAccesoMinutos: number;
}

export interface Configuracion {
  entorno: EntornoEjecucion;
  puerto: number;
  /** Dirección de la aplicación web (frontend); se usa para armar enlaces que van en los correos. */
  urlAplicacionWeb: string;
  baseDeDatos: ConfiguracionBaseDeDatos;
  autenticacion: ConfiguracionAutenticacion;
}

const LONGITUD_MINIMA_SECRETO_JWT = 32;

function leerVariableObligatoria(nombre: string): string {
  const valor = process.env[nombre];
  if (valor === undefined || valor.trim() === '') {
    throw new Error(`Falta la variable de entorno obligatoria: ${nombre}`);
  }
  return valor.trim();
}

function leerVariableNumerica(nombre: string, valorPorDefecto?: number): number {
  const valorTexto = process.env[nombre];
  if (valorTexto === undefined || valorTexto.trim() === '') {
    if (valorPorDefecto !== undefined) {
      return valorPorDefecto;
    }
    throw new Error(`Falta la variable de entorno obligatoria: ${nombre}`);
  }
  const valorNumerico = Number(valorTexto);
  if (!Number.isInteger(valorNumerico) || valorNumerico <= 0) {
    throw new Error(`La variable ${nombre} debe ser un número entero positivo.`);
  }
  return valorNumerico;
}

function leerVariableUrl(nombre: string, valorPorDefecto: string): string {
  const valor = process.env[nombre]?.trim() || valorPorDefecto;
  if (!URL.canParse(valor)) {
    throw new Error(`La variable ${nombre} debe ser una URL válida (por ejemplo, http://localhost:5173).`);
  }
  return valor.replace(/\/+$/, '');
}

function determinarEntorno(): EntornoEjecucion {
  const valor = process.env['NODE_ENV'] ?? 'development';
  if (valor === 'production') return 'produccion';
  if (valor === 'test') return 'pruebas';
  return 'desarrollo';
}

export function cargarConfiguracion(): Configuracion {
  const entorno = determinarEntorno();
  const secretoJwt = leerVariableObligatoria('JWT_SECRETO');

  if (entorno === 'produccion' && secretoJwt.length < LONGITUD_MINIMA_SECRETO_JWT) {
    throw new Error(
      `JWT_SECRETO debe tener al menos ${LONGITUD_MINIMA_SECRETO_JWT} caracteres en producción.`,
    );
  }

  return {
    entorno,
    puerto: leerVariableNumerica('PUERTO', 3000),
    urlAplicacionWeb: leerVariableUrl('URL_APLICACION_WEB', 'http://localhost:5173'),
    baseDeDatos: {
      servidor: leerVariableObligatoria('BASE_DATOS_SERVIDOR'),
      puerto: leerVariableNumerica('BASE_DATOS_PUERTO', 3306),
      usuario: leerVariableObligatoria('BASE_DATOS_USUARIO'),
      contrasena: leerVariableObligatoria('BASE_DATOS_CONTRASENA'),
      nombre: leerVariableObligatoria('BASE_DATOS_NOMBRE'),
      conexionesMaximas: leerVariableNumerica('BASE_DATOS_CONEXIONES_MAXIMAS', 20),
    },
    autenticacion: {
      secretoJwt,
      expiracionAccesoMinutos: leerVariableNumerica('JWT_EXPIRACION_MINUTOS', 60),
    },
  };
}

/** Configuración única, validada al arrancar: si falta algo, la aplicación no inicia. */
export const configuracion: Configuracion = cargarConfiguracion();
