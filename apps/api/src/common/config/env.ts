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

    /** URL pública da API, usada para mostrar o endereço do feed no painel. */
    API_PUBLIC_URL: z
      .url()
      .default('http://localhost:3333')
      .transform((url) => url.replace(/\/+$/, '')),
    /** Por quanto tempo o XML do feed fica em cache antes de ser gerado de novo. */
    FEED_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(300),

    /** Dados da imobiliária (ContactInfo do feed, obrigatório nos portais). */
    COMPANY_NAME: z.string().trim().min(1),
    COMPANY_EMAIL: z.email(),
    COMPANY_PHONE: z.string().trim().min(1).optional(),
    COMPANY_WEBSITE: z.url().optional(),

    /** Chave secreta do webhook de leads do Grupo OLX (vem no Basic Auth de cada requisição). */
    GRUPO_OLX_WEBHOOK_SECRET: z.string().min(16, 'use pelo menos 16 caracteres'),

    /** Redis usado pelas filas (BullMQ). */
    REDIS_URL: z.url({ protocol: /^rediss?$/ }),
    /** Prefixo das chaves das filas no Redis (separa ambientes que compartilham o Redis). */
    QUEUE_PREFIX: z.string().min(1).default('imob'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    // Segredos com o valor de exemplo do .env.example não sobem em produção.
    for (const key of ['JWT_SECRET', 'GRUPO_OLX_WEBHOOK_SECRET'] as const) {
      if (env[key].startsWith('troque-')) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'troque o valor de exemplo do .env.example antes de rodar em produção',
        });
      }
    }
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
