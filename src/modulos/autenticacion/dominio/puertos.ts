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
  /** Devuelve null si el usuario no existe. */
  actualizarRol(id: number, rol: Rol): Promise<Usuario | null>;
}

export interface NuevoTokenRecuperacion {
  usuarioId: number;
  tokenHash: string;
  fechaExpiracion: Date;
}

export interface RepositorioTokensRecuperacion {
  /** Guarda el token nuevo e invalida los anteriores sin usar del mismo usuario: solo vale el último enlace. */
  reemplazarTokensDelUsuario(token: NuevoTokenRecuperacion): Promise<void>;
  /**
   * En una sola operación atómica: consume el token si está vigente y sin usar, cambia la contraseña
   * del usuario e invalida sus demás tokens. Devuelve el id del usuario, o null si el token no sirve.
   */
  consumirTokenYCambiarContrasena(tokenHash: string, contrasenaCifrada: string, ahora: Date): Promise<number | null>;
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

export interface CorreoRecuperacion {
  para: string;
  enlace: string;
  minutosDeVigencia: number;
}

export interface EnviadorCorreos {
  enviarRecuperacionContrasena(correo: CorreoRecuperacion): Promise<void>;
}

/** Permite controlar "ahora" en las pruebas (por ejemplo, para simular un token expirado). */
export type Reloj = () => Date;
