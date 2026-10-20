import { describe, expect, it } from 'vitest';
import { InvalidConfigError, parseConfig } from './env.js';

const validEnv = {
  DATABASE_URL: 'postgresql://imob:imob@localhost:5432/imob',
  JWT_SECRET: 'a'.repeat(32),
};

describe('parseConfig', () => {
  it('applies defaults', () => {
    expect(parseConfig(validEnv)).toEqual({
      NODE_ENV: 'development',
      API_PORT: 3333,
      LOG_LEVEL: 'info',
      DATABASE_URL: validEnv.DATABASE_URL,
      JWT_SECRET: validEnv.JWT_SECRET,
      SESSION_TTL_SECONDS: 28_800,
      LOGIN_RATE_LIMIT_PER_MINUTE: 10,
    });
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
});
