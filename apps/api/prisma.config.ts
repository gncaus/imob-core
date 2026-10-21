import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

// Os comandos do Prisma rodam a partir de apps/api; o .env fica na raiz do monorepo.
// Variáveis já definidas no ambiente têm precedência.
const rootEnvFile = resolve(process.cwd(), '../../.env');
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

// O `prisma generate` (rodado no `pnpm install`) não precisa de banco: sem DATABASE_URL a
// configuração fica sem datasource, e só os comandos que acessam o banco acusam a falta.
const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
