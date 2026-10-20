import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PropertyPurpose } from '@imob/shared';
import { hashPassword } from '../src/common/auth/password.js';
import type { AgentQueue, Lead } from '../src/generated/prisma/client.js';
import {
  type LeadAssignedNotification,
  LeadNotifier,
} from '../src/modules/leads/notifications/lead-notifier.js';
import { createTestApp, resetDatabase, type TestApp } from './support/test-app.js';
import { GRUPO_OLX_TEST_SECRET } from './support/test-env.js';

const authorization = `Basic ${Buffer.from(`grupozap:${GRUPO_OLX_TEST_SECRET}`).toString('base64')}`;

let sequence = 0;
const lead = (overrides: Record<string, unknown> = {}) => ({
  leadOrigin: 'Grupo OLX',
  timestamp: '2026-10-20T15:50:30.619Z',
  originLeadId: `lead-${++sequence}`,
  clientListingId: 'VV-RENT',
  name: 'Maria Oliveira',
  ddd: '27',
  phone: '999990000',
  temperature: 'Alta',
  extraData: { leadType: 'CLICK_WHATSAPP' },
  ...overrides,
});

describe('lead routing (webhook → BullMQ job → queue and agent)', () => {
  let t: TestApp;
  const notifications: LeadAssignedNotification[] = [];
  const notifier: LeadNotifier = {
    leadAssigned: vi.fn((notification: LeadAssignedNotification) => {
      notifications.push(notification);
      return Promise.resolve();
    }),
  };

  beforeAll(async () => {
    t = await createTestApp([{ provide: LeadNotifier, useValue: notifier }]);
  });

  afterAll(async () => {
    await t.app.close();
  });

  async function createAgent(name: string, queue: AgentQueue, active = true) {
    return t.prisma.agent.create({
      data: {
        queue,
        active,
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

  async function createProperty(code: string, purpose: PropertyPurpose) {
    await t.prisma.property.create({ data: { code, title: `Imóvel ${code}`, purpose } });
  }

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    notifications.length = 0;
    await createProperty('VV-RENT', 'RENT');
    await createProperty('VV-SALE', 'SALE');
    await createProperty('VV-BOTH', 'SALE_RENT');
  });

  async function deliver(payload: Record<string, unknown>): Promise<string> {
    const response = await t
      .http()
      .post('/webhooks/leads/grupo-olx')
      .set('Authorization', authorization)
      .send(payload)
      .expect(201);
    return response.body.id as string;
  }

  /** O roteamento roda no worker do BullMQ: espera o lead sair de RECEIVED. */
  async function routed(leadId: string): Promise<Lead> {
    let current: Lead | null = null;
    await vi.waitFor(
      async () => {
        current = await t.prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
        expect(current.status).toBe('ROUTED');
      },
      { timeout: 10_000, interval: 50 },
    );
    return current!;
  }

  it('routes RENT to Locação and assigns the agent who waited longest', async () => {
    const ana = await createAgent('Ana', 'RENTAL');
    await t.prisma.agent.update({ where: { id: ana.id }, data: { lastLeadAt: new Date() } });
    const bruno = await createAgent('Bruno', 'RENTAL');
    await createAgent('Carla', 'SALES');

    const result = await routed(await deliver(lead({ transactionType: 'RENT' })));

    expect(result).toMatchObject({
      queue: 'RENTAL',
      agentId: bruno.id,
      routingReason: 'transactionType=RENT do portal',
    });
    expect(result.routedAt).toBeInstanceOf(Date);
    const updated = await t.prisma.agent.findUniqueOrThrow({ where: { id: bruno.id } });
    expect(updated.lastLeadAt).toEqual(result.routedAt);
  });

  it('notifies the agent with the customer WhatsApp link', async () => {
    const carla = await createAgent('Carla', 'SALES');

    const leadId = await deliver(lead({ transactionType: 'SELL', clientListingId: 'VV-SALE' }));
    await routed(leadId);

    await vi.waitFor(() => expect(notifications).toHaveLength(1));
    expect(notifications[0]).toEqual({
      leadId,
      queue: 'SALES',
      agent: { id: carla.id, name: 'Carla', whatsapp: '27988887777' },
      propertyCode: 'VV-SALE',
      customerWhatsappLink: 'https://wa.me/5527999990000',
    });
  });

  it('uses the property purpose when the portal sends no transactionType', async () => {
    await createAgent('Carla', 'SALES');

    const result = await routed(await deliver(lead({ clientListingId: 'vv-sale' })));

    expect(result).toMatchObject({ queue: 'SALES', routingReason: 'Imóvel VV-SALE é de venda' });
  });

  it('sends a sale-and-rent property without transactionType to Triagem, with no agent', async () => {
    await createAgent('Ana', 'RENTAL');
    await createAgent('Carla', 'SALES');

    const result = await routed(await deliver(lead({ clientListingId: 'VV-BOTH' })));

    expect(result).toMatchObject({ queue: 'TRIAGE', agentId: null });
    expect(result.routingReason).toMatch(/venda e locação/);
    expect(notifications).toHaveLength(0);
  });

  it('routes an MCMV lead to Vendas', async () => {
    await createAgent('Carla', 'SALES');
    const mcmv = lead({
      leadOrigin: 'MCMV_OLX',
      clientListingId: undefined,
      transactionType: 'SELL',
    });

    const result = await routed(await deliver(mcmv));

    expect(result).toMatchObject({ queue: 'SALES', routingReason: expect.stringMatching(/MCMV/) });
  });

  it('leaves the lead in the queue without an owner when no agent is active', async () => {
    await createAgent('Ana', 'RENTAL', false);

    const result = await routed(await deliver(lead({ transactionType: 'RENT' })));

    expect(result).toMatchObject({ queue: 'RENTAL', agentId: null });
    expect(result.routingReason).toMatch(/Sem corretor ativo/);
  });

  it('spreads simultaneous leads evenly across the queue', async () => {
    const agents = await Promise.all(
      ['Ana', 'Bruno', 'Davi'].map((name) => createAgent(name, 'RENTAL')),
    );

    const ids = await Promise.all(
      Array.from({ length: 6 }, () => deliver(lead({ transactionType: 'RENT' }))),
    );
    const results = await Promise.all(ids.map(routed));

    const perAgent = agents.map((agent) => results.filter((r) => r.agentId === agent.id).length);
    expect(perAgent).toEqual([2, 2, 2]);
  });

  it('routes each lead only once, even if the job runs again', async () => {
    await createAgent('Ana', 'RENTAL');
    const leadId = await deliver(lead({ transactionType: 'RENT' }));
    const first = await routed(leadId);

    const { LeadRoutingService } = await import('../src/modules/leads/lead-routing.service.js');
    const outcome = await t.app.get(LeadRoutingService).route(leadId);

    expect(outcome).toEqual({ status: 'SKIPPED' });
    const after = await t.prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(after.routedAt).toEqual(first.routedAt);
  });
});
