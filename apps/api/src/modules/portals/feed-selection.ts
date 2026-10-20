import type { PortalReadinessIssue } from '@imob/shared';
import { checkPortalReadiness, type ReadinessProperty } from '../properties/portal-readiness.js';
import type { FeedListing } from './portal-feed-generator.js';

/** Imóvel como sai do banco, com as fotos já na ordem de exibição. */
export interface FeedCandidate extends ReadinessProperty {
  id: string;
  publishToPortals: boolean;
  publicationType: FeedListing['publicationType'];
  condoFeeCents: number | null;
  iptuCents: number | null;
  suites: number | null;
  parkingSpots: number | null;
  complement: string | null;
  latitude: number | null;
  longitude: number | null;
  photos: (ReadinessProperty['photos'][number] & { url: string; caption: string | null })[];
}

export interface ExcludedProperty {
  candidate: FeedCandidate;
  issues: PortalReadinessIssue[];
}

export interface FeedSelection {
  listings: FeedListing[];
  /** Ids dos imóveis incluídos, na mesma ordem de `listings`. */
  includedIds: string[];
  excluded: ExcludedProperty[];
}

const notPublished: PortalReadinessIssue = {
  code: 'NOT_PUBLISHED',
  field: 'publishToPortals',
  message: 'A publicação nos portais está desligada para este imóvel.',
};

const overLimit = (max: number): PortalReadinessIssue => ({
  code: 'FEED_LIMIT',
  field: null,
  message: `O feed atingiu o limite de ${max} anúncios por arquivo.`,
});

/**
 * Decide quem entra no feed: `publishToPortals = true` e nenhuma pendência. Os demais saem com
 * o motivo, para o painel mostrar. Ordena por código para o arquivo ser estável entre gerações.
 */
export function selectFeedListings(
  candidates: FeedCandidate[],
  maxListings: number,
): FeedSelection {
  const sorted = [...candidates].sort((a, b) => a.code.localeCompare(b.code));
  const selection: FeedSelection = { listings: [], includedIds: [], excluded: [] };

  for (const candidate of sorted) {
    if (!candidate.publishToPortals) {
      selection.excluded.push({ candidate, issues: [notPublished] });
      continue;
    }
    const { ready, issues } = checkPortalReadiness(candidate);
    if (!ready) {
      selection.excluded.push({ candidate, issues });
      continue;
    }
    if (selection.listings.length >= maxListings) {
      selection.excluded.push({ candidate, issues: [overLimit(maxListings)] });
      continue;
    }
    selection.listings.push(toFeedListing(candidate));
    selection.includedIds.push(candidate.id);
  }
  return selection;
}

/** Só é chamada depois da checagem de pendências, que garante os campos obrigatórios. */
function toFeedListing(candidate: FeedCandidate): FeedListing {
  const required = (value: string | null) => value ?? '';
  return {
    code: candidate.code,
    title: candidate.title.trim(),
    description: required(candidate.description).trim(),
    purpose: candidate.purpose,
    publicationType: candidate.publicationType,
    propertyType: required(candidate.propertyType),
    salePriceCents: candidate.salePriceCents === null ? null : Number(candidate.salePriceCents),
    rentPriceCents: candidate.rentPriceCents,
    condoFeeCents: candidate.condoFeeCents,
    iptuCents: candidate.iptuCents,
    usableArea: candidate.usableArea,
    totalArea: candidate.totalArea,
    bedrooms: candidate.bedrooms,
    suites: candidate.suites,
    bathrooms: candidate.bathrooms,
    parkingSpots: candidate.parkingSpots,
    postalCode: required(candidate.postalCode),
    state: required(candidate.state),
    city: required(candidate.city),
    neighborhood: required(candidate.neighborhood),
    street: candidate.street,
    streetNumber: candidate.streetNumber,
    complement: candidate.complement,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    displayAddress: candidate.displayAddress,
    photos: candidate.photos.map(({ url, isPrimary, caption }) => ({ url, isPrimary, caption })),
  };
}
