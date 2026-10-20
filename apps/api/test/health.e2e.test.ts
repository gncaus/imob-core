import type { Server } from 'node:http';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { HealthModule } from '../src/modules/health/health.module.js';

async function createApp(queryRaw: () => Promise<unknown>): Promise<INestApplication<Server>> {
  const moduleRef = await Test.createTestingModule({ imports: [HealthModule] })
    .useMocker((token) => {
      if (token === PrismaService) return { $queryRaw: vi.fn(queryRaw) };
      return undefined;
    })
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<Server>>({ logger: false });
  await app.init();
  return app;
}

describe('GET /health', () => {
  let app: INestApplication<Server> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('returns 200 when the database answers', async () => {
    app = await createApp(() => Promise.resolve([{ '?column?': 1 }]));

    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', checks: { database: 'up' } });
  });

  it('returns 503 when the database is unreachable', async () => {
    app = await createApp(() => Promise.reject(new Error('connection refused')));

    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'error', checks: { database: 'down' } });
  });
});
