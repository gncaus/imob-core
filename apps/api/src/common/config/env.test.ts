import { describe, expect, it } from 'vitest';
import { InvalidConfigError, parseConfig } from './env.js';

const validEnv = { DATABASE_URL: 'postgresql://imob:imob@localhost:5432/imob' };

describe('parseConfig', () => {
  it('applies defaults', () => {
    expect(parseConfig(validEnv)).toEqual({
      NODE_ENV: 'development',
      API_PORT: 3333,
      LOG_LEVEL: 'info',
      DATABASE_URL: validEnv.DATABASE_URL,
    });
  });

  it('coerces the port from string', () => {
    expect(parseConfig({ ...validEnv, API_PORT: '4000' }).API_PORT).toBe(4000);
  });

  it('rejects a missing database url', () => {
    expect(() => parseConfig({})).toThrow(InvalidConfigError);
  });

  it('rejects a non-postgres database url', () => {
    expect(() => parseConfig({ DATABASE_URL: 'mysql://localhost/imob' })).toThrow(/DATABASE_URL/);
  });
});
