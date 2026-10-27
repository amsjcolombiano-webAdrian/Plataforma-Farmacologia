/**
 * Asigna un rol a una cuenta ya registrada, desde la consola del servidor.
 * Sirve sobre todo para crear el primer Administrador, que luego asigna roles desde la API.
 *
 * Uso: npm run asignar-rol -- <correo> <rol>
 * Ejemplo: npm run asignar-rol -- adrian@ejemplo.com administrador
 */
import { clientePrisma } from '../compartido/config/baseDeDatos';
import { ErrorAplicacion } from '../compartido/errores/erroresAplicacion';
import { ROLES, fachadaAutenticacion, type Rol } from '../modulos/autenticacion/fachada';

function esRol(valor: string): valor is Rol {
  return (ROLES as readonly string[]).includes(valor);
}

async function principal(): Promise<number> {
  const [email, rol] = process.argv.slice(2);
  if (email === undefined || rol === undefined || !esRol(rol)) {
    console.error(`Uso: npm run asignar-rol -- <correo> <rol>\nRoles válidos: ${ROLES.join(', ')}`);
    return 1;
  }

  try {
    const usuario = await fachadaAutenticacion.asignarRolDesdeConsola(email, rol);
    console.log(`Listo: ${usuario.email} ahora tiene el rol "${usuario.rol}". El cambio aplica desde su próximo inicio de sesión.`);
    return 0;
  } catch (error) {
    if (error instanceof ErrorAplicacion) {
      console.error(error.message);
      return 1;
    }
    throw error;
  } finally {
    await clientePrisma.$disconnect();
  }
}

principal().then((codigoSalida) => {
  process.exitCode = codigoSalida;
});
