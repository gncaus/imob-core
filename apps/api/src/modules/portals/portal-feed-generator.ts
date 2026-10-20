import type { DisplayAddress, PropertyPurpose, PublicationType } from '@imob/shared';

/** Dados da imobiliária enviados em todo feed (vêm da configuração). */
export interface CompanyInfo {
  name: string;
  email: string;
  phone: string | null;
  website: string | null;
}

export interface FeedPhoto {
  url: string;
  isPrimary: boolean;
  caption: string | null;
}

/** Imóvel já validado como pronto para portais, com valores na forma do domínio. */
export interface FeedListing {
  code: string;
  title: string;
  description: string;
  purpose: PropertyPurpose;
  publicationType: PublicationType;
  propertyType: string;
  salePriceCents: number | null;
  rentPriceCents: number | null;
  condoFeeCents: number | null;
  /** IPTU anual. */
  iptuCents: number | null;
  usableArea: number | null;
  totalArea: number | null;
  bedrooms: number | null;
  suites: number | null;
  bathrooms: number | null;
  parkingSpots: number | null;
  postalCode: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string | null;
  streetNumber: string | null;
  complement: string | null;
  latitude: number | null;
  longitude: number | null;
  displayAddress: DisplayAddress;
  /** Na ordem de exibição. */
  photos: FeedPhoto[];
}

export interface FeedInput {
  generatedAt: Date;
  company: CompanyInfo;
  listings: FeedListing[];
}

/**
 * Gerador de feed de um portal. Cada formato (VRSync hoje; OpenNavent e Chaves na Mão depois)
 * é uma implementação nova, sem mexer nas existentes.
 */
export interface PortalFeedGenerator {
  /** Limite de anúncios por arquivo aceito pelo portal. */
  readonly maxListings: number;
  readonly contentType: string;
  generate(input: FeedInput): string;
}
