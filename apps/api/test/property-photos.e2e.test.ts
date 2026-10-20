import { randomBytes } from 'node:crypto';
import type { PropertyDto, PropertyPhotoDto } from '@imob/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestApp,
  createUser,
  loginAs,
  resetDatabase,
  type TestApp,
} from './support/test-app.js';

/** Bytes com a assinatura de JPEG; o conteúdo aleatório garante hash (e URL) diferente. */
const fakeJpeg = (size = 2048) =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(size)]);

const apartment = {
  code: 'VV-101',
  title: 'Apartamento 3 quartos na Praia da Costa',
  description:
    'Apartamento amplo, nascente, a duas quadras da praia, com varanda gourmet e duas vagas.',
  purpose: 'SALE',
  propertyType: 'Residential / Apartment',
  salePriceCents: 85_000_000,
  usableArea: 98,
  bedrooms: 3,
  bathrooms: 2,
  postalCode: '29101010',
  state: 'ES',
  city: 'Vila Velha',
  neighborhood: 'Praia da Costa',
  street: 'Avenida Antônio Gil Veloso',
  streetNumber: '1200',
};

describe('property photos', () => {
  let t: TestApp;
  let cookie: string;
  let propertyId: string;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    await createUser(t.prisma, { email: 'corretor@imob.test', role: 'AGENT' });
    cookie = await loginAs(t, 'corretor@imob.test');
    const response = await t
      .http()
      .post('/properties')
      .set('Cookie', cookie)
      .send(apartment)
      .expect(201);
    propertyId = (response.body as PropertyDto).id;
  });

  async function upload(content = fakeJpeg(), filename = 'foto.jpg'): Promise<PropertyPhotoDto> {
    const response = await t
      .http()
      .post(`/properties/${propertyId}/photos`)
      .set('Cookie', cookie)
      .attach('file', content, filename)
      .expect(201);
    return response.body as PropertyPhotoDto;
  }

  const getProperty = async () =>
    (await t.http().get(`/properties/${propertyId}`).set('Cookie', cookie).expect(200))
      .body as PropertyDto;

  it('uploads to storage with a content-addressed, publicly readable URL', async () => {
    const content = fakeJpeg();

    const photo = await upload(content);

    expect(photo).toMatchObject({ position: 0, isPrimary: true, contentType: 'image/jpeg' });
    expect(photo.url).toMatch(new RegExp(`/properties/${propertyId}/[0-9a-f]{32}\\.jpg$`));
    const download = await fetch(photo.url);
    expect(download.status).toBe(200);
    expect(Buffer.from(await download.arrayBuffer()).equals(content)).toBe(true);
  });

  it('becomes ready for portals after five photos', async () => {
    for (let i = 0; i < 5; i++) await upload();

    const property = await getProperty();

    expect(property.photos.map((photo) => photo.position)).toEqual([0, 1, 2, 3, 4]);
    expect(property.photos.filter((photo) => photo.isPrimary)).toHaveLength(1);
    expect(property.readiness).toEqual({ ready: true, issues: [] });
  });

  it('rejects files that are not JPEG', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const response = await t
      .http()
      .post(`/properties/${propertyId}/photos`)
      .set('Cookie', cookie)
      .attach('file', png, 'foto.png')
      .expect(400);

    expect(response.body.error.issues[0].message).toMatch(/JPG/);
  });

  it('rejects photos over 7 MB with 413', async () => {
    const response = await t
      .http()
      .post(`/properties/${propertyId}/photos`)
      .set('Cookie', cookie)
      .attach('file', fakeJpeg(7 * 1024 * 1024), 'grande.jpg')
      .expect(413);

    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rejects the same image twice for a property', async () => {
    const content = fakeJpeg();
    await upload(content);

    await t
      .http()
      .post(`/properties/${propertyId}/photos`)
      .set('Cookie', cookie)
      .attach('file', content, 'foto.jpg')
      .expect(409);
  });

  it('marks another photo as primary, unmarking the previous one', async () => {
    const first = await upload();
    const second = await upload();

    await t
      .http()
      .patch(`/properties/${propertyId}/photos/${second.id}`)
      .set('Cookie', cookie)
      .send({ isPrimary: true, caption: 'Fachada' })
      .expect(200);

    const photos = (await getProperty()).photos;
    expect(photos.find((photo) => photo.id === first.id)?.isPrimary).toBe(false);
    expect(photos.find((photo) => photo.id === second.id)).toMatchObject({
      isPrimary: true,
      caption: 'Fachada',
    });
  });

  it('reorders photos and requires the full set', async () => {
    const [a, b, c] = [await upload(), await upload(), await upload()];

    const response = await t
      .http()
      .put(`/properties/${propertyId}/photos/order`)
      .set('Cookie', cookie)
      .send({ photoIds: [c.id, a.id, b.id] })
      .expect(200);
    await t
      .http()
      .put(`/properties/${propertyId}/photos/order`)
      .set('Cookie', cookie)
      .send({ photoIds: [c.id, a.id] })
      .expect(400);

    expect((response.body as PropertyPhotoDto[]).map((photo) => photo.id)).toEqual([
      c.id,
      a.id,
      b.id,
    ]);
  });

  it('deletes a photo from storage and promotes the next one to primary', async () => {
    const first = await upload();
    const second = await upload();

    await t
      .http()
      .delete(`/properties/${propertyId}/photos/${first.id}`)
      .set('Cookie', cookie)
      .expect(204);

    const photos = (await getProperty()).photos;
    expect(photos.map((photo) => photo.id)).toEqual([second.id]);
    expect(photos[0]!.isPrimary).toBe(true);
    expect((await fetch(first.url)).status).toBe(404);
  });

  it('returns 404 for a photo of another property', async () => {
    const photo = await upload();
    const other = await t
      .http()
      .post('/properties')
      .set('Cookie', cookie)
      .send({ ...apartment, code: 'VV-102' })
      .expect(201);

    await t
      .http()
      .delete(`/properties/${(other.body as PropertyDto).id}/photos/${photo.id}`)
      .set('Cookie', cookie)
      .expect(404);
  });
});
