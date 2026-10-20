import { describe, expect, it } from 'vitest';
import { type FeedCandidate, selectFeedListings } from './feed-selection.js';

const candidate = (overrides: Partial<FeedCandidate> = {}): FeedCandidate => ({
  id: overrides.code ?? 'id',
  code: 'VV-101',
  title: '  Apartamento 3 quartos na Praia da Costa  ',
  description: 'Apartamento amplo, nascente, a duas quadras da praia, com varanda e duas vagas.',
  purpose: 'SALE',
  propertyType: 'Residential / Apartment',
  publicationType: 'STANDARD',
  publishToPortals: true,
  salePriceCents: 85_000_000n,
  rentPriceCents: null,
  condoFeeCents: null,
  iptuCents: null,
  usableArea: 98,
  totalArea: null,
  bedrooms: 3,
  suites: null,
  bathrooms: 2,
  parkingSpots: null,
  postalCode: '29101010',
  state: 'ES',
  city: 'Vila Velha',
  neighborhood: 'Praia da Costa',
  street: 'Avenida Antônio Gil Veloso',
  streetNumber: '1200',
  complement: null,
  latitude: null,
  longitude: null,
  displayAddress: 'ALL',
  photos: [1, 2, 3, 4, 5].map((n) => ({
    url: `https://fotos.test/${n}.jpg`,
    contentType: 'image/jpeg',
    sizeBytes: 1000,
    isPrimary: n === 1,
    caption: null,
  })),
  ...overrides,
});

describe('selectFeedListings', () => {
  it('includes published, complete properties sorted by code', () => {
    const selection = selectFeedListings(
      [candidate({ code: 'VV-200' }), candidate({ code: 'VV-100' })],
      10,
    );

    expect(selection.includedIds).toEqual(['VV-100', 'VV-200']);
    expect(selection.listings.map((listing) => listing.code)).toEqual(['VV-100', 'VV-200']);
    expect(selection.excluded).toEqual([]);
  });

  it('converts to feed values: trimmed title, numeric sale price, photo urls', () => {
    const [listing] = selectFeedListings([candidate()], 10).listings;

    expect(listing).toMatchObject({
      title: 'Apartamento 3 quartos na Praia da Costa',
      salePriceCents: 85_000_000,
    });
    expect(listing!.photos[0]).toEqual({
      url: 'https://fotos.test/1.jpg',
      isPrimary: true,
      caption: null,
    });
  });

  it('excludes unpublished properties with a NOT_PUBLISHED reason, even when complete', () => {
    const selection = selectFeedListings([candidate({ publishToPortals: false })], 10);

    expect(selection.listings).toEqual([]);
    expect(selection.excluded[0]!.issues.map((issue) => issue.code)).toEqual(['NOT_PUBLISHED']);
  });

  it('excludes published properties with pending items and lists them', () => {
    const selection = selectFeedListings([candidate({ photos: [], city: null })], 10);

    expect(selection.listings).toEqual([]);
    expect(selection.excluded[0]!.issues.map((issue) => issue.code)).toEqual([
      'CITY_MISSING',
      'PHOTOS_MIN_COUNT',
    ]);
  });

  it('stops at the per-file limit and reports the overflow', () => {
    const selection = selectFeedListings(
      [candidate({ code: 'A' }), candidate({ code: 'B' }), candidate({ code: 'C' })],
      2,
    );

    expect(selection.includedIds).toEqual(['A', 'B']);
    expect(selection.excluded.map((item) => [item.candidate.code, item.issues[0]!.code])).toEqual([
      ['C', 'FEED_LIMIT'],
    ]);
  });
});
