import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const rootEnvFile = resolve(__dirname, '../../../../.env');

/**
 * Variáveis de ambiente dos testes. O banco de teste é separado do de desenvolvimento:
 * TEST_DATABASE_URL ou, na falta dele, o DATABASE_URL com o banco trocado por `imob_test`.
 */
export function testEnv(): Record<string, string> {
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

  const databaseUrl = process.env.TEST_DATABASE_URL ?? deriveTestUrl(process.env.DATABASE_URL);
  return {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: databaseUrl,
    JWT_SECRET: 'test-secret-with-at-least-32-characters!',
    LOGIN_RATE_LIMIT_PER_MINUTE: '1000',
    // Bucket separado para os testes não misturarem fotos com o ambiente de desenvolvimento.
    S3_BUCKET: 'imob-photos-test',
    PHOTOS_PUBLIC_BASE_URL: `${process.env.S3_ENDPOINT ?? 'http://localhost:9000'}/imob-photos-test`,
  };
}

function deriveTestUrl(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    throw new Error('Defina TEST_DATABASE_URL ou DATABASE_URL no .env para rodar os testes e2e');
  }
  const url = new URL(databaseUrl);
  url.pathname = '/imob_test';
  return url.toString();
}
