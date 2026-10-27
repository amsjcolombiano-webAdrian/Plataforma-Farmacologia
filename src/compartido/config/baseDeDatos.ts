import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../generado/prisma/client';
import { configuracion } from './configuracion';

/**
 * Cliente Prisma único para todo el monolito, con pool de conexiones a MySQL (ADR-0003, ADR-0007).
 * Cada módulo lo recibe por inyección en su repositorio y solo toca sus propias tablas (ADR-0004).
 */
const { servidor, puerto, usuario, contrasena, nombre, conexionesMaximas } = configuracion.baseDeDatos;

const adaptador = new PrismaMariaDb({
  host: servidor,
  port: puerto,
  user: usuario,
  password: contrasena,
  database: nombre,
  connectionLimit: conexionesMaximas,
});

export const clientePrisma = new PrismaClient({ adapter: adaptador });
