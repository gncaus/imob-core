import { describe, expect, it } from 'vitest';
import {
  checkPortalReadiness,
  PHOTO_MAX_BYTES,
  type ReadinessPhoto,
  type ReadinessProperty,
} from './portal-readiness.js';

const jpg = (overrides: Partial<ReadinessPhoto> = {}): ReadinessPhoto => ({
  contentType: 'image/jpeg',
  sizeBytes: 500_000,
  isPrimary: false,
  ...overrides,
});

const fivePhotos = (): ReadinessPhoto[] => [jpg({ isPrimary: true }), jpg(), jpg(), jpg(), jpg()];

/** Apartamento à venda com tudo que o portal exige. */
const ready = (overrides: Partial<ReadinessProperty> = {}): ReadinessProperty => ({
  code: 'VV-101',
  title: 'Apartamento 3 quartos na Praia da Costa',
  description:
    'Apartamento amplo, nascente, a duas quadras da praia, com varanda gourmet e duas vagas.',
  purpose: 'SALE',
  propertyType: 'Residential / Apartment',
  salePriceCents: 85_000_000n,
  rentPriceCents: null,
  usableArea: 98,
  totalArea: null,
  bedrooms: 3,
  bathrooms: 2,
  postalCode: '29101010',
  state: 'ES',
  city: 'Vila Velha',
  neighborhood: 'Praia da Costa',
  street: 'Avenida Antônio Gil Veloso',
  streetNumber: '1200',
  displayAddress: 'ALL',
  photos: fivePhotos(),
  ...overrides,
});

const codes = (property: ReadinessProperty) =>
  checkPortalReadiness(property).issues.map((issue) => issue.code);

describe('checkPortalReadiness', () => {
  it('accepts a complete property', () => {
    expect(checkPortalReadiness(ready())).toEqual({ ready: true, issues: [] });
  });

  it('lists every issue of an empty draft, each with a field and a message', () => {
    const result = checkPortalReadiness(
      ready({
        title: 'Apto',
        description: null,
        propertyType: null,
        salePriceCents: null,
        postalCode: null,
        state: null,
        city: null,
        neighborhood: null,
        street: null,
        streetNumber: null,
        photos: [],
      }),
    );

    expect(result.ready).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'TITLE_LENGTH',
      'DESCRIPTION_MISSING',
      'PROPERTY_TYPE_MISSING',
      'SALE_PRICE_MISSING',
      'POSTAL_CODE_MISSING',
      'STATE_MISSING',
      'CITY_MISSING',
      'NEIGHBORHOOD_MISSING',
      'STREET_MISSING',
      'STREET_NUMBER_MISSING',
      'PHOTOS_MIN_COUNT',
    ]);
    for (const issue of result.issues) {
      expect(issue.field).not.toBeNull();
      expect(issue.message.length).toBeGreaterThan(0);
    }
  });

  describe('title', () => {
    it.each([
      ['9 characters', 'a'.repeat(9), ['TITLE_LENGTH']],
      ['10 characters', 'a'.repeat(10), []],
      ['100 characters', 'a'.repeat(100), []],
      ['101 characters', 'a'.repeat(101), ['TITLE_LENGTH']],
      ['HTML', 'Apartamento <b>lindo</b> na praia', ['TITLE_HTML']],
    ])('%s', (_label, title, expected) => {
      expect(codes(ready({ title }))).toEqual(expected);
    });

    it('ignores surrounding spaces when measuring', () => {
      expect(codes(ready({ title: `   ${'a'.repeat(9)}   ` }))).toEqual(['TITLE_LENGTH']);
    });
  });

  describe('description', () => {
    it.each([
      ['blank', '   ', ['DESCRIPTION_MISSING']],
      ['49 characters', 'a'.repeat(49), ['DESCRIPTION_LENGTH']],
      ['50 characters', 'a'.repeat(50), []],
      ['3000 characters', 'a'.repeat(3000), []],
      ['3001 characters', 'a'.repeat(3001), ['DESCRIPTION_LENGTH']],
      ['HTML', `<p>${'a'.repeat(60)}</p>`, ['DESCRIPTION_HTML']],
    ])('%s', (_label, description, expected) => {
      expect(codes(ready({ description }))).toEqual(expected);
    });
  });

  it('rejects a property type outside the VRSync list', () => {
    expect(codes(ready({ propertyType: 'Residential / Castle' }))).toEqual([
      'PROPERTY_TYPE_INVALID',
    ]);
  });

  describe('prices by purpose', () => {
    it('SALE requires only the sale price', () => {
      expect(codes(ready({ purpose: 'SALE', rentPriceCents: null }))).toEqual([]);
      expect(codes(ready({ purpose: 'SALE', salePriceCents: null }))).toEqual([
        'SALE_PRICE_MISSING',
      ]);
    });

    it('RENT requires only the rent price', () => {
      expect(
        codes(ready({ purpose: 'RENT', salePriceCents: null, rentPriceCents: 250_000 })),
      ).toEqual([]);
      expect(codes(ready({ purpose: 'RENT', salePriceCents: 1n }))).toEqual(['RENT_PRICE_MISSING']);
    });

    it('SALE_RENT requires both prices', () => {
      expect(codes(ready({ purpose: 'SALE_RENT', rentPriceCents: 250_000 }))).toEqual([]);
      expect(codes(ready({ purpose: 'SALE_RENT', salePriceCents: null }))).toEqual([
        'SALE_PRICE_MISSING',
        'RENT_PRICE_MISSING',
      ]);
    });

    it('treats a price below R$ 1,00 as missing, since the feed sends whole reais', () => {
      expect(codes(ready({ salePriceCents: 99n }))).toEqual(['SALE_PRICE_MISSING']);
      expect(codes(ready({ salePriceCents: 100 }))).toEqual([]);
    });
  });

  describe('location', () => {
    it('requires an 8-digit postal code', () => {
      expect(codes(ready({ postalCode: '2910101' }))).toEqual(['POSTAL_CODE_MISSING']);
    });

    it('treats blank texts as missing', () => {
      expect(codes(ready({ city: '  ', neighborhood: '' }))).toEqual([
        'CITY_MISSING',
        'NEIGHBORHOOD_MISSING',
      ]);
    });

    it('displayAddress=ALL requires street and number', () => {
      expect(codes(ready({ street: null, streetNumber: null }))).toEqual([
        'STREET_MISSING',
        'STREET_NUMBER_MISSING',
      ]);
    });

    it('displayAddress=STREET requires the street but not the number', () => {
      expect(codes(ready({ displayAddress: 'STREET', streetNumber: null }))).toEqual([]);
      expect(codes(ready({ displayAddress: 'STREET', street: null }))).toEqual(['STREET_MISSING']);
    });

    it('displayAddress=NEIGHBORHOOD requires neither', () => {
      expect(
        codes(ready({ displayAddress: 'NEIGHBORHOOD', street: null, streetNumber: null })),
      ).toEqual([]);
    });
  });

  describe('details by property type', () => {
    it('residential types use the usable area (LivingArea)', () => {
      expect(codes(ready({ usableArea: null, totalArea: 300 }))).toEqual(['LIVING_AREA_MISSING']);
    });

    it.each([
      'Residential / Land Lot',
      'Commercial / Land Lot',
      'Commercial / Industrial',
    ] as const)('%s uses the total area (LotArea) and needs no rooms', (propertyType) => {
      const lot = ready({ propertyType, bedrooms: null, bathrooms: null, usableArea: null });

      expect(codes({ ...lot, totalArea: 360 })).toEqual([]);
      expect(codes({ ...lot, totalArea: null })).toEqual(['LOT_AREA_MISSING']);
    });

    it('requires bedrooms and bathrooms for an apartment', () => {
      expect(codes(ready({ bedrooms: null, bathrooms: null }))).toEqual([
        'BEDROOMS_MISSING',
        'BATHROOMS_MISSING',
      ]);
    });

    it('accepts zero bedrooms for a studio', () => {
      expect(codes(ready({ propertyType: 'Residential / Studio', bedrooms: 0 }))).toEqual([]);
    });

    it('does not require bedrooms for a kitnet (the portal assumes 0)', () => {
      expect(codes(ready({ propertyType: 'Residential / Kitnet', bedrooms: null }))).toEqual([]);
    });

    it('an office requires bathrooms but not bedrooms', () => {
      const office = ready({ propertyType: 'Commercial / Office', bedrooms: null });

      expect(codes(office)).toEqual([]);
      expect(codes({ ...office, bathrooms: null })).toEqual(['BATHROOMS_MISSING']);
    });

    it('skips type-dependent checks when the type is missing', () => {
      expect(codes(ready({ propertyType: null, usableArea: null, bedrooms: null }))).toEqual([
        'PROPERTY_TYPE_MISSING',
      ]);
    });
  });

  describe('photos', () => {
    it('requires at least 5 photos', () => {
      expect(codes(ready({ photos: fivePhotos().slice(0, 4) }))).toEqual(['PHOTOS_MIN_COUNT']);
    });

    it('does not count non-JPG photos towards the minimum', () => {
      const photos = [...fivePhotos().slice(0, 4), jpg({ contentType: 'image/png' })];

      expect(codes(ready({ photos }))).toEqual(['PHOTOS_FORMAT', 'PHOTOS_MIN_COUNT']);
    });

    it('accepts exactly 7 MB and rejects anything bigger', () => {
      const atLimit = [...fivePhotos().slice(0, 4), jpg({ sizeBytes: PHOTO_MAX_BYTES })];
      const tooBig = [...fivePhotos(), jpg({ sizeBytes: PHOTO_MAX_BYTES + 1 })];

      expect(codes(ready({ photos: atLimit }))).toEqual([]);
      expect(codes(ready({ photos: tooBig }))).toEqual(['PHOTOS_SIZE']);
    });

    it('requires exactly one primary photo', () => {
      const none = fivePhotos().map((photo) => ({ ...photo, isPrimary: false }));
      const two = [jpg({ isPrimary: true }), ...fivePhotos()];

      expect(codes(ready({ photos: none }))).toEqual(['PHOTOS_PRIMARY']);
      expect(codes(ready({ photos: two }))).toEqual(['PHOTOS_PRIMARY']);
    });
  });
});
