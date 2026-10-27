import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  ErrorConflicto,
  ErrorNoAutenticado,
  ErrorNoAutorizado,
  ErrorNoEncontrado,
  ErrorValidacion,
} from '../../src/compartido/errores/erroresAplicacion';
import { EmisorEventos } from '../../src/compartido/eventos/emisorEventos';
import type { UsuarioRegistrado } from '../../src/compartido/tipos/eventosDelSistema';
import { CasosDeUsoAutenticacion } from '../../src/modulos/autenticacion/aplicacion/casosDeUso';
import type {
  CorreoRecuperacion,
  EnviadorCorreos,
  NuevoTokenRecuperacion,
  RepositorioTokensRecuperacion,
  RepositorioUsuarios,
} from '../../src/modulos/autenticacion/dominio/puertos';
import type { DatosNuevoUsuario, Rol, Usuario } from '../../src/modulos/autenticacion/dominio/usuario';
import { CifradorContrasenasBcrypt } from '../../src/modulos/autenticacion/infraestructura/cifradorContrasenasBcrypt';
import { EmisorTokensJwt } from '../../src/modulos/autenticacion/infraestructura/emisorTokensJwt';

/** Repositorio en memoria: reemplaza a Prisma gracias a la inyección de dependencias (ADR-0004). */
class RepositorioUsuariosEnMemoria implements RepositorioUsuarios {
  readonly usuarios: Usuario[] = [];

  async buscarPorEmail(email: string): Promise<Usuario | null> {
    return this.usuarios.find((usuario) => usuario.email === email) ?? null;
  }

  async buscarPorId(id: number): Promise<Usuario | null> {
    return this.usuarios.find((usuario) => usuario.id === id) ?? null;
  }

  async crear(datos: DatosNuevoUsuario): Promise<Usuario> {
    if (await this.buscarPorEmail(datos.email)) throw new ErrorConflicto('Ya existe una cuenta con ese correo.');
    const usuario: Usuario = { id: this.usuarios.length + 1, fechaCreacion: new Date(), ...datos };
    this.usuarios.push(usuario);
    return usuario;
  }

  async actualizarRol(id: number, rol: Rol): Promise<Usuario | null> {
    const usuario = await this.buscarPorId(id);
    if (usuario === null) return null;
    usuario.rol = rol;
    return { ...usuario };
  }
}

interface TokenGuardado extends NuevoTokenRecuperacion {
  fechaUso: Date | null;
}

class RepositorioTokensRecuperacionEnMemoria implements RepositorioTokensRecuperacion {
  private tokens: TokenGuardado[] = [];

  constructor(private readonly repositorioUsuarios: RepositorioUsuariosEnMemoria) {}

  async reemplazarTokensDelUsuario(token: NuevoTokenRecuperacion): Promise<void> {
    this.tokens = this.tokens.filter((t) => !(t.usuarioId === token.usuarioId && t.fechaUso === null));
    this.tokens.push({ ...token, fechaUso: null });
  }

  async consumirTokenYCambiarContrasena(tokenHash: string, contrasenaCifrada: string, ahora: Date): Promise<number | null> {
    const token = this.tokens.find((t) => t.tokenHash === tokenHash && t.fechaUso === null && t.fechaExpiracion > ahora);
    if (token === undefined) return null;
    token.fechaUso = ahora;
    const usuario = await this.repositorioUsuarios.buscarPorId(token.usuarioId);
    if (usuario !== null) usuario.contrasenaCifrada = contrasenaCifrada;
    this.tokens = this.tokens.filter((t) => !(t.usuarioId === token.usuarioId && t.fechaUso === null));
    return token.usuarioId;
  }
}

class EnviadorCorreosFalso implements EnviadorCorreos {
  readonly enviados: CorreoRecuperacion[] = [];

  async enviarRecuperacionContrasena(correo: CorreoRecuperacion): Promise<void> {
    this.enviados.push(correo);
  }

  tokenDelUltimoCorreo(): string {
    const ultimo = this.enviados.at(-1);
    assert.ok(ultimo, 'No se envió ningún correo.');
    const token = new URL(ultimo.enlace).searchParams.get('token');
    assert.ok(token, 'El enlace no trae token.');
    return token;
  }
}

const SECRETO_PRUEBAS = 'secreto-solo-para-pruebas-de-autenticacion';
const URL_RESTABLECIMIENTO = 'http://localhost:5173/restablecer-contrasena';
const CONTRASENA = 'clave-segura-123';

describe('Casos de uso de Autenticación', () => {
  let casosDeUso: CasosDeUsoAutenticacion;
  let repositorioUsuarios: RepositorioUsuariosEnMemoria;
  let enviadorCorreos: EnviadorCorreosFalso;
  let eventosRegistrados: UsuarioRegistrado[];
  let ahora: Date;

  beforeEach(() => {
    const emisorEventos = new EmisorEventos();
    eventosRegistrados = [];
    emisorEventos.suscribir('usuario.registrado', (carga) => {
      eventosRegistrados.push(carga);
    });
    repositorioUsuarios = new RepositorioUsuariosEnMemoria();
    enviadorCorreos = new EnviadorCorreosFalso();
    ahora = new Date('2026-10-27T12:00:00Z');
    casosDeUso = new CasosDeUsoAutenticacion({
      repositorioUsuarios,
      repositorioTokensRecuperacion: new RepositorioTokensRecuperacionEnMemoria(repositorioUsuarios),
      cifradorContrasenas: new CifradorContrasenasBcrypt(),
      emisorTokens: new EmisorTokensJwt(SECRETO_PRUEBAS, 60),
      emisorEventos,
      enviadorCorreos,
      urlRestablecimientoContrasena: URL_RESTABLECIMIENTO,
      reloj: () => ahora,
    });
  });

  async function registrarConRol(email: string, rol: Rol) {
    const usuario = await casosDeUso.registrarEstudiante({ email, contrasena: CONTRASENA });
    if (rol !== 'estudiante') await repositorioUsuarios.actualizarRol(usuario.id, rol);
    return { ...usuario, rol };
  }

  describe('Registro e inicio de sesión', () => {
    it('registra un Estudiante con el correo normalizado, sin exponer la contraseña, y publica usuario.registrado', async () => {
      const usuario = await casosDeUso.registrarEstudiante({ email: '  Ana@Ejemplo.COM ', contrasena: CONTRASENA });

      assert.equal(usuario.email, 'ana@ejemplo.com');
      assert.equal(usuario.rol, 'estudiante');
      assert.equal('contrasenaCifrada' in usuario, false);
      assert.deepEqual(eventosRegistrados, [{ estudianteId: usuario.id, fechaRegistro: usuario.fechaCreacion }]);
    });

    it('rechaza datos inválidos con un detalle por campo', async () => {
      await assert.rejects(
        casosDeUso.registrarEstudiante({ email: 'no-es-correo', contrasena: 'corta' }),
        (error: unknown) => {
          assert.ok(error instanceof ErrorValidacion);
          assert.deepEqual(error.detalles.map((detalle) => detalle.campo).sort(), ['contrasena', 'email']);
          return true;
        },
      );
    });

    it('no permite registrar dos cuentas con el mismo correo', async () => {
      await casosDeUso.registrarEstudiante({ email: 'ana@ejemplo.com', contrasena: CONTRASENA });
      await assert.rejects(
        casosDeUso.registrarEstudiante({ email: 'ANA@ejemplo.com', contrasena: 'otra-clave-456' }),
        ErrorConflicto,
      );
    });

    it('inicia sesión y el token emitido identifica al usuario y su rol', async () => {
      const registrado = await casosDeUso.registrarEstudiante({ email: 'ana@ejemplo.com', contrasena: CONTRASENA });
      const sesion = await casosDeUso.iniciarSesion({ email: 'Ana@Ejemplo.com', contrasena: CONTRASENA });

      assert.equal(sesion.usuario.id, registrado.id);
      assert.deepEqual(casosDeUso.verificarToken(sesion.token), { usuarioId: registrado.id, rol: 'estudiante' });
    });

    it('responde con el mismo error si la contraseña es incorrecta o si el correo no existe', async () => {
      await casosDeUso.registrarEstudiante({ email: 'ana@ejemplo.com', contrasena: CONTRASENA });

      const errorContrasena = await casosDeUso
        .iniciarSesion({ email: 'ana@ejemplo.com', contrasena: 'incorrecta' })
        .catch((error: unknown) => error);
      const errorCorreo = await casosDeUso
        .iniciarSesion({ email: 'nadie@ejemplo.com', contrasena: CONTRASENA })
        .catch((error: unknown) => error);

      assert.ok(errorContrasena instanceof ErrorNoAutenticado);
      assert.ok(errorCorreo instanceof ErrorNoAutenticado);
      assert.equal(errorContrasena.message, errorCorreo.message);
    });

    it('rechaza tokens alterados o firmados con otro secreto', () => {
      const tokenAjeno = new EmisorTokensJwt('otro-secreto-distinto-al-de-la-plataforma', 60).emitir({
        usuarioId: 1,
        rol: 'administrador',
      });

      assert.throws(() => casosDeUso.verificarToken(tokenAjeno), ErrorNoAutenticado);
      assert.throws(() => casosDeUso.verificarToken('esto.no.es-un-token'), ErrorNoAutenticado);
    });
  });

  describe('Recuperación de contraseña', () => {
    it('no envía nada si el correo no está registrado, y tampoco lanza error', async () => {
      await casosDeUso.solicitarRecuperacionContrasena({ email: 'nadie@ejemplo.com' });
      assert.equal(enviadorCorreos.enviados.length, 0);
    });

    it('envía un enlace que permite cambiar la contraseña: la nueva funciona y la anterior ya no', async () => {
      await casosDeUso.registrarEstudiante({ email: 'ana@ejemplo.com', contrasena: CONTRASENA });
      await casosDeUso.solicitarRecuperacionContrasena({ email: 'ANA@ejemplo.com' });

      const [correo] = enviadorCorreos.enviados;
      assert.equal(correo?.para, 'ana@ejemplo.com');
      assert.ok(correo?.enlace.startsWith(`${URL_RESTABLECIMIENTO}?token=`));

      await casosDeUso.restablecerContrasena({ token: enviadorCorreos.tokenDelUltimoCorreo(), contrasenaNueva: 'clave-nueva-789' });

      await casosDeUso.iniciarSesion({ email: 'ana@ejemplo.com', contrasena: 'clave-nueva-789' });
      await assert.rejects(casosDeUso.iniciarSesion({ email: 'ana@ejemplo.com', contrasena: CONTRASENA }), ErrorNoAutenticado);
    });

    it('el enlace solo sirve una vez', async () => {
      await casosDeUso.registrarEstudiante({ email: 'ana@ejemplo.com', contrasena: CONTRASENA });
      await casosDeUso.solicitarRecuperacionContrasena({ email: 'ana@ejemplo.com' });
      const token = enviadorCorreos.tokenDelUltimoCorreo();

      await casosDeUso.restablecerContrasena({ token, contrasenaNueva: 'clave-nueva-789' });
      await assert.rejects(casosDeUso.restablecerContrasena({ token, contrasenaNueva: 'otra-clave-000' }), ErrorValidacion);
    });

    it('el enlace vence a los 30 minutos', async () => {
      await casosDeUso.registrarEstudiante({ email: 'ana@ejemplo.com', contrasena: CONTRASENA });
      await casosDeUso.solicitarRecuperacionContrasena({ email: 'ana@ejemplo.com' });
      const token = enviadorCorreos.tokenDelUltimoCorreo();

      ahora = new Date(ahora.getTime() + 31 * 60_000);
      await assert.rejects(casosDeUso.restablecerContrasena({ token, contrasenaNueva: 'clave-nueva-789' }), ErrorValidacion);
    });

    it('pedir un enlace nuevo invalida el anterior', async () => {
      await casosDeUso.registrarEstudiante({ email: 'ana@ejemplo.com', contrasena: CONTRASENA });
      await casosDeUso.solicitarRecuperacionContrasena({ email: 'ana@ejemplo.com' });
      const tokenViejo = enviadorCorreos.tokenDelUltimoCorreo();
      await casosDeUso.solicitarRecuperacionContrasena({ email: 'ana@ejemplo.com' });

      await assert.rejects(casosDeUso.restablecerContrasena({ token: tokenViejo, contrasenaNueva: 'clave-nueva-789' }), ErrorValidacion);
      await casosDeUso.restablecerContrasena({ token: enviadorCorreos.tokenDelUltimoCorreo(), contrasenaNueva: 'clave-nueva-789' });
    });

    it('rechaza un token inventado y valida la contraseña nueva', async () => {
      await assert.rejects(casosDeUso.restablecerContrasena({ token: 'inventado', contrasenaNueva: 'clave-nueva-789' }), ErrorValidacion);
      await assert.rejects(casosDeUso.restablecerContrasena({ token: 'inventado', contrasenaNueva: 'corta' }), (error: unknown) => {
        assert.ok(error instanceof ErrorValidacion);
        assert.equal(error.detalles[0]?.campo, 'contrasenaNueva');
        return true;
      });
    });
  });

  describe('Asignación de roles', () => {
    it('un Administrador puede asignar el rol de Creador de Contenido', async () => {
      const administrador = await registrarConRol('admin@ejemplo.com', 'administrador');
      const estudiante = await registrarConRol('ana@ejemplo.com', 'estudiante');

      const actualizado = await casosDeUso.asignarRol(
        { usuarioId: String(estudiante.id), rol: 'creador_contenido' },
        { usuarioId: administrador.id, rol: 'administrador' },
      );

      assert.equal(actualizado.rol, 'creador_contenido');
      const sesion = await casosDeUso.iniciarSesion({ email: 'ana@ejemplo.com', contrasena: CONTRASENA });
      assert.equal(casosDeUso.verificarToken(sesion.token).rol, 'creador_contenido');
    });

    it('solo un Administrador puede asignar roles', async () => {
      const creador = await registrarConRol('creador@ejemplo.com', 'creador_contenido');
      const estudiante = await registrarConRol('ana@ejemplo.com', 'estudiante');

      await assert.rejects(
        casosDeUso.asignarRol({ usuarioId: estudiante.id, rol: 'administrador' }, { usuarioId: creador.id, rol: 'creador_contenido' }),
        ErrorNoAutorizado,
      );
    });

    it('un Administrador no puede cambiar su propio rol', async () => {
      const administrador = await registrarConRol('admin@ejemplo.com', 'administrador');
      await assert.rejects(
        casosDeUso.asignarRol({ usuarioId: administrador.id, rol: 'estudiante' }, { usuarioId: administrador.id, rol: 'administrador' }),
        ErrorConflicto,
      );
    });

    it('valida el rol y que el usuario exista', async () => {
      const administrador = await registrarConRol('admin@ejemplo.com', 'administrador');
      const ejecutadoPor = { usuarioId: administrador.id, rol: 'administrador' as const };

      await assert.rejects(casosDeUso.asignarRol({ usuarioId: 999, rol: 'estudiante' }, ejecutadoPor), ErrorNoEncontrado);
      await assert.rejects(casosDeUso.asignarRol({ usuarioId: 999, rol: 'superusuario' }, ejecutadoPor), ErrorValidacion);
      await assert.rejects(casosDeUso.asignarRol({ usuarioId: 'abc', rol: 'estudiante' }, ejecutadoPor), ErrorValidacion);
    });

    it('desde la consola se puede crear el primer Administrador por correo', async () => {
      await registrarConRol('adrian@ejemplo.com', 'estudiante');

      const usuario = await casosDeUso.asignarRolDesdeConsola(' Adrian@Ejemplo.com ', 'administrador');
      assert.equal(usuario.rol, 'administrador');
      await assert.rejects(casosDeUso.asignarRolDesdeConsola('nadie@ejemplo.com', 'administrador'), ErrorNoEncontrado);
    });
  });
});
