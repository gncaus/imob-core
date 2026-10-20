import {
  BRAZILIAN_STATES,
  type BrazilianState,
  type DisplayAddress,
  type PropertyPurpose,
} from '@imob/shared';
import type {
  FeedInput,
  FeedListing,
  FeedPhoto,
  PortalFeedGenerator,
} from '../portal-feed-generator.js';
import { cdata, el, renderXmlDocument, type XmlElement } from '../xml.js';

/**
 * Feed VRSync do Grupo OLX (ZAP, Viva Real, OLX).
 * Estrutura e ordem dos elementos seguem o exemplo oficial:
 * https://developers.grupozap.com/feeds/vrsync/examples.html
 */

const NAMESPACE = 'http://www.vivareal.com/schemas/1.0/VRSync';
const SCHEMA_LOCATION = `${NAMESPACE} http://xml.vivareal.com/vrsync.xsd`;
const PROVIDER = 'Imob Core';

const TRANSACTION_TYPES: Record<PropertyPurpose, string> = {
  SALE: 'For Sale',
  RENT: 'For Rent',
  SALE_RENT: 'Sale/Rent',
};

const DISPLAY_ADDRESS: Record<DisplayAddress, string> = {
  ALL: 'All',
  STREET: 'Street',
  NEIGHBORHOOD: 'Neighborhood',
};

/** O VRSync só aceita reais inteiros: as casas decimais são descartadas. */
function reais(cents: number | null): number | null {
  return cents === null ? null : Math.floor(cents / 100);
}

function formatPostalCode(digits: string): string {
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/** Data e hora local de São Paulo no formato do exemplo oficial: 2018-05-29T17:47:57. */
export function formatPublishDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
}

function media(photos: FeedPhoto[]): XmlElement | null {
  return el(
    'Media',
    photos.map((photo) =>
      el('Item', photo.url, {
        medium: 'image',
        caption: photo.caption ?? undefined,
        primary: photo.isPrimary ? 'true' : undefined,
      }),
    ),
  );
}

function details(listing: FeedListing): XmlElement | null {
  const sells = listing.purpose !== 'RENT';
  const rents = listing.purpose !== 'SALE';
  const brl = { currency: 'BRL' };
  const area = { unit: 'square metres' };
  return el('Details', [
    el('UsageType', listing.propertyType.startsWith('Commercial') ? 'Commercial' : 'Residential'),
    el('PropertyType', listing.propertyType),
    el('Description', cdata(listing.description)),
    sells ? el('ListPrice', reais(listing.salePriceCents), brl) : null,
    rents ? el('RentalPrice', reais(listing.rentPriceCents), { ...brl, period: 'Monthly' }) : null,
    el('LotArea', listing.totalArea, area),
    el('LivingArea', listing.usableArea, area),
    el('PropertyAdministrationFee', reais(listing.condoFeeCents), brl),
    el('Iptu', reais(listing.iptuCents), { ...brl, period: 'Yearly' }),
    el('Bedrooms', listing.bedrooms),
    el('Bathrooms', listing.bathrooms),
    el('Suites', listing.suites),
    el('Garage', listing.parkingSpots, { type: 'Parking Space' }),
  ]);
}

function location(listing: FeedListing): XmlElement | null {
  const stateName = BRAZILIAN_STATES[listing.state as BrazilianState] ?? listing.state;
  const text = (value: string | null) => (value === null ? null : cdata(value));
  return el(
    'Location',
    [
      el('Country', 'Brasil', { abbreviation: 'BR' }),
      el('State', cdata(stateName), { abbreviation: listing.state }),
      el('City', cdata(listing.city)),
      el('Neighborhood', cdata(listing.neighborhood)),
      el('Address', text(listing.street)),
      el('StreetNumber', text(listing.streetNumber)),
      el('Complement', text(listing.complement)),
      el('PostalCode', formatPostalCode(listing.postalCode)),
      el('Latitude', listing.latitude),
      el('Longitude', listing.longitude),
    ],
    { displayAddress: DISPLAY_ADDRESS[listing.displayAddress] },
  );
}

function contactInfo(company: FeedInput['company']): XmlElement | null {
  return el('ContactInfo', [
    el('Name', cdata(company.name)),
    el('Email', company.email),
    el('Website', company.website),
    el('Telephone', company.phone),
  ]);
}

function listingElement(listing: FeedListing, company: FeedInput['company']): XmlElement | null {
  return el('Listing', [
    el('ListingID', listing.code),
    el('Title', cdata(listing.title)),
    el('TransactionType', TRANSACTION_TYPES[listing.purpose]),
    el('PublicationType', listing.publicationType),
    media(listing.photos),
    details(listing),
    location(listing),
    contactInfo(company),
  ]);
}

export class VrsyncFeedGenerator implements PortalFeedGenerator {
  readonly maxListings = 50_000;
  readonly contentType = 'application/xml; charset=utf-8';

  generate({ generatedAt, company, listings }: FeedInput): string {
    if (listings.length > this.maxListings) {
      throw new Error(`O VRSync aceita no máximo ${this.maxListings} anúncios por arquivo`);
    }
    const root = el(
      'ListingDataFeed',
      [
        el('Header', [
          el('Provider', PROVIDER),
          el('Email', company.email),
          el('ContactName', cdata(company.name)),
          el('PublishDate', formatPublishDate(generatedAt)),
          el('Telephone', company.phone),
        ]),
        el(
          'Listings',
          listings.map((listing) => listingElement(listing, company)),
        ),
      ],
      {
        xmlns: NAMESPACE,
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xsi:schemaLocation': SCHEMA_LOCATION,
      },
    )!;
    return renderXmlDocument(root);
  }
}
