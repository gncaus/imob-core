import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { testEnv } from './test-env.js';

const apiRoot = resolve(__dirname, '../..');
const prismaCli = resolve(apiRoot, 'node_modules/prisma/build/index.js');

/** Cria o banco de teste se não existir e aplica as migrações. */
export default async function globalSetup(): Promise<void> {
  const env = testEnv();
  const testUrl = new URL(env.DATABASE_URL!);
  const databaseName = testUrl.pathname.slice(1);

  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';
  adminUrl.search = '';
  const client = new Client({ connectionString: adminUrl.toString() });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Não foi possível conectar ao Postgres de teste (${adminUrl.host}). Rode "docker compose up -d".`,
      { cause: error },
    );
  }
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      databaseName,
    ]);
    if (!rowCount) await client.query(`CREATE DATABASE "${databaseName.replace(/"/g, '""')}"`);
  } finally {
    await client.end();
  }

  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: apiRoot,
    env: { ...process.env, ...env },
    stdio: 'pipe',
  });
}
