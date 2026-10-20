import { describe, expect, it } from 'vitest';
import { redisConnectionOptions } from './redis-connection.js';

describe('redisConnectionOptions', () => {
  it('parses a local url with defaults', () => {
    expect(redisConnectionOptions('redis://localhost')).toEqual({
      host: 'localhost',
      port: 6379,
      username: undefined,
      password: undefined,
      db: 0,
      tls: undefined,
      maxRetriesPerRequest: null,
    });
  });

  it('parses credentials, port, database and tls', () => {
    expect(redisConnectionOptions('rediss://user:p%40ss@cache.example.com:6380/2')).toMatchObject({
      host: 'cache.example.com',
      port: 6380,
      username: 'user',
      password: 'p@ss',
      db: 2,
      tls: {},
    });
  });
});
