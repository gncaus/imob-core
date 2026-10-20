import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { hashPassword } from '../../src/common/auth/password.js';
import { PrismaService } from '../../src/common/prisma/prisma.service.js';
import type { UserRole } from '../../src/generated/prisma/client.js';

export interface TestApp {
  app: INestApplication<Server>;
  prisma: PrismaService;
  http: () => ReturnType<typeof request>;
}

/** Troca a implementação de um provider (ex.: um notifier espião). */
export interface ProviderOverride {
  provide: abstract new (...args: never[]) => unknown;
  useValue: unknown;
}

export async function createTestApp(overrides: ProviderOverride[] = []): Promise<TestApp> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  for (const { provide, useValue } of overrides) {
    builder = builder.overrideProvider(provide).useValue(useValue);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<INestApplication<Server>>({ logger: false });
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService), http: () => request(app.getHttpServer()) };
}

/** Apaga todos os dados de domínio, mantendo o schema. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE leads, property_photos, properties, agents, users RESTART IDENTITY CASCADE',
  );
}

export const TEST_PASSWORD = 'senha-de-teste';

export async function createUser(
  prisma: PrismaService,
  { email, role }: { email: string; role: UserRole },
): Promise<void> {
  await prisma.user.create({
    data: { name: `Usuário ${role}`, email, role, passwordHash: await hashPassword(TEST_PASSWORD) },
  });
}

/** Faz login e devolve o cabeçalho Cookie da sessão. */
export async function loginAs(testApp: TestApp, email: string): Promise<string> {
  const response = await testApp
    .http()
    .post('/auth/login')
    .send({ email, password: TEST_PASSWORD })
    .expect(200);
  const setCookie = response.headers['set-cookie'] as unknown as string[];
  return setCookie.map((cookie) => cookie.split(';')[0]).join('; ');
}
