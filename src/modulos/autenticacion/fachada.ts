/**
 * Fachada pública del módulo de Autenticación (ADR-0004, regla 3).
 * Es lo único que otros módulos y las rutas pueden importar de aquí:
 * expone casos de uso y DTOs, nunca el modelo interno ni la infraestructura.
 */
import { clientePrisma } from '../../compartido/config/baseDeDatos';
import { configuracion } from '../../compartido/config/configuracion';
import { emisorEventos } from '../../compartido/eventos/emisorEventos';
import { CasosDeUsoAutenticacion } from './aplicacion/casosDeUso';
import { CifradorContrasenasBcrypt } from './infraestructura/cifradorContrasenasBcrypt';
import { EmisorTokensJwt } from './infraestructura/emisorTokensJwt';
import { RepositorioUsuariosPrisma } from './infraestructura/repositorioUsuariosPrisma';

export type { SesionIniciada, UsuarioPublico } from './aplicacion/casosDeUso';
export type { DatosToken } from './dominio/puertos';
export { ROLES, type Rol } from './dominio/usuario';

export const fachadaAutenticacion = new CasosDeUsoAutenticacion({
  repositorioUsuarios: new RepositorioUsuariosPrisma(clientePrisma),
  cifradorContrasenas: new CifradorContrasenasBcrypt(),
  emisorTokens: new EmisorTokensJwt(
    configuracion.autenticacion.secretoJwt,
    configuracion.autenticacion.expiracionAccesoMinutos,
  ),
  emisorEventos,
});
