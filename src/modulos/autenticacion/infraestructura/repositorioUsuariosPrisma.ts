import { ErrorConflicto } from '../../../compartido/errores/erroresAplicacion';
import { Prisma, type AutenticacionUsuario, type PrismaClient } from '../../../generado/prisma/client';
import type { RepositorioUsuarios } from '../dominio/puertos';
import type { DatosNuevoUsuario, Rol, Usuario } from '../dominio/usuario';

/** Código de Prisma para "violación de restricción única". */
const CODIGO_REGISTRO_DUPLICADO = 'P2002';
/** Código de Prisma para "el registro a actualizar no existe". */
const CODIGO_REGISTRO_INEXISTENTE = 'P2025';

function aUsuarioDeDominio(fila: AutenticacionUsuario): Usuario {
  return {
    id: fila.id,
    email: fila.email,
    contrasenaCifrada: fila.passwordHash,
    rol: fila.rol,
    fechaCreacion: fila.fechaCreacion,
  };
}

/** Solo lee y escribe la tabla autenticacion_usuarios (ADR-0004, regla 2). */
export class RepositorioUsuariosPrisma implements RepositorioUsuarios {
  constructor(private readonly prisma: PrismaClient) {}

  async buscarPorEmail(email: string): Promise<Usuario | null> {
    const fila = await this.prisma.autenticacionUsuario.findUnique({ where: { email } });
    return fila === null ? null : aUsuarioDeDominio(fila);
  }

  async buscarPorId(id: number): Promise<Usuario | null> {
    const fila = await this.prisma.autenticacionUsuario.findUnique({ where: { id } });
    return fila === null ? null : aUsuarioDeDominio(fila);
  }

  async crear(datos: DatosNuevoUsuario): Promise<Usuario> {
    try {
      const fila = await this.prisma.autenticacionUsuario.create({
        data: { email: datos.email, passwordHash: datos.contrasenaCifrada, rol: datos.rol },
      });
      return aUsuarioDeDominio(fila);
    } catch (error) {
      // Se confía en el índice único y no en un "buscar antes de crear", que fallaría con dos registros simultáneos.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === CODIGO_REGISTRO_DUPLICADO) {
        throw new ErrorConflicto('Ya existe una cuenta con ese correo.');
      }
      throw error;
    }
  }

  async actualizarRol(id: number, rol: Rol): Promise<Usuario | null> {
    try {
      const fila = await this.prisma.autenticacionUsuario.update({ where: { id }, data: { rol } });
      return aUsuarioDeDominio(fila);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === CODIGO_REGISTRO_INEXISTENTE) {
        return null;
      }
      throw error;
    }
  }
}
