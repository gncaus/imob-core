import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export type AppConfig = Readonly<z.infer<typeof envSchema>>;

/** Token de injeção da configuração validada. */
export const APP_CONFIG = Symbol('APP_CONFIG');

export class InvalidConfigError extends Error {
  constructor(issues: string[]) {
    super(`Configuração inválida:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'InvalidConfigError';
  }
}

export function parseConfig(env: NodeJS.ProcessEnv): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new InvalidConfigError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return Object.freeze(result.data);
}

/**
 * Carrega o .env da raiz do monorepo, se existir. Variáveis já definidas no ambiente
 * (Docker, CI) têm precedência sobre o arquivo.
 */
export function loadRootEnvFile(): void {
  const rootEnvFile = resolve(__dirname, '../../../../../.env');
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
}
