import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: env('DATABASE_URL'),
    // Base temporal que "prisma migrate dev" usa para validar migraciones. Opcional fuera de desarrollo.
    shadowDatabaseUrl: process.env['SHADOW_DATABASE_URL'],
  },
});
