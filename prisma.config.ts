import { config } from 'dotenv';
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

config({ path: path.join(import.meta.dirname, '.env.local') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
