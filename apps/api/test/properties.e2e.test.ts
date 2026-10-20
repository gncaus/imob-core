import type { PropertyDto, PropertySummaryDto } from '@imob/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestApp,
  createUser,
  loginAs,
  resetDatabase,
  type TestApp,
} from './support/test-app.js';

/** Apartamento completo, exceto pelas fotos (que vêm por upload). */
const apartment = {
  code: 'vv-101',
  title: 'Apartamento 3 quartos na Praia da Costa',
  description:
    'Apartamento amplo, nascente, a duas quadras da praia, com varanda gourmet e duas vagas.',
  purpose: 'SALE',
  propertyType: 'Residential / Apartment',
  salePriceCents: 85_000_000,
  condoFeeCents: 90_000,
  usableArea: 98,
  bedrooms: 3,
  suites: 1,
  bathrooms: 2,
  parkingSpots: 2,
  postalCode: '29101-010',
  state: 'ES',
  city: 'Vila Velha',
  neighborhood: 'Praia da Costa',
  street: 'Avenida Antônio Gil Veloso',
  streetNumber: '1200',
  publishToPortals: true,
};

describe('properties', () => {
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

  async function createProperty(overrides: Record<string, unknown> = {}): Promise<PropertyDto> {
    const response = await t
      .http()
      .post('/properties')
      .set('Cookie', agentCookie)
      .send({ ...apartment, ...overrides })
      .expect(201);
    return response.body as PropertyDto;
  }

  it('creates a property with normalized data and lists its pending items', async () => {
    const property = await createProperty();

    expect(property).toMatchObject({
      code: 'VV-101',
      postalCode: '29101010',
      salePriceCents: 85_000_000,
      displayAddress: 'ALL',
      publicationType: 'STANDARD',
      photos: [],
    });
    expect(property.readiness.ready).toBe(false);
    expect(property.readiness.issues.map((issue) => issue.code)).toEqual(['PHOTOS_MIN_COUNT']);
  });

  it('accepts an incomplete draft and reports every pending item', async () => {
    const response = await t
      .http()
      .post('/properties')
      .set('Cookie', agentCookie)
      .send({ code: 'VIX-9', title: 'Rascunho', purpose: 'RENT' })
      .expect(201);

    expect((response.body as PropertyDto).readiness.issues.length).toBeGreaterThan(5);
  });

  it('rejects a duplicate code (case-insensitive) with 409', async () => {
    await createProperty();

    await t
      .http()
      .post('/properties')
      .set('Cookie', agentCookie)
      .send({ ...apartment, code: 'VV-101' })
      .expect(409);
  });

  it('validates input', async () => {
    const response = await t
      .http()
      .post('/properties')
      .set('Cookie', agentCookie)
      .send({ ...apartment, salePriceCents: 1500.5, state: 'XX' })
      .expect(400);

    const paths = (response.body.error.issues as { path: string }[]).map((issue) => issue.path);
    expect(paths).toEqual(expect.arrayContaining(['salePriceCents', 'state']));
  });

  it('updates fields and recomputes readiness', async () => {
    const property = await createProperty();

    const response = await t
      .http()
      .patch(`/properties/${property.id}`)
      .set('Cookie', agentCookie)
      .send({ description: 'Curta demais', purpose: 'SALE_RENT' })
      .expect(200);

    expect((response.body as PropertyDto).readiness.issues.map((issue) => issue.code)).toEqual([
      'DESCRIPTION_LENGTH',
      'RENT_PRICE_MISSING',
      'PHOTOS_MIN_COUNT',
    ]);
  });

  it('lists summaries with search and readiness filters', async () => {
    await createProperty();
    await createProperty({
      code: 'VIX-202',
      title: 'Casa em Jardim Camburi',
      neighborhood: 'Jardim Camburi',
    });

    const all = await t.http().get('/properties').set('Cookie', agentCookie).expect(200);
    const search = await t
      .http()
      .get('/properties?search=camburi')
      .set('Cookie', agentCookie)
      .expect(200);
    const ready = await t
      .http()
      .get('/properties?ready=true')
      .set('Cookie', agentCookie)
      .expect(200);

    expect(all.body).toHaveLength(2);
    expect((search.body as PropertySummaryDto[]).map((summary) => summary.code)).toEqual([
      'VIX-202',
    ]);
    expect(ready.body).toEqual([]);
    expect((all.body as PropertySummaryDto[])[0]!.readiness).toEqual({
      ready: false,
      issueCount: 1,
    });
  });

  it('only lets admins delete properties', async () => {
    const property = await createProperty();

    await t.http().delete(`/properties/${property.id}`).set('Cookie', agentCookie).expect(403);
    await t.http().delete(`/properties/${property.id}`).set('Cookie', adminCookie).expect(204);
    await t.http().get(`/properties/${property.id}`).set('Cookie', adminCookie).expect(404);
  });
});
