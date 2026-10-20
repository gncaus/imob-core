import { describe, expect, it } from 'vitest';
import { createPropertySchema, updatePhotoSchema, updatePropertySchema } from './properties.js';

const minimal = { code: 'vv-101', title: 'Apartamento na Praia da Costa', purpose: 'SALE' };

describe('createPropertySchema', () => {
  it('accepts a draft with only the required fields and applies defaults', () => {
    expect(createPropertySchema.parse(minimal)).toEqual({
      code: 'VV-101',
      title: 'Apartamento na Praia da Costa',
      purpose: 'SALE',
      displayAddress: 'ALL',
      publicationType: 'STANDARD',
      publishToPortals: false,
    });
  });

  it('normalizes masked postal code, state and blank texts', () => {
    const data = createPropertySchema.parse({
      ...minimal,
      postalCode: '29101-010',
      state: ' es ',
      complement: '   ',
    });

    expect(data).toMatchObject({ postalCode: '29101010', state: 'ES', complement: null });
  });

  it.each([
    ['code with spaces', { code: 'VV 101' }],
    ['code longer than 50', { code: 'A'.repeat(51) }],
    ['title longer than 100', { title: 'a'.repeat(101) }],
    ['money as float', { salePriceCents: 1234.5 }],
    ['negative price', { rentPriceCents: -1 }],
    ['fractional area', { usableArea: 72.5 }],
    ['unknown property type', { propertyType: 'Residential / Castle' }],
    ['unknown state', { state: 'XX' }],
    ['short postal code', { postalCode: '2910' }],
  ])('rejects %s', (_label, override) => {
    expect(createPropertySchema.safeParse({ ...minimal, ...override }).success).toBe(false);
  });
});

describe('updatePropertySchema', () => {
  it('does not apply create defaults to a partial update', () => {
    expect(updatePropertySchema.parse({ title: 'Novo título do imóvel' })).toEqual({
      title: 'Novo título do imóvel',
    });
  });

  it('allows clearing an optional field', () => {
    expect(updatePropertySchema.parse({ salePriceCents: null })).toEqual({ salePriceCents: null });
  });
});

describe('updatePhotoSchema', () => {
  it('only accepts isPrimary=true', () => {
    expect(updatePhotoSchema.safeParse({ isPrimary: false }).success).toBe(false);
    expect(updatePhotoSchema.parse({ isPrimary: true })).toEqual({ isPrimary: true });
  });
});
