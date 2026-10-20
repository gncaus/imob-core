import {
  type DisplayAddress,
  type PortalReadinessIssue,
  type PropertyPurpose,
  type PropertyType,
  propertyTypeSchema,
} from '@imob/shared';

/**
 * Regras de "pronto para portais" do Grupo OLX (feed VRSync).
 *
 * Fontes oficiais:
 * - https://developers.grupozap.com/feeds/vrsync/elements/listing.html (Title, Location, Media)
 * - https://developers.grupozap.com/feeds/vrsync/elements/details.html (PropertyType, preços,
 *   Description, áreas, quartos e banheiros)
 *
 * Função pura: usada pelo gerador do feed (só entra quem não tem pendências) e pelo painel
 * (lista o que falta). Regras que são decisão nossa, e não da documentação, estão marcadas.
 */

export const TITLE_MIN = 10;
export const TITLE_MAX = 100;
export const DESCRIPTION_MIN = 50;
export const DESCRIPTION_MAX = 3000;
export const PHOTOS_MIN = 5;
export const PHOTO_MAX_BYTES = 7 * 1024 * 1024;
export const PHOTO_CONTENT_TYPE = 'image/jpeg';

/** Tipos cuja área vai em LotArea; os demais usam LivingArea. */
const LOT_AREA_TYPES: ReadonlySet<PropertyType> = new Set([
  'Residential / Land Lot',
  'Commercial / Land Lot',
  'Commercial / Industrial',
  'Residential / Farm Ranch',
  'Residential / Agricultural',
]);

/** Kitnet fica de fora: o portal assume 0 quartos quando o valor não vem. */
const BEDROOMS_REQUIRED: ReadonlySet<PropertyType> = new Set([
  'Residential / Apartment',
  'Residential / Home',
  'Residential / Condo',
  'Residential / Village House',
  'Residential / Farm Ranch',
  'Residential / Penthouse',
  'Residential / Flat',
  'Residential / Studio',
  'Residential / Loft',
  'Residential / Sobrado',
  'Residential / Agricultural',
  'Commercial / Edificio Residencial',
]);

const BATHROOMS_REQUIRED: ReadonlySet<PropertyType> = new Set([
  'Residential / Apartment',
  'Residential / Home',
  'Residential / Condo',
  'Residential / Village House',
  'Residential / Farm Ranch',
  'Residential / Penthouse',
  'Residential / Flat',
  'Residential / Kitnet',
  'Residential / Loft',
  'Residential / Sobrado',
  'Residential / Agricultural',
  'Commercial / Consultorio',
  'Commercial / Edificio Residencial',
  'Commercial / Office',
]);

export interface ReadinessPhoto {
  contentType: string;
  sizeBytes: number;
  isPrimary: boolean;
}

/** Subconjunto do imóvel que as regras leem. O model do Prisma satisfaz este tipo. */
export interface ReadinessProperty {
  code: string;
  title: string;
  description: string | null;
  purpose: PropertyPurpose;
  propertyType: string | null;
  salePriceCents: bigint | number | null;
  rentPriceCents: number | null;
  usableArea: number | null;
  totalArea: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  postalCode: string | null;
  state: string | null;
  city: string | null;
  neighborhood: string | null;
  street: string | null;
  streetNumber: string | null;
  displayAddress: DisplayAddress;
  photos: readonly ReadinessPhoto[];
}

export interface PortalReadiness {
  ready: boolean;
  issues: PortalReadinessIssue[];
}

const HTML_TAG = /<\/?[a-z][^>]*>/i;

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === '';
}

/** O feed envia reais inteiros: menos de R$ 1,00 vira 0 e conta como sem preço. */
function hasPrice(cents: bigint | number | null): boolean {
  return cents !== null && Number(cents) >= 100;
}

export function checkPortalReadiness(property: ReadinessProperty): PortalReadiness {
  const issues: PortalReadinessIssue[] = [];
  const add = (code: string, field: string | null, message: string) =>
    issues.push({ code, field, message });

  if (!/^.{1,50}$/.test(property.code)) {
    add('CODE_LENGTH', 'code', 'O código deve ter de 1 a 50 caracteres.');
  }

  const title = property.title.trim();
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    add(
      'TITLE_LENGTH',
      'title',
      `O título deve ter entre ${TITLE_MIN} e ${TITLE_MAX} caracteres (hoje tem ${title.length}).`,
    );
  }
  if (HTML_TAG.test(title)) add('TITLE_HTML', 'title', 'O título não pode conter HTML.');

  const description = property.description?.trim() ?? '';
  if (description === '') {
    add('DESCRIPTION_MISSING', 'description', 'Informe a descrição do imóvel.');
  } else {
    if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
      add(
        'DESCRIPTION_LENGTH',
        'description',
        `A descrição deve ter entre ${DESCRIPTION_MIN} e ${DESCRIPTION_MAX} caracteres (hoje tem ${description.length}).`,
      );
    }
    if (HTML_TAG.test(description)) {
      add('DESCRIPTION_HTML', 'description', 'A descrição não pode conter HTML.');
    }
  }

  const propertyType = checkPropertyType(property.propertyType, add);

  const sells = property.purpose === 'SALE' || property.purpose === 'SALE_RENT';
  const rents = property.purpose === 'RENT' || property.purpose === 'SALE_RENT';
  if (sells && !hasPrice(property.salePriceCents)) {
    add('SALE_PRICE_MISSING', 'salePriceCents', 'Informe o preço de venda.');
  }
  if (rents && !hasPrice(property.rentPriceCents)) {
    add('RENT_PRICE_MISSING', 'rentPriceCents', 'Informe o valor do aluguel.');
  }

  checkLocation(property, add);
  if (propertyType) checkDetails(property, propertyType, add);
  checkPhotos(property.photos, add);

  return { ready: issues.length === 0, issues };
}

type AddIssue = (code: string, field: string | null, message: string) => void;

function checkPropertyType(value: string | null, add: AddIssue): PropertyType | null {
  if (value === null) {
    add('PROPERTY_TYPE_MISSING', 'propertyType', 'Informe o tipo do imóvel.');
    return null;
  }
  const parsed = propertyTypeSchema.safeParse(value);
  if (!parsed.success) {
    add('PROPERTY_TYPE_INVALID', 'propertyType', 'Tipo de imóvel não aceito pelos portais.');
    return null;
  }
  return parsed.data;
}

function checkLocation(property: ReadinessProperty, add: AddIssue): void {
  if (!/^\d{8}$/.test(property.postalCode ?? '')) {
    add('POSTAL_CODE_MISSING', 'postalCode', 'Informe o CEP (8 dígitos).');
  }
  if (isBlank(property.state)) add('STATE_MISSING', 'state', 'Informe o estado (UF).');
  if (isBlank(property.city)) add('CITY_MISSING', 'city', 'Informe a cidade.');
  if (isBlank(property.neighborhood)) {
    add('NEIGHBORHOOD_MISSING', 'neighborhood', 'Informe o bairro.');
  }

  // Regra nossa: a documentação manda sempre o endereço completo, mas só o bairro é obrigatório.
  // Se o anúncio vai exibir a rua (ou rua e número), o dado precisa existir.
  if (property.displayAddress !== 'NEIGHBORHOOD' && isBlank(property.street)) {
    add('STREET_MISSING', 'street', 'Informe a rua ou exiba só o bairro no anúncio.');
  }
  if (property.displayAddress === 'ALL' && isBlank(property.streetNumber)) {
    add(
      'STREET_NUMBER_MISSING',
      'streetNumber',
      'Informe o número ou exiba só a rua (sem número) no anúncio.',
    );
  }
}

function checkDetails(property: ReadinessProperty, type: PropertyType, add: AddIssue): void {
  if (LOT_AREA_TYPES.has(type)) {
    if (!property.totalArea) add('LOT_AREA_MISSING', 'totalArea', 'Informe a área total (m²).');
  } else if (!property.usableArea) {
    add('LIVING_AREA_MISSING', 'usableArea', 'Informe a área útil (m²).');
  }

  if (BEDROOMS_REQUIRED.has(type) && property.bedrooms === null) {
    add('BEDROOMS_MISSING', 'bedrooms', 'Informe a quantidade de quartos.');
  }
  if (BATHROOMS_REQUIRED.has(type) && property.bathrooms === null) {
    add('BATHROOMS_MISSING', 'bathrooms', 'Informe a quantidade de banheiros.');
  }
}

function checkPhotos(photos: readonly ReadinessPhoto[], add: AddIssue): void {
  const valid = photos.filter(
    (photo) => photo.contentType === PHOTO_CONTENT_TYPE && photo.sizeBytes <= PHOTO_MAX_BYTES,
  );

  if (photos.some((photo) => photo.contentType !== PHOTO_CONTENT_TYPE)) {
    add('PHOTOS_FORMAT', 'photos', 'Os portais só aceitam fotos em JPG. Substitua as demais.');
  }
  if (photos.some((photo) => photo.sizeBytes > PHOTO_MAX_BYTES)) {
    add('PHOTOS_SIZE', 'photos', 'Há fotos com mais de 7 MB. Substitua por versões menores.');
  }
  if (valid.length < PHOTOS_MIN) {
    add(
      'PHOTOS_MIN_COUNT',
      'photos',
      `São necessárias pelo menos ${PHOTOS_MIN} fotos válidas (hoje há ${valid.length}).`,
    );
  }

  const primaryCount = photos.filter((photo) => photo.isPrimary).length;
  if (photos.length > 0 && primaryCount !== 1) {
    add('PHOTOS_PRIMARY', 'photos', 'Marque exatamente uma foto como principal.');
  }
}
