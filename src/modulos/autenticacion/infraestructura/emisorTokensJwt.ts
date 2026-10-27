import jwt from 'jsonwebtoken';
import type { DatosToken, EmisorTokens } from '../dominio/puertos';
import { ROLES, type Rol } from '../dominio/usuario';

/** Se fija el algoritmo al verificar para que nadie pueda colar un token con "alg: none" u otro algoritmo. */
const ALGORITMO = 'HS256';

function esRol(valor: unknown): valor is Rol {
  return typeof valor === 'string' && (ROLES as readonly string[]).includes(valor);
}

export class EmisorTokensJwt implements EmisorTokens {
  constructor(
    private readonly secreto: string,
    private readonly expiracionMinutos: number,
  ) {}

  emitir({ usuarioId, rol }: DatosToken): string {
    return jwt.sign({ rol }, this.secreto, {
      algorithm: ALGORITMO,
      subject: String(usuarioId),
      expiresIn: this.expiracionMinutos * 60,
    });
  }

  verificar(token: string): DatosToken | null {
    try {
      const carga = jwt.verify(token, this.secreto, { algorithms: [ALGORITMO] });
      if (typeof carga === 'string') return null;

      const usuarioId = Number(carga.sub);
      if (!Number.isInteger(usuarioId) || usuarioId <= 0 || !esRol(carga['rol'])) return null;

      return { usuarioId, rol: carga['rol'] };
    } catch {
      return null;
    }
  }
}
