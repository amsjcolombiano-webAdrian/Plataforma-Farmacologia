import { Router } from 'express';
import { ErrorNoEncontrado } from '../compartido/errores/erroresAplicacion';
import { requerirSesion } from '../compartido/middlewares/autenticacion';
import { fachadaAutenticacion } from '../modulos/autenticacion/fachada';

/** Rutas delgadas: solo conectan HTTP con la fachada. La validación ocurre dentro del módulo. */
export const rutasAutenticacion = Router();

rutasAutenticacion.post('/registro', async (peticion, respuesta) => {
  const usuario = await fachadaAutenticacion.registrarEstudiante(peticion.body);
  respuesta.status(201).json({ usuario });
});

rutasAutenticacion.post('/inicio-sesion', async (peticion, respuesta) => {
  const sesion = await fachadaAutenticacion.iniciarSesion(peticion.body);
  respuesta.json(sesion);
});

rutasAutenticacion.get(
  '/yo',
  requerirSesion((token) => fachadaAutenticacion.verificarToken(token)),
  async (_peticion, respuesta) => {
    const { usuarioId } = respuesta.locals.sesion!;
    const usuario = await fachadaAutenticacion.obtenerUsuarioPorId(usuarioId);
    // El token puede seguir vigente aunque la cuenta se haya eliminado.
    if (usuario === null) throw new ErrorNoEncontrado('La cuenta ya no existe.');
    respuesta.json({ usuario });
  },
);
