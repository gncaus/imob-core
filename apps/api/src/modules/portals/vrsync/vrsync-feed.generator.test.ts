import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';
import type { FeedInput, FeedListing } from '../portal-feed-generator.js';
import { formatPublishDate, VrsyncFeedGenerator } from './vrsync-feed.generator.js';

const photos = (code: string) =>
  [1, 2, 3, 4, 5].map((n) => ({
    url: `https://fotos.imob.test/properties/${code}/foto-${n}.jpg`,
    isPrimary: n === 1,
    caption: n === 1 ? 'Fachada' : null,
  }));

const sale: FeedListing = {
  code: 'VV-101',
  title: 'Apartamento 3 quartos na Praia da Costa',
  description:
    'Apartamento amplo & nascente, a duas quadras da praia, com varanda gourmet e 2 vagas.',
  purpose: 'SALE',
  publicationType: 'STANDARD',
  propertyType: 'Residential / Apartment',
  salePriceCents: 85_000_099,
  rentPriceCents: 300_000,
  condoFeeCents: 90_000,
  iptuCents: 240_000,
  usableArea: 98,
  totalArea: null,
  bedrooms: 3,
  suites: 1,
  bathrooms: 2,
  parkingSpots: 2,
  postalCode: '29101010',
  state: 'ES',
  city: 'Vila Velha',
  neighborhood: 'Praia da Costa',
  street: 'Avenida Antônio Gil Veloso',
  streetNumber: '1200',
  complement: 'Apto 801',
  latitude: -20.3364,
  longitude: -40.2836,
  displayAddress: 'ALL',
  photos: photos('VV-101'),
};

const rent: FeedListing = {
  ...sale,
  code: 'VIX-202',
  title: 'Sala comercial na Enseada do Suá',
  description:
    'Sala comercial com vista para a baía, recepção, copa e banheiro privativo. Prédio com portaria.',
  purpose: 'RENT',
  publicationType: 'PREMIUM',
  propertyType: 'Commercial / Office',
  salePriceCents: null,
  rentPriceCents: 350_000,
  condoFeeCents: 0,
  iptuCents: null,
  usableArea: 45,
  bedrooms: null,
  suites: null,
  bathrooms: 1,
  parkingSpots: null,
  postalCode: '29050335',
  city: 'Vitória',
  neighborhood: 'Enseada do Suá',
  street: 'Rua Constante Sodré',
  streetNumber: null,
  complement: null,
  latitude: null,
  longitude: null,
  displayAddress: 'STREET',
  photos: photos('VIX-202'),
};

const saleRent: FeedListing = {
  ...sale,
  code: 'VV-303',
  title: 'Terreno de esquina em Itapuã',
  purpose: 'SALE_RENT',
  propertyType: 'Residential / Land Lot',
  salePriceCents: 42_000_000,
  rentPriceCents: 150_000,
  usableArea: null,
  totalArea: 360,
  bedrooms: null,
  suites: null,
  bathrooms: null,
  parkingSpots: null,
  neighborhood: 'Itapuã',
  displayAddress: 'NEIGHBORHOOD',
  photos: photos('VV-303'),
};

const input: FeedInput = {
  // 13:30 UTC = 10:30 em São Paulo.
  generatedAt: new Date('2026-10-20T13:30:00Z'),
  company: {
    name: 'Imobiliária Exemplo',
    email: 'contato@imobiliaria.test',
    phone: '(27) 3333-4444',
    website: 'https://imobiliaria.test',
  },
  listings: [sale, rent, saleRent],
};

const generator = new VrsyncFeedGenerator();
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  cdataPropName: false,
});

type Node = Record<string, unknown>;
const parse = (xml: string) => parser.parse(xml) as { ListingDataFeed: Node };
const listingsOf = (xml: string) =>
  (parse(xml).ListingDataFeed.Listings as { Listing: Node[] }).Listing;

describe('VrsyncFeedGenerator', () => {
  const xml = generator.generate(input);

  it('matches the reviewed snapshot (the file can be sent to the official validator)', async () => {
    await expect(xml).toMatchFileSnapshot('./__snapshots__/vrsync-feed.xml');
  });

  it('produces well-formed XML with the VRSync namespace', () => {
    expect(XMLValidator.validate(xml)).toBe(true);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(parse(xml).ListingDataFeed['@xmlns']).toBe('http://www.vivareal.com/schemas/1.0/VRSync');
  });

  it('maps purpose to TransactionType and sends only the matching prices', () => {
    const [saleNode, rentNode, saleRentNode] = listingsOf(xml) as {
      TransactionType: string;
      Details: Node;
    }[];

    expect(saleNode!.TransactionType).toBe('For Sale');
    expect(saleNode!.Details).toHaveProperty('ListPrice');
    expect(saleNode!.Details).not.toHaveProperty('RentalPrice');

    expect(rentNode!.TransactionType).toBe('For Rent');
    expect(rentNode!.Details).not.toHaveProperty('ListPrice');
    expect(rentNode!.Details.RentalPrice).toEqual({
      '#text': 3500,
      '@currency': 'BRL',
      '@period': 'Monthly',
    });

    expect(saleRentNode!.TransactionType).toBe('Sale/Rent');
    expect(saleRentNode!.Details).toHaveProperty('ListPrice');
    expect(saleRentNode!.Details).toHaveProperty('RentalPrice');
  });

  it('sends whole reais, dropping the cents', () => {
    expect(xml).toContain('<ListPrice currency="BRL">850000</ListPrice>');
  });

  it('keeps a zero condo fee, which the portal reads as exempt', () => {
    expect(xml).toContain(
      '<PropertyAdministrationFee currency="BRL">0</PropertyAdministrationFee>',
    );
  });

  it('uses LotArea for land and LivingArea otherwise', () => {
    const [saleNode, , landNode] = listingsOf(xml) as { Details: Node }[];

    expect(saleNode!.Details).toHaveProperty('LivingArea');
    expect(saleNode!.Details).not.toHaveProperty('LotArea');
    expect(landNode!.Details.LotArea).toEqual({ '#text': 360, '@unit': 'square metres' });
  });

  it('marks exactly one primary image and keeps the photo order', () => {
    const items = ((listingsOf(xml)[0]!.Media as Node).Item as Node[]).map((item) => ({
      url: item['#text'],
      primary: item['@primary'],
    }));

    expect(items.map((item) => item.url)).toEqual(photos('VV-101').map((photo) => photo.url));
    expect(items.filter((item) => item.primary === 'true')).toHaveLength(1);
  });

  it('writes the location with state abbreviation, formatted CEP and displayAddress', () => {
    const [, rentNode, landNode] = listingsOf(xml) as { Location: Node }[];

    expect(rentNode!.Location['@displayAddress']).toBe('Street');
    expect(rentNode!.Location.State).toEqual({ '#text': 'Espírito Santo', '@abbreviation': 'ES' });
    expect(rentNode!.Location.PostalCode).toBe('29050-335');
    expect(landNode!.Location['@displayAddress']).toBe('Neighborhood');
  });

  it('wraps accented texts in CDATA', () => {
    expect(xml).toContain('<City><![CDATA[Vitória]]></City>');
    expect(xml).toContain('<Neighborhood><![CDATA[Itapuã]]></Neighborhood>');
  });

  it('formats PublishDate in São Paulo local time', () => {
    expect(formatPublishDate(input.generatedAt)).toBe('2026-10-20T10:30:00');
  });

  it('generates an empty but valid feed', () => {
    const empty = generator.generate({ ...input, listings: [] });

    expect(XMLValidator.validate(empty)).toBe(true);
    expect(empty).toContain('<Listings/>');
  });

  it('refuses more listings than the portal accepts per file', () => {
    const many = Array.from({ length: generator.maxListings + 1 }, () => sale);

    expect(() => generator.generate({ ...input, listings: many })).toThrow(/50000/);
  });
});
