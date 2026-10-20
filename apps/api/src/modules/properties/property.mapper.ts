import type {
  BrazilianState,
  PropertyDto,
  PropertyPhotoDto,
  PropertySummaryDto,
  PropertyType,
} from '@imob/shared';
import type { PhotoStorage } from '../../common/storage/photo-storage.js';
import type { Property, PropertyPhoto } from '../../generated/prisma/client.js';
import { checkPortalReadiness } from './portal-readiness.js';

export type PropertyWithPhotos = Property & { photos: PropertyPhoto[] };

/** Ordem de exibição das fotos; o Prisma devolve nesta ordem quando usamos `photosInOrder`. */
export const photosInOrder = { orderBy: { position: 'asc' } } as const;

export function toPhotoDto(photo: PropertyPhoto, storage: PhotoStorage): PropertyPhotoDto {
  return {
    id: photo.id,
    url: storage.publicUrl(photo.storageKey),
    position: photo.position,
    isPrimary: photo.isPrimary,
    caption: photo.caption,
    contentType: photo.contentType,
    sizeBytes: photo.sizeBytes,
  };
}

/** O tipo e a UF são validados na entrada (Zod); o banco guarda como texto. */
const asPropertyType = (value: string | null) => value as PropertyType | null;
const asState = (value: string | null) => value as BrazilianState | null;

export function toPropertyDto(property: PropertyWithPhotos, storage: PhotoStorage): PropertyDto {
  const { photos, salePriceCents, propertyType, state, createdAt, updatedAt, ...fields } = property;
  return {
    ...fields,
    propertyType: asPropertyType(propertyType),
    state: asState(state),
    salePriceCents: salePriceCents === null ? null : Number(salePriceCents),
    photos: photos.map((photo) => toPhotoDto(photo, storage)),
    readiness: checkPortalReadiness(property),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

export function toPropertySummaryDto(
  property: PropertyWithPhotos,
  storage: PhotoStorage,
): PropertySummaryDto {
  const readiness = checkPortalReadiness(property);
  const primary = property.photos.find((photo) => photo.isPrimary);
  return {
    id: property.id,
    code: property.code,
    title: property.title,
    purpose: property.purpose,
    propertyType: asPropertyType(property.propertyType),
    salePriceCents: property.salePriceCents === null ? null : Number(property.salePriceCents),
    rentPriceCents: property.rentPriceCents,
    city: property.city,
    neighborhood: property.neighborhood,
    publishToPortals: property.publishToPortals,
    primaryPhotoUrl: primary ? storage.publicUrl(primary.storageKey) : null,
    photoCount: property.photos.length,
    readiness: { ready: readiness.ready, issueCount: readiness.issues.length },
    updatedAt: property.updatedAt.toISOString(),
  };
}
