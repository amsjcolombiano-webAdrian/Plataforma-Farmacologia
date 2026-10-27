import bcrypt from 'bcrypt';
import type { CifradorContrasenas } from '../dominio/puertos';

/** Costo recomendado hoy para bcrypt: suficientemente lento para un atacante, rápido para un login. */
const RONDAS_SAL = 12;

export class CifradorContrasenasBcrypt implements CifradorContrasenas {
  cifrar(contrasenaPlana: string): Promise<string> {
    return bcrypt.hash(contrasenaPlana, RONDAS_SAL);
  }

  coincide(contrasenaPlana: string, contrasenaCifrada: string): Promise<boolean> {
    return bcrypt.compare(contrasenaPlana, contrasenaCifrada);
  }
}
