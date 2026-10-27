import type { PrismaClient } from '../../../generado/prisma/client';
import type { NuevoTokenRecuperacion, RepositorioTokensRecuperacion } from '../dominio/puertos';

/** Solo lee y escribe autenticacion_tokens_recuperacion y autenticacion_usuarios (ADR-0004, regla 2). */
export class RepositorioTokensRecuperacionPrisma implements RepositorioTokensRecuperacion {
  constructor(private readonly prisma: PrismaClient) {}

  async reemplazarTokensDelUsuario({ usuarioId, tokenHash, fechaExpiracion }: NuevoTokenRecuperacion): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.autenticacionTokenRecuperacion.deleteMany({ where: { usuarioId, fechaUso: null } }),
      this.prisma.autenticacionTokenRecuperacion.create({ data: { usuarioId, tokenHash, fechaExpiracion } }),
    ]);
  }

  consumirTokenYCambiarContrasena(tokenHash: string, contrasenaCifrada: string, ahora: Date): Promise<number | null> {
    return this.prisma.$transaction(async (transaccion) => {
      // Marcar como usado solo si sigue vigente y sin usar: si dos peticiones llegan a la vez con el
      // mismo token, solo una consigue actualizar la fila y la otra recibe count = 0.
      const { count } = await transaccion.autenticacionTokenRecuperacion.updateMany({
        where: { tokenHash, fechaUso: null, fechaExpiracion: { gt: ahora } },
        data: { fechaUso: ahora },
      });
      if (count === 0) return null;

      const token = await transaccion.autenticacionTokenRecuperacion.findUniqueOrThrow({ where: { tokenHash } });
      await transaccion.autenticacionUsuario.update({
        where: { id: token.usuarioId },
        data: { passwordHash: contrasenaCifrada },
      });
      await transaccion.autenticacionTokenRecuperacion.deleteMany({
        where: { usuarioId: token.usuarioId, fechaUso: null },
      });
      return token.usuarioId;
    });
  }
}
