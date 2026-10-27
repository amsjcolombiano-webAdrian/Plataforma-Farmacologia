import type { EventosDelSistema, NombreEvento } from '../tipos/eventosDelSistema';

type ManejadorEvento<K extends NombreEvento> = (carga: EventosDelSistema[K]) => void | Promise<void>;

/**
 * Bus de eventos interno del monolito.
 * - Tipado: cada evento tiene su propia carga, definida en eventosDelSistema.ts.
 * - Aislado: si un manejador falla, no afecta al módulo que publicó ni a los demás manejadores.
 */
export class EmisorEventos {
  private readonly manejadoresPorEvento = new Map<NombreEvento, Array<ManejadorEvento<NombreEvento>>>();

  suscribir<K extends NombreEvento>(nombreEvento: K, manejador: ManejadorEvento<K>): void {
    const manejadores = this.manejadoresPorEvento.get(nombreEvento) ?? [];
    manejadores.push(manejador as ManejadorEvento<NombreEvento>);
    this.manejadoresPorEvento.set(nombreEvento, manejadores);
  }

  async publicar<K extends NombreEvento>(nombreEvento: K, carga: EventosDelSistema[K]): Promise<void> {
    const manejadores = this.manejadoresPorEvento.get(nombreEvento) ?? [];
    const resultados = await Promise.allSettled(
      manejadores.map(async (manejador) => manejador(carga)),
    );

    for (const resultado of resultados) {
      if (resultado.status === 'rejected') {
        console.error(`Falló un manejador del evento "${nombreEvento}":`, resultado.reason);
      }
    }
  }

  /** Útil en pruebas para dejar el bus limpio entre casos. */
  quitarTodosLosManejadores(): void {
    this.manejadoresPorEvento.clear();
  }
}

export const emisorEventos = new EmisorEventos();
