import type { LeadDto } from '@imob/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../src/common/auth/password.js';
import type { AgentQueue, LeadQueue } from '../src/generated/prisma/client.js';
import {
  createTestApp,
  createUser,
  loginAs,
  resetDatabase,
  type TestApp,
} from './support/test-app.js';

describe('leads (panel)', () => {
  let t: TestApp;
  let cookie: string;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    await createUser(t.prisma, { email: 'admin@imob.test', role: 'ADMIN' });
    cookie = await loginAs(t, 'admin@imob.test');
  });

  async function createAgent(name: string, queue: AgentQueue) {
    return t.prisma.agent.create({
      data: {
        queue,
        whatsapp: '27988887777',
        user: {
          create: {
            name,
            email: `${name.toLowerCase()}@imob.test`,
            role: 'AGENT',
            passwordHash: await hashPassword('senha-de-teste'),
          },
        },
      },
    });
  }

  /** Lead já roteado, criado direto no banco (sem passar pelo worker). */
  async function routedLead(queue: LeadQueue, overrides: Record<string, unknown> = {}) {
    return t.prisma.lead.create({
      data: {
        source: 'GRUPO_OLX',
        origin: 'Grupo OLX',
        originLeadId: `lead-${Math.random()}`,
        name: 'Maria Oliveira',
        ddd: '27',
        phone: '999990000',
        leadType: 'CLICK_WHATSAPP',
        queue,
        status: 'ROUTED',
        routingReason: 'transactionType=RENT do portal',
        routedAt: new Date(),
        rawPayload: {},
        ...overrides,
      },
    });
  }

  it('lists leads by queue with property, agent, reason and WhatsApp link', async () => {
    const property = await t.prisma.property.create({
      data: { code: 'VV-101', title: 'Apartamento na Praia da Costa', purpose: 'RENT' },
    });
    const ana = await createAgent('Ana', 'RENTAL');
    await routedLead('RENTAL', { propertyId: property.id, agentId: ana.id });
    await routedLead('SALES');

    const response = await t.http().get('/leads?queue=RENTAL').set('Cookie', cookie).expect(200);
    const leads = response.body as LeadDto[];

    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      queue: 'RENTAL',
      origin: 'Grupo OLX',
      leadType: 'CLICK_WHATSAPP',
      routingReason: 'transactionType=RENT do portal',
      whatsappLink: 'https://wa.me/5527999990000',
      property: { id: property.id, code: 'VV-101', title: 'Apartamento na Praia da Costa' },
      agent: { id: ana.id, name: 'Ana' },
    });
    expect(leads[0]).not.toHaveProperty('rawPayload');
  });

  it('requires a session', async () => {
    await t.http().get('/leads').expect(401);
  });

  it('moves a triage lead to Vendas and assigns an agent by roulette', async () => {
    const carla = await createAgent('Carla', 'SALES');
    const lead = await routedLead('TRIAGE');

    const response = await t
      .http()
      .patch(`/leads/${lead.id}/queue`)
      .set('Cookie', cookie)
      .send({ queue: 'SALES' })
      .expect(200);

    expect(response.body).toMatchObject({
      queue: 'SALES',
      agent: { id: carla.id, name: 'Carla' },
      routingReason: 'Movido manualmente para Vendas por Usuário ADMIN',
    });
    const agent = await t.prisma.agent.findUniqueOrThrow({ where: { id: carla.id } });
    expect(agent.lastLeadAt).not.toBeNull();
  });

  it('moving to Triagem removes the owner', async () => {
    const ana = await createAgent('Ana', 'RENTAL');
    const lead = await routedLead('RENTAL', { agentId: ana.id });

    const response = await t
      .http()
      .patch(`/leads/${lead.id}/queue`)
      .set('Cookie', cookie)
      .send({ queue: 'TRIAGE' })
      .expect(200);

    expect(response.body).toMatchObject({ queue: 'TRIAGE', agent: null });
  });

  it('notes when the target queue has no active agent', async () => {
    const lead = await routedLead('TRIAGE');

    const response = await t
      .http()
      .patch(`/leads/${lead.id}/queue`)
      .set('Cookie', cookie)
      .send({ queue: 'RENTAL' })
      .expect(200);

    expect(response.body.agent).toBeNull();
    expect(response.body.routingReason).toMatch(/Sem corretor ativo/);
  });

  it('refuses to move a lead that is still being routed', async () => {
    const lead = await routedLead('TRIAGE', { status: 'RECEIVED', queue: null });

    await t
      .http()
      .patch(`/leads/${lead.id}/queue`)
      .set('Cookie', cookie)
      .send({ queue: 'SALES' })
      .expect(409);
  });

  it('validates the target queue and the id', async () => {
    const lead = await routedLead('TRIAGE');

    await t
      .http()
      .patch(`/leads/${lead.id}/queue`)
      .set('Cookie', cookie)
      .send({ queue: 'OUTRA' })
      .expect(400);
    await t
      .http()
      .patch('/leads/0199a000-0000-7000-8000-000000000000/queue')
      .set('Cookie', cookie)
      .send({ queue: 'SALES' })
      .expect(404);
  });
});
