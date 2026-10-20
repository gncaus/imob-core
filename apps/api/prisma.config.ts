import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, env } from 'prisma/config';

// Os comandos do Prisma rodam a partir de apps/api; o .env fica na raiz do monorepo.
// Variáveis já definidas no ambiente têm precedência.
const rootEnvFile = resolve(process.cwd(), '../../.env');
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
