import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3333),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    JWT_SECRET: z.string().min(32, 'use pelo menos 32 caracteres aleatórios'),
    SESSION_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(8 * 60 * 60),
    /** Por padrão o cookie de sessão só é `Secure` em produção. */
    COOKIE_SECURE: z.stringbool().optional(),
    /** Tentativas de login por IP a cada minuto. */
    LOGIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),

    /** Armazenamento de fotos compatível com S3 (MinIO no ambiente local). */
    S3_ENDPOINT: z.url(),
    S3_REGION: z.string().min(1).default('us-east-1'),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_KEY: z.string().min(1),
    S3_BUCKET: z.string().min(3),
    /** URL pública base das fotos (os portais baixam as imagens por ela), sem barra no final. */
    PHOTOS_PUBLIC_BASE_URL: z.url().transform((url) => url.replace(/\/+$/, '')),
  })
  .refine((env) => env.NODE_ENV !== 'production' || !env.JWT_SECRET.startsWith('troque-'), {
    path: ['JWT_SECRET'],
    message: 'troque o valor de exemplo do .env.example antes de rodar em produção',
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
