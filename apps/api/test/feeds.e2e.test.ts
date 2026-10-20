import type { FeedStatusDto } from '@imob/shared';
import { XMLValidator } from 'fast-xml-parser';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestApp,
  createUser,
  loginAs,
  resetDatabase,
  type TestApp,
} from './support/test-app.js';

const complete = {
  title: 'Apartamento 3 quartos na Praia da Costa',
  description:
    'Apartamento amplo, nascente, a duas quadras da praia, com varanda gourmet e duas vagas.',
  purpose: 'SALE' as const,
  propertyType: 'Residential / Apartment',
  salePriceCents: 85_000_000n,
  usableArea: 98,
  bedrooms: 3,
  bathrooms: 2,
  postalCode: '29101010',
  state: 'ES',
  city: 'Vila Velha',
  neighborhood: 'Praia da Costa',
  street: 'Avenida Antônio Gil Veloso',
  streetNumber: '1200',
  publishToPortals: true,
};

describe('feeds', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  /** Cria o imóvel com registros de foto direto no banco (o feed não lê o storage). */
  async function seedProperty(code: string, overrides: Record<string, unknown> = {}, photos = 5) {
    return t.prisma.property.create({
      data: {
        ...complete,
        code,
        ...overrides,
        photos: {
          create: Array.from({ length: photos }, (_, position) => ({
            storageKey: `properties/${code}/${position}.jpg`,
            contentType: 'image/jpeg',
            sizeBytes: 100_000,
            position,
            isPrimary: position === 0,
          })),
        },
      },
    });
  }

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    await seedProperty('VV-101');
    await seedProperty('VV-102', {}, 3);
    await seedProperty('VV-103', { publishToPortals: false });
  });

  describe('GET /feeds/vrsync.xml', () => {
    it('is public and only lists published properties without pending items', async () => {
      const response = await t.http().get('/feeds/vrsync.xml').expect(200);

      expect(response.headers['content-type']).toBe('application/xml; charset=utf-8');
      expect(XMLValidator.validate(response.text)).toBe(true);
      expect(response.text).toContain('<ListingID>VV-101</ListingID>');
      expect(response.text).not.toContain('VV-102');
      expect(response.text).not.toContain('VV-103');
      expect(response.text).toContain(
        '<Item medium="image" primary="true">http://localhost:9000/imob-photos-test/properties/VV-101/0.jpg</Item>',
      );
      expect(response.text).toContain('<Name><![CDATA[Imobiliária Teste]]></Name>');
    });

    it('answers 304 when the portal already has the current version', async () => {
      const first = await t.http().get('/feeds/vrsync.xml').expect(200);
      const etag = first.headers.etag as string;

      await t.http().get('/feeds/vrsync.xml').set('If-None-Match', etag).expect(304);
    });

    it('changes the ETag when a listing changes', async () => {
      const before = (await t.http().get('/feeds/vrsync.xml')).headers.etag as string;
      await t.prisma.property.update({
        where: { code: 'VV-101' },
        data: { salePriceCents: 80_000_000n },
      });

      const after = await t
        .http()
        .get('/feeds/vrsync.xml')
        .set('If-None-Match', before)
        .expect(200);

      expect(after.headers.etag).not.toBe(before);
      expect(after.text).toContain('<ListPrice currency="BRL">800000</ListPrice>');
    });
  });

  describe('GET /feeds/vrsync/status', () => {
    it('requires a session', async () => {
      await t.http().get('/feeds/vrsync/status').expect(401);
    });

    it('shows the feed url, what is included and why the rest was left out', async () => {
      await createUser(t.prisma, { email: 'admin@imob.test', role: 'ADMIN' });
      const cookie = await loginAs(t, 'admin@imob.test');

      const response = await t.http().get('/feeds/vrsync/status').set('Cookie', cookie).expect(200);
      const status = response.body as FeedStatusDto;

      expect(status.feedUrl).toBe('http://localhost:3333/feeds/vrsync.xml');
      expect(status.includedCount).toBe(1);
      expect(status.included.map((item) => item.code)).toEqual(['VV-101']);
      expect(
        status.excluded.map((item) => [item.code, item.issues.map((issue) => issue.code)]),
      ).toEqual([
        ['VV-102', ['PHOTOS_MIN_COUNT']],
        ['VV-103', ['NOT_PUBLISHED']],
      ]);
    });
  });
});
