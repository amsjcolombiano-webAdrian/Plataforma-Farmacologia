import type { DatosNuevoUsuario, Rol, Usuario } from './usuario';

/**
 * Puertos del módulo (ADR-0004, regla 5): el dominio y la aplicación dependen de estas
 * interfaces, y la infraestructura aporta las implementaciones concretas (Prisma, bcrypt, JWT).
 * Así las pruebas pueden inyectar versiones falsas sin base de datos.
 */
export interface RepositorioUsuarios {
  buscarPorEmail(email: string): Promise<Usuario | null>;
  buscarPorId(id: number): Promise<Usuario | null>;
  /** Lanza ErrorConflicto si el email ya está registrado. */
  crear(datos: DatosNuevoUsuario): Promise<Usuario>;
}

export interface CifradorContrasenas {
  cifrar(contrasenaPlana: string): Promise<string>;
  coincide(contrasenaPlana: string, contrasenaCifrada: string): Promise<boolean>;
}

export interface DatosToken {
  usuarioId: number;
  rol: Rol;
}

export interface EmisorTokens {
  emitir(datos: DatosToken): string;
  /** Devuelve null si el token es inválido, está alterado o expiró. */
  verificar(token: string): DatosToken | null;
}
