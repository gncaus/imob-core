import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestApp,
  createUser,
  loginAs,
  resetDatabase,
  type TestApp,
} from './support/test-app.js';

const newAgent = {
  name: 'Ana Souza',
  email: 'ana@imob.test',
  password: 'senha-forte',
  queue: 'RENTAL',
  whatsapp: '(27) 99999-0000',
};

describe('agents', () => {
  let t: TestApp;
  let adminCookie: string;
  let agentCookie: string;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    await createUser(t.prisma, { email: 'admin@imob.test', role: 'ADMIN' });
    await createUser(t.prisma, { email: 'corretor@imob.test', role: 'AGENT' });
    adminCookie = await loginAs(t, 'admin@imob.test');
    agentCookie = await loginAs(t, 'corretor@imob.test');
  });

  async function createAgent(overrides: Partial<typeof newAgent> = {}) {
    const response = await t
      .http()
      .post('/agents')
      .set('Cookie', adminCookie)
      .send({ ...newAgent, ...overrides })
      .expect(201);
    return response.body as { id: string; userId: string };
  }

  describe('POST /agents', () => {
    it('creates the agent with a login user and normalized data', async () => {
      const response = await t
        .http()
        .post('/agents')
        .set('Cookie', adminCookie)
        .send(newAgent)
        .expect(201);

      expect(response.body).toEqual({
        id: expect.any(String),
        userId: expect.any(String),
        name: 'Ana Souza',
        email: 'ana@imob.test',
        queue: 'RENTAL',
        whatsapp: '27999990000',
        active: true,
        lastLeadAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(response.body).not.toHaveProperty('password');
      // O corretor criado consegue entrar no painel com a senha cadastrada.
      await t
        .http()
        .post('/auth/login')
        .send({ email: newAgent.email, password: newAgent.password })
        .expect(200);
    });

    it('rejects a duplicate e-mail with 409', async () => {
      await createAgent();

      const response = await t
        .http()
        .post('/agents')
        .set('Cookie', adminCookie)
        .send({ ...newAgent, email: 'ANA@imob.test' })
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('validates queue and whatsapp', async () => {
      const response = await t
        .http()
        .post('/agents')
        .set('Cookie', adminCookie)
        .send({ ...newAgent, queue: 'TRIAGE', whatsapp: '123' })
        .expect(400);

      const paths = (response.body.error.issues as { path: string }[]).map((issue) => issue.path);
      expect(paths).toEqual(expect.arrayContaining(['queue', 'whatsapp']));
    });

    it('is forbidden for agents', async () => {
      await t.http().post('/agents').set('Cookie', agentCookie).send(newAgent).expect(403);
    });

    it('requires a session', async () => {
      await t.http().post('/agents').send(newAgent).expect(401);
    });
  });

  describe('GET /agents', () => {
    it('lists agents and filters by queue and active flag', async () => {
      await createAgent();
      await createAgent({ name: 'Bruno Lima', email: 'bruno@imob.test', queue: 'SALES' });
      const inactive = await createAgent({ name: 'Carla Dias', email: 'carla@imob.test' });
      await t
        .http()
        .patch(`/agents/${inactive.id}`)
        .set('Cookie', adminCookie)
        .send({ active: false })
        .expect(200);

      const all = await t.http().get('/agents').set('Cookie', agentCookie).expect(200);
      const activeRental = await t
        .http()
        .get('/agents?queue=RENTAL&active=true')
        .set('Cookie', agentCookie)
        .expect(200);

      expect(all.body).toHaveLength(3);
      expect((activeRental.body as { name: string }[]).map((agent) => agent.name)).toEqual([
        'Ana Souza',
      ]);
    });
  });

  describe('GET /agents/:id', () => {
    it('returns 404 for an unknown id', async () => {
      await t
        .http()
        .get('/agents/0199a000-0000-7000-8000-000000000000')
        .set('Cookie', adminCookie)
        .expect(404);
    });

    it('returns 400 for a malformed id', async () => {
      await t.http().get('/agents/abc').set('Cookie', adminCookie).expect(400);
    });
  });

  describe('PATCH /agents/:id', () => {
    it('updates agent and user fields', async () => {
      const agent = await createAgent();

      const response = await t
        .http()
        .patch(`/agents/${agent.id}`)
        .set('Cookie', adminCookie)
        .send({ name: 'Ana S. Souza', queue: 'SALES', active: false })
        .expect(200);

      expect(response.body).toMatchObject({ name: 'Ana S. Souza', queue: 'SALES', active: false });
    });

    it('changes the password', async () => {
      const agent = await createAgent();

      await t
        .http()
        .patch(`/agents/${agent.id}`)
        .set('Cookie', adminCookie)
        .send({ password: 'nova-senha-forte' })
        .expect(200);

      await t
        .http()
        .post('/auth/login')
        .send({ email: newAgent.email, password: 'nova-senha-forte' })
        .expect(200);
    });

    it('rejects an e-mail already in use', async () => {
      const agent = await createAgent();

      await t
        .http()
        .patch(`/agents/${agent.id}`)
        .set('Cookie', adminCookie)
        .send({ email: 'admin@imob.test' })
        .expect(409);
    });

    it('returns 404 for an unknown id', async () => {
      await t
        .http()
        .patch('/agents/0199a000-0000-7000-8000-000000000000')
        .set('Cookie', adminCookie)
        .send({ active: false })
        .expect(404);
    });
  });

  describe('DELETE /agents/:id', () => {
    it('deletes the agent and its user', async () => {
      const agent = await createAgent();

      await t.http().delete(`/agents/${agent.id}`).set('Cookie', adminCookie).expect(204);

      await expect(t.prisma.user.findUnique({ where: { id: agent.userId } })).resolves.toBeNull();
    });

    it('refuses to delete an agent with leads', async () => {
      const agent = await createAgent();
      await t.prisma.lead.create({
        data: { source: 'MANUAL', agentId: agent.id, queue: 'RENTAL', rawPayload: {} },
      });

      const response = await t
        .http()
        .delete(`/agents/${agent.id}`)
        .set('Cookie', adminCookie)
        .expect(409);

      expect(response.body.error.message).toMatch(/Desative/);
    });
  });
});
