import { describe, expect, it } from 'vitest';
import { InvalidConfigError, parseConfig } from './env.js';

const validEnv = {
  DATABASE_URL: 'postgresql://imob:imob@localhost:5432/imob',
  JWT_SECRET: 'a'.repeat(32),
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY: 'imob',
  S3_SECRET_KEY: 'imob-secret',
  S3_BUCKET: 'imob-photos',
  PHOTOS_PUBLIC_BASE_URL: 'http://localhost:9000/imob-photos',
  COMPANY_NAME: 'Imobiliária Teste',
  COMPANY_EMAIL: 'contato@imobiliaria.test',
  GRUPO_OLX_WEBHOOK_SECRET: 'segredo-do-webhook-de-teste',
  REDIS_URL: 'redis://localhost:6379',
};

describe('parseConfig', () => {
  it('applies defaults', () => {
    expect(parseConfig(validEnv)).toEqual({
      ...validEnv,
      NODE_ENV: 'development',
      API_PORT: 3333,
      LOG_LEVEL: 'info',
      SESSION_TTL_SECONDS: 28_800,
      LOGIN_RATE_LIMIT_PER_MINUTE: 10,
      S3_REGION: 'us-east-1',
      API_PUBLIC_URL: 'http://localhost:3333',
      FEED_CACHE_TTL_SECONDS: 300,
      QUEUE_PREFIX: 'imob',
    });
  });

  it('strips trailing slashes from the public photos url', () => {
    const config = parseConfig({ ...validEnv, PHOTOS_PUBLIC_BASE_URL: 'https://cdn.imob.com/' });

    expect(config.PHOTOS_PUBLIC_BASE_URL).toBe('https://cdn.imob.com');
  });

  it('coerces numbers and booleans from strings', () => {
    const config = parseConfig({ ...validEnv, API_PORT: '4000', COOKIE_SECURE: 'true' });

    expect(config.API_PORT).toBe(4000);
    expect(config.COOKIE_SECURE).toBe(true);
  });

  it('rejects a missing database url', () => {
    expect(() => parseConfig({ JWT_SECRET: validEnv.JWT_SECRET })).toThrow(InvalidConfigError);
  });

  it('rejects a non-postgres database url', () => {
    expect(() => parseConfig({ ...validEnv, DATABASE_URL: 'mysql://localhost/imob' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects a short jwt secret', () => {
    expect(() => parseConfig({ ...validEnv, JWT_SECRET: 'curto' })).toThrow(/JWT_SECRET/);
  });

  it('rejects the example jwt secret in production', () => {
    const env = {
      ...validEnv,
      NODE_ENV: 'production',
      JWT_SECRET: 'troque-este-segredo-por-um-valor-aleatorio-de-48-bytes',
    };

    expect(() => parseConfig(env)).toThrow(/JWT_SECRET/);
  });

  it('rejects the example webhook secret in production', () => {
    const env = {
      ...validEnv,
      NODE_ENV: 'production',
      GRUPO_OLX_WEBHOOK_SECRET: 'troque-esta-chave-do-webhook',
    };

    expect(() => parseConfig(env)).toThrow(/GRUPO_OLX_WEBHOOK_SECRET/);
  });
});
