/**
 * Contratos de los eventos internos entre módulos (ADR-0004).
 * Solo viajan identificadores y datos mínimos: nunca modelos internos de un módulo.
 */
export interface UsuarioRegistrado {
  estudianteId: number;
  fechaRegistro: Date;
}

export interface DesafioCompletado {
  estudianteId: number;
  desafioId: number;
  leccionId: number;
  xpRecompensa: number;
  /** false cuando el estudiante repite un desafío ya completado: no vuelve a ganar XP. */
  esPrimeraVezCompletado: boolean;
  fecha: Date;
}

export interface EventosDelSistema {
  'usuario.registrado': UsuarioRegistrado;
  'desafio.completado': DesafioCompletado;
}

export type NombreEvento = keyof EventosDelSistema;
