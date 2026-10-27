import express from 'express';
import { configuracion } from './compartido/config/configuracion';
import { manejadorErrores, rutaNoEncontrada } from './compartido/middlewares/manejadorErrores';
import { rutasAutenticacion } from './rutas/rutasAutenticacion';

export function crearAplicacion(): express.Express {
  const aplicacion = express();

  aplicacion.disable('x-powered-by');
  aplicacion.use(express.json({ limit: '100kb' }));

  aplicacion.get('/api/salud', (_peticion, respuesta) => {
    respuesta.json({ estado: 'ok' });
  });
  aplicacion.use('/api/autenticacion', rutasAutenticacion);

  aplicacion.use(rutaNoEncontrada);
  aplicacion.use(manejadorErrores);

  return aplicacion;
}

if (require.main === module) {
  crearAplicacion().listen(configuracion.puerto, () => {
    console.log(`Servidor escuchando en http://localhost:${configuracion.puerto} (${configuracion.entorno})`);
  });
}
