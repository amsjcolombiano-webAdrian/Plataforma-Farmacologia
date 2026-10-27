import type { CorreoRecuperacion, EnviadorCorreos } from '../dominio/puertos';

/**
 * Enviador de correos para desarrollo: en lugar de enviar, muestra el correo en la consola del servidor.
 * El proveedor real de correo está pendiente de definir (Requisitos v3, sección 8); cuando se elija,
 * se crea otro adaptador que implemente EnviadorCorreos y se cambia en la fachada.
 */
export class EnviadorCorreosConsola implements EnviadorCorreos {
  async enviarRecuperacionContrasena({ para, enlace, minutosDeVigencia }: CorreoRecuperacion): Promise<void> {
    console.log(
      [
        '──── Correo (solo desarrollo, no se envía) ────',
        `Para: ${para}`,
        'Asunto: Restablece tu contraseña',
        `Usa este enlace para elegir una contraseña nueva. Vence en ${minutosDeVigencia} minutos y solo sirve una vez:`,
        enlace,
        'Si no pediste este cambio, ignora este mensaje.',
        '──────────────────────────────────────────────',
      ].join('\n'),
    );
  }
}
