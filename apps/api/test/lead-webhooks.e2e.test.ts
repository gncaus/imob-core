import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDatabase, type TestApp } from './support/test-app.js';
import { GRUPO_OLX_TEST_SECRET } from './support/test-env.js';

const URL = '/webhooks/leads/grupo-olx';
const auth = (secret = GRUPO_OLX_TEST_SECRET) =>
  `Basic ${Buffer.from(`grupozap:${secret}`).toString('base64')}`;

const adLead = (overrides: Record<string, unknown> = {}) => ({
  leadOrigin: 'Grupo OLX',
  timestamp: '2026-10-20T15:50:30.619Z',
  originLeadId: 'lead-001',
  originListingId: '87027856',
  clientListingId: 'vv-101',
  name: 'Maria Oliveira',
  email: 'maria@example.com',
  ddd: '27',
  phone: '999990000',
  message: 'Olá, tenho interesse neste imóvel.',
  temperature: 'Alta',
  transactionType: 'RENT',
  extraData: { leadCerto: false, leadType: 'CLICK_WHATSAPP' },
  ...overrides,
});

describe('POST /webhooks/leads/grupo-olx', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
  });

  const send = (body: unknown, authorization = auth()) =>
    t
      .http()
      .post(URL)
      .set('Authorization', authorization)
      .send(body as object);

  it('persists the lead with the raw payload and links the property by code', async () => {
    const property = await t.prisma.property.create({
      data: { code: 'VV-101', title: 'Apartamento na Praia da Costa', purpose: 'RENT' },
    });
    const payload = adLead();

    const response = await send(payload).expect(201);

    const lead = await t.prisma.lead.findUniqueOrThrow({
      where: { id: response.body.id as string },
    });
    expect(lead).toMatchObject({
      source: 'GRUPO_OLX',
      origin: 'Grupo OLX',
      originLeadId: 'lead-001',
      clientListingId: 'vv-101',
      propertyId: property.id,
      ddd: '27',
      phone: '999990000',
      temperature: 'HIGH',
      transactionType: 'RENT',
      leadType: 'CLICK_WHATSAPP',
      isSimilarListing: false,
      originCreatedAt: new Date('2026-10-20T15:50:30.619Z'),
    });
    expect(lead.rawPayload).toEqual(payload);
  });

  it('accepts a lead whose listing is unknown, leaving the property empty', async () => {
    const response = await send(adLead({ clientListingId: 'NAO-EXISTE' })).expect(201);

    const lead = await t.prisma.lead.findUniqueOrThrow({
      where: { id: response.body.id as string },
    });
    expect(lead.propertyId).toBeNull();
  });

  it('is idempotent: a redelivered lead returns 200 with the same id and is not duplicated', async () => {
    const first = await send(adLead()).expect(201);

    const again = await send(adLead({ message: 'reenvio' })).expect(200);

    expect(again.body.id).toBe(first.body.id);
    expect(await t.prisma.lead.count()).toBe(1);
  });

  it('handles simultaneous deliveries of the same lead', async () => {
    const responses = await Promise.all([send(adLead()), send(adLead()), send(adLead())]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 200, 201]);
    expect(new Set(responses.map((response) => response.body.id as string)).size).toBe(1);
    expect(await t.prisma.lead.count()).toBe(1);
  });

  it('rejects an ad lead without clientListingId with 400 and stores nothing', async () => {
    const { clientListingId: _omit, ...withoutListing } = adLead();

    const response = await send(withoutListing).expect(400);

    expect(response.body.error.issues[0].path).toBe('clientListingId');
    expect(await t.prisma.lead.count()).toBe(0);
  });

  it('accepts an MCMV lead without listing ids', async () => {
    const mcmv = {
      leadOrigin: 'MCMV_OLX',
      timestamp: '2026-07-10T10:15:30.000Z',
      originLeadId: 'mcmv-1234567890',
      name: 'João da Silva',
      ddd: '27',
      phone: '987654321',
      temperature: 'Média',
      transactionType: 'SELL',
      extraData: { mcmv: { propertyValue: 250000 } },
    };

    const response = await send(mcmv).expect(201);

    const lead = await t.prisma.lead.findUniqueOrThrow({
      where: { id: response.body.id as string },
    });
    expect(lead).toMatchObject({
      origin: 'MCMV_OLX',
      clientListingId: null,
      temperature: 'MEDIUM',
    });
  });

  it('rejects malformed JSON with 400', async () => {
    await t
      .http()
      .post(URL)
      .set('Authorization', auth())
      .set('Content-Type', 'application/json')
      .send('{"originLeadId": ')
      .expect(400);
  });

  describe('authentication', () => {
    it('rejects a missing Authorization header with 401', async () => {
      await t.http().post(URL).send(adLead()).expect(401);
    });

    it('rejects a wrong secret with 401 and stores nothing', async () => {
      await send(adLead(), auth('chave-errada-chave-errada')).expect(401);

      expect(await t.prisma.lead.count()).toBe(0);
    });

    it('does not accept a panel session in place of the webhook secret', async () => {
      await t.http().post(URL).set('Cookie', 'imob_session=qualquer').send(adLead()).expect(401);
    });
  });
});
