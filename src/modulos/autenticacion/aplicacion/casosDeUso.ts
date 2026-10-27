import { ErrorNoAutenticado } from '../../../compartido/errores/erroresAplicacion';
import type { EmisorEventos } from '../../../compartido/eventos/emisorEventos';
import { validarConEsquema } from '../../../compartido/validacion/validarConEsquema';
import type { CifradorContrasenas, DatosToken, EmisorTokens, RepositorioUsuarios } from '../dominio/puertos';
import type { Rol, Usuario } from '../dominio/usuario';
import { esquemaInicioSesion, esquemaRegistroEstudiante } from './esquemas';

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
  cifradorContrasenas: CifradorContrasenas;
  emisorTokens: EmisorTokens;
  emisorEventos: EmisorEventos;
}

const MENSAJE_CREDENCIALES_INVALIDAS = 'Correo o contraseña incorrectos.';

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

  private obtenerHashDeRelleno(): Promise<string> {
    this.hashDeRelleno ??= this.dependencias.cifradorContrasenas.cifrar('contrasena-de-relleno-no-usada');
    return this.hashDeRelleno;
  }
}
