import {
  ErrorConflicto,
  ErrorNoAutenticado,
  ErrorNoAutorizado,
  ErrorNoEncontrado,
  ErrorValidacion,
} from '../../../compartido/errores/erroresAplicacion';
import type { EmisorEventos } from '../../../compartido/eventos/emisorEventos';
import { validarConEsquema } from '../../../compartido/validacion/validarConEsquema';
import type {
  CifradorContrasenas,
  DatosToken,
  EmisorTokens,
  EnviadorCorreos,
  Reloj,
  RepositorioTokensRecuperacion,
  RepositorioUsuarios,
} from '../dominio/puertos';
import {
  MINUTOS_VIGENCIA_TOKEN_RECUPERACION,
  calcularHashTokenRecuperacion,
  generarTokenRecuperacion,
} from '../dominio/tokenRecuperacion';
import type { Rol, Usuario } from '../dominio/usuario';
import {
  esquemaAsignacionRol,
  esquemaInicioSesion,
  esquemaRegistroEstudiante,
  esquemaRestablecimientoContrasena,
  esquemaSolicitudRecuperacion,
} from './esquemas';

/** DTO de salida: lo único que sale del módulo sobre un usuario. Nunca la contraseña cifrada. */
export interface UsuarioPublico {
  id: number;
  email: string;
  rol: Rol;
  fechaCreacion: Date;
}

export interface SesionIniciada {
  token: string;
  usuario: UsuarioPublico;
}

export interface DependenciasAutenticacion {
  repositorioUsuarios: RepositorioUsuarios;
  repositorioTokensRecuperacion: RepositorioTokensRecuperacion;
  cifradorContrasenas: CifradorContrasenas;
  emisorTokens: EmisorTokens;
  emisorEventos: EmisorEventos;
  enviadorCorreos: EnviadorCorreos;
  /** Página de la aplicación web donde el usuario escribe su contraseña nueva; se le añade ?token=... */
  urlRestablecimientoContrasena: string;
  reloj?: Reloj;
}

const MENSAJE_CREDENCIALES_INVALIDAS = 'Correo o contraseña incorrectos.';
const MENSAJE_TOKEN_RECUPERACION_INVALIDO = 'El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo.';
const MILISEGUNDOS_POR_MINUTO = 60_000;

function aUsuarioPublico(usuario: Usuario): UsuarioPublico {
  return { id: usuario.id, email: usuario.email, rol: usuario.rol, fechaCreacion: usuario.fechaCreacion };
}

export class CasosDeUsoAutenticacion {
  /**
   * Hash de relleno para comparar cuando el correo no existe: así iniciar sesión tarda lo mismo
   * exista o no la cuenta, y no se puede averiguar qué correos están registrados.
   */
  private hashDeRelleno: Promise<string> | null = null;

  constructor(private readonly dependencias: DependenciasAutenticacion) {}

  /** Registro público: siempre crea un Estudiante. Los otros roles los asigna un Administrador. */
  async registrarEstudiante(datosEntrada: unknown): Promise<UsuarioPublico> {
    const { email, contrasena } = validarConEsquema(esquemaRegistroEstudiante, datosEntrada);
    const { repositorioUsuarios, cifradorContrasenas, emisorEventos } = this.dependencias;

    const usuario = await repositorioUsuarios.crear({
      email,
      contrasenaCifrada: await cifradorContrasenas.cifrar(contrasena),
      rol: 'estudiante',
    });

    await emisorEventos.publicar('usuario.registrado', {
      estudianteId: usuario.id,
      fechaRegistro: usuario.fechaCreacion,
    });

    return aUsuarioPublico(usuario);
  }

  async iniciarSesion(datosEntrada: unknown): Promise<SesionIniciada> {
    const { email, contrasena } = validarConEsquema(esquemaInicioSesion, datosEntrada);
    const { repositorioUsuarios, cifradorContrasenas, emisorTokens } = this.dependencias;

    const usuario = await repositorioUsuarios.buscarPorEmail(email);
    const contrasenaCifrada = usuario?.contrasenaCifrada ?? (await this.obtenerHashDeRelleno());
    const contrasenaCorrecta = await cifradorContrasenas.coincide(contrasena, contrasenaCifrada);

    if (usuario === null || !contrasenaCorrecta) {
      throw new ErrorNoAutenticado(MENSAJE_CREDENCIALES_INVALIDAS);
    }

    return {
      token: emisorTokens.emitir({ usuarioId: usuario.id, rol: usuario.rol }),
      usuario: aUsuarioPublico(usuario),
    };
  }

  /** Usado por el middleware de autenticación en cada petición protegida. */
  verificarToken(token: string): DatosToken {
    const datos = this.dependencias.emisorTokens.verificar(token);
    if (datos === null) {
      throw new ErrorNoAutenticado('La sesión no es válida o expiró. Inicia sesión de nuevo.');
    }
    return datos;
  }

  async obtenerUsuarioPorId(id: number): Promise<UsuarioPublico | null> {
    const usuario = await this.dependencias.repositorioUsuarios.buscarPorId(id);
    return usuario === null ? null : aUsuarioPublico(usuario);
  }

  /**
   * Envía un enlace de un solo uso para restablecer la contraseña.
   * Si el correo no está registrado no hace nada, pero quien llama no puede distinguirlo:
   * la respuesta es la misma y el envío del correo no se espera (no delata por tiempo de respuesta).
   */
  async solicitarRecuperacionContrasena(datosEntrada: unknown): Promise<void> {
    const { email } = validarConEsquema(esquemaSolicitudRecuperacion, datosEntrada);
    const { repositorioUsuarios, repositorioTokensRecuperacion, enviadorCorreos, urlRestablecimientoContrasena } =
      this.dependencias;

    const usuario = await repositorioUsuarios.buscarPorEmail(email);
    if (usuario === null) return;

    const token = generarTokenRecuperacion();
    await repositorioTokensRecuperacion.reemplazarTokensDelUsuario({
      usuarioId: usuario.id,
      tokenHash: calcularHashTokenRecuperacion(token),
      fechaExpiracion: new Date(this.ahora().getTime() + MINUTOS_VIGENCIA_TOKEN_RECUPERACION * MILISEGUNDOS_POR_MINUTO),
    });

    const enlace = new URL(urlRestablecimientoContrasena);
    enlace.searchParams.set('token', token);
    enviadorCorreos
      .enviarRecuperacionContrasena({
        para: usuario.email,
        enlace: enlace.toString(),
        minutosDeVigencia: MINUTOS_VIGENCIA_TOKEN_RECUPERACION,
      })
      .catch((error: unknown) => console.error('No se pudo enviar el correo de recuperación:', error));
  }

  async restablecerContrasena(datosEntrada: unknown): Promise<void> {
    const { token, contrasenaNueva } = validarConEsquema(esquemaRestablecimientoContrasena, datosEntrada);
    const { repositorioTokensRecuperacion, cifradorContrasenas } = this.dependencias;

    const usuarioId = await repositorioTokensRecuperacion.consumirTokenYCambiarContrasena(
      calcularHashTokenRecuperacion(token),
      await cifradorContrasenas.cifrar(contrasenaNueva),
      this.ahora(),
    );
    if (usuarioId === null) {
      throw new ErrorValidacion([{ campo: 'token', mensaje: MENSAJE_TOKEN_RECUPERACION_INVALIDO }], MENSAJE_TOKEN_RECUPERACION_INVALIDO);
    }
  }

  /**
   * Solo un Administrador puede asignar roles, y no puede cambiarse el suyo
   * (así nunca se queda la plataforma sin administradores por accidente).
   * El cambio se refleja en el próximo inicio de sesión del usuario: su token actual conserva el rol anterior hasta expirar.
   */
  async asignarRol(datosEntrada: unknown, ejecutadoPor: DatosToken): Promise<UsuarioPublico> {
    if (ejecutadoPor.rol !== 'administrador') throw new ErrorNoAutorizado();
    const { usuarioId, rol } = validarConEsquema(esquemaAsignacionRol, datosEntrada);
    if (usuarioId === ejecutadoPor.usuarioId) throw new ErrorConflicto('No puedes cambiar tu propio rol.');

    const usuario = await this.dependencias.repositorioUsuarios.actualizarRol(usuarioId, rol);
    if (usuario === null) throw new ErrorNoEncontrado('El usuario no existe.');
    return aUsuarioPublico(usuario);
  }

  /**
   * Para el script de consola que crea el primer Administrador (npm run asignar-rol).
   * No pasa por la API: solo puede usarlo quien tiene acceso al servidor y a su .env.
   */
  async asignarRolDesdeConsola(email: string, rol: Rol): Promise<UsuarioPublico> {
    const { repositorioUsuarios } = this.dependencias;
    const { email: emailNormalizado } = validarConEsquema(esquemaSolicitudRecuperacion, { email });
    const usuario = await repositorioUsuarios.buscarPorEmail(emailNormalizado);
    if (usuario === null) throw new ErrorNoEncontrado(`No existe una cuenta con el correo ${emailNormalizado}.`);

    const { rol: rolValidado } = validarConEsquema(esquemaAsignacionRol, { usuarioId: usuario.id, rol });
    const actualizado = await repositorioUsuarios.actualizarRol(usuario.id, rolValidado);
    if (actualizado === null) throw new ErrorNoEncontrado(`No existe una cuenta con el correo ${emailNormalizado}.`);
    return aUsuarioPublico(actualizado);
  }

  private ahora(): Date {
    return (this.dependencias.reloj ?? (() => new Date()))();
  }

  private obtenerHashDeRelleno(): Promise<string> {
    this.hashDeRelleno ??= this.dependencias.cifradorContrasenas.cifrar('contrasena-de-relleno-no-usada');
    return this.hashDeRelleno;
  }
}
