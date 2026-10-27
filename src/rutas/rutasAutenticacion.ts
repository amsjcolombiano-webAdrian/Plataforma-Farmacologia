import { Router } from 'express';
import { ErrorNoEncontrado } from '../compartido/errores/erroresAplicacion';
import { requerirRol, requerirSesion } from '../compartido/middlewares/autenticacion';
import { fachadaAutenticacion, type DatosToken } from '../modulos/autenticacion/fachada';

/** Rutas delgadas: solo conectan HTTP con la fachada. La validación ocurre dentro del módulo. */
export const rutasAutenticacion = Router();

const conSesion = requerirSesion((token) => fachadaAutenticacion.verificarToken(token));

rutasAutenticacion.post('/registro', async (peticion, respuesta) => {
  const usuario = await fachadaAutenticacion.registrarEstudiante(peticion.body);
  respuesta.status(201).json({ usuario });
});

rutasAutenticacion.post('/inicio-sesion', async (peticion, respuesta) => {
  const sesion = await fachadaAutenticacion.iniciarSesion(peticion.body);
  respuesta.json(sesion);
});

rutasAutenticacion.get('/yo', conSesion, async (_peticion, respuesta) => {
  const { usuarioId } = respuesta.locals.sesion!;
  const usuario = await fachadaAutenticacion.obtenerUsuarioPorId(usuarioId);
  // El token puede seguir vigente aunque la cuenta se haya eliminado.
  if (usuario === null) throw new ErrorNoEncontrado('La cuenta ya no existe.');
  respuesta.json({ usuario });
});

rutasAutenticacion.post('/recuperacion/solicitar', async (peticion, respuesta) => {
  await fachadaAutenticacion.solicitarRecuperacionContrasena(peticion.body);
  // Misma respuesta exista o no la cuenta, para no revelar qué correos están registrados.
  respuesta.json({ mensaje: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.' });
});

rutasAutenticacion.post('/recuperacion/restablecer', async (peticion, respuesta) => {
  await fachadaAutenticacion.restablecerContrasena(peticion.body);
  respuesta.json({ mensaje: 'Tu contraseña se actualizó. Ya puedes iniciar sesión con la nueva.' });
});

rutasAutenticacion.patch('/usuarios/:usuarioId/rol', conSesion, requerirRol('administrador'), async (peticion, respuesta) => {
  const usuario = await fachadaAutenticacion.asignarRol(
    { usuarioId: peticion.params['usuarioId'], rol: peticion.body?.rol },
    respuesta.locals.sesion as DatosToken,
  );
  respuesta.json({ usuario });
});
