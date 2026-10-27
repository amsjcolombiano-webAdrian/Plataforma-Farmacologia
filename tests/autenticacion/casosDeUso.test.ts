import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { ErrorConflicto, ErrorNoAutenticado, ErrorValidacion } from '../../src/compartido/errores/erroresAplicacion';
import { EmisorEventos } from '../../src/compartido/eventos/emisorEventos';
import type { UsuarioRegistrado } from '../../src/compartido/tipos/eventosDelSistema';
import { CasosDeUsoAutenticacion } from '../../src/modulos/autenticacion/aplicacion/casosDeUso';
import type { RepositorioUsuarios } from '../../src/modulos/autenticacion/dominio/puertos';
import type { DatosNuevoUsuario, Usuario } from '../../src/modulos/autenticacion/dominio/usuario';
import { CifradorContrasenasBcrypt } from '../../src/modulos/autenticacion/infraestructura/cifradorContrasenasBcrypt';
import { EmisorTokensJwt } from '../../src/modulos/autenticacion/infraestructura/emisorTokensJwt';

/** Repositorio en memoria: reemplaza a Prisma gracias a la inyección de dependencias (ADR-0004). */
class RepositorioUsuariosEnMemoria implements RepositorioUsuarios {
  private readonly usuarios: Usuario[] = [];

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
}

const SECRETO_PRUEBAS = 'secreto-solo-para-pruebas-de-autenticacion';

describe('Casos de uso de Autenticación', () => {
  let casosDeUso: CasosDeUsoAutenticacion;
  let eventosRegistrados: UsuarioRegistrado[];

  beforeEach(() => {
    const emisorEventos = new EmisorEventos();
    eventosRegistrados = [];
    emisorEventos.suscribir('usuario.registrado', (carga) => {
      eventosRegistrados.push(carga);
    });
    casosDeUso = new CasosDeUsoAutenticacion({
      repositorioUsuarios: new RepositorioUsuariosEnMemoria(),
      cifradorContrasenas: new CifradorContrasenasBcrypt(),
      emisorTokens: new EmisorTokensJwt(SECRETO_PRUEBAS, 60),
      emisorEventos,
    });
  });

  it('registra un Estudiante con el correo normalizado, sin exponer la contraseña, y publica usuario.registrado', async () => {
    const usuario = await casosDeUso.registrarEstudiante({ email: '  Ana@Ejemplo.COM ', contrasena: 'clave-segura-123' });

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
    await casosDeUso.registrarEstudiante({ email: 'ana@ejemplo.com', contrasena: 'clave-segura-123' });
    await assert.rejects(
      casosDeUso.registrarEstudiante({ email: 'ANA@ejemplo.com', contrasena: 'otra-clave-456' }),
      ErrorConflicto,
    );
  });

  it('inicia sesión y el token emitido identifica al usuario y su rol', async () => {
    const registrado = await casosDeUso.registrarEstudiante({ email: 'ana@ejemplo.com', contrasena: 'clave-segura-123' });
    const sesion = await casosDeUso.iniciarSesion({ email: 'Ana@Ejemplo.com', contrasena: 'clave-segura-123' });

    assert.equal(sesion.usuario.id, registrado.id);
    assert.deepEqual(casosDeUso.verificarToken(sesion.token), { usuarioId: registrado.id, rol: 'estudiante' });
  });

  it('responde con el mismo error si la contraseña es incorrecta o si el correo no existe', async () => {
    await casosDeUso.registrarEstudiante({ email: 'ana@ejemplo.com', contrasena: 'clave-segura-123' });

    const errorContrasena = await casosDeUso
      .iniciarSesion({ email: 'ana@ejemplo.com', contrasena: 'incorrecta' })
      .catch((error: unknown) => error);
    const errorCorreo = await casosDeUso
      .iniciarSesion({ email: 'nadie@ejemplo.com', contrasena: 'clave-segura-123' })
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
