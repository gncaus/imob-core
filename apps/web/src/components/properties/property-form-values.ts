import {
  createPropertySchema,
  type CreatePropertyInput,
  type DisplayAddress,
  type PropertyDto,
  type PropertyPurpose,
  type PublicationType,
} from '@imob/shared';
import type { ApiIssue } from '@/lib/api';
import { centsToInput, inputToCents } from '@/lib/format';

/** Valores do formulário: tudo texto (como o usuário digita), convertido só no envio. */
export interface PropertyFormValues {
  code: string;
  title: string;
  description: string;
  purpose: PropertyPurpose;
  propertyType: string;
  salePrice: string;
  rentPrice: string;
  condoFee: string;
  iptu: string;
  usableArea: string;
  totalArea: string;
  bedrooms: string;
  suites: string;
  bathrooms: string;
  parkingSpots: string;
  postalCode: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  streetNumber: string;
  complement: string;
  latitude: string;
  longitude: string;
  displayAddress: DisplayAddress;
  publicationType: PublicationType;
  publishToPortals: boolean;
}

export type FormField = keyof PropertyFormValues;

const text = (value: string | null) => value ?? '';
const numberText = (value: number | null) => (value === null ? '' : String(value));

export function toFormValues(property?: PropertyDto): PropertyFormValues {
  return {
    code: text(property?.code ?? null),
    title: text(property?.title ?? null),
    description: text(property?.description ?? null),
    purpose: property?.purpose ?? 'SALE',
    propertyType: text(property?.propertyType ?? null),
    salePrice: centsToInput(property?.salePriceCents ?? null),
    rentPrice: centsToInput(property?.rentPriceCents ?? null),
    condoFee: centsToInput(property?.condoFeeCents ?? null),
    iptu: centsToInput(property?.iptuCents ?? null),
    usableArea: numberText(property?.usableArea ?? null),
    totalArea: numberText(property?.totalArea ?? null),
    bedrooms: numberText(property?.bedrooms ?? null),
    suites: numberText(property?.suites ?? null),
    bathrooms: numberText(property?.bathrooms ?? null),
    parkingSpots: numberText(property?.parkingSpots ?? null),
    postalCode: text(property?.postalCode ?? null),
    state: text(property?.state ?? null),
    city: text(property?.city ?? null),
    neighborhood: text(property?.neighborhood ?? null),
    street: text(property?.street ?? null),
    streetNumber: text(property?.streetNumber ?? null),
    complement: text(property?.complement ?? null),
    latitude: numberText(property?.latitude ?? null),
    longitude: numberText(property?.longitude ?? null),
    displayAddress: property?.displayAddress ?? 'ALL',
    publicationType: property?.publicationType ?? 'STANDARD',
    publishToPortals: property?.publishToPortals ?? false,
  };
}

/** Número digitado: vazio vira `null`; vírgula decimal é aceita. Inválido vira NaN (o schema acusa). */
function numberOrNull(value: string): number | null {
  const clean = value.trim().replace(',', '.');
  return clean === '' ? null : Number(clean);
}

/** Campo do payload da API → campo do formulário (onde mostrar o erro). */
const PAYLOAD_TO_FIELD: Record<string, FormField> = {
  salePriceCents: 'salePrice',
  rentPriceCents: 'rentPrice',
  condoFeeCents: 'condoFee',
  iptuCents: 'iptu',
};

export function toPayload(values: PropertyFormValues): CreatePropertyInput {
  return {
    code: values.code,
    title: values.title,
    description: values.description,
    purpose: values.purpose,
    propertyType: (values.propertyType || null) as CreatePropertyInput['propertyType'],
    salePriceCents: inputToCents(values.salePrice),
    rentPriceCents: inputToCents(values.rentPrice),
    condoFeeCents: inputToCents(values.condoFee),
    iptuCents: inputToCents(values.iptu),
    usableArea: numberOrNull(values.usableArea),
    totalArea: numberOrNull(values.totalArea),
    bedrooms: numberOrNull(values.bedrooms),
    suites: numberOrNull(values.suites),
    bathrooms: numberOrNull(values.bathrooms),
    parkingSpots: numberOrNull(values.parkingSpots),
    postalCode: values.postalCode,
    state: values.state || null,
    city: values.city,
    neighborhood: values.neighborhood,
    street: values.street,
    streetNumber: values.streetNumber,
    complement: values.complement,
    latitude: numberOrNull(values.latitude),
    longitude: numberOrNull(values.longitude),
    displayAddress: values.displayAddress,
    publicationType: values.publicationType,
    publishToPortals: values.publishToPortals,
  };
}

export interface FieldError {
  field: FormField;
  message: string;
}

/** Converte erros (do schema ou da API) em erros por campo do formulário. */
export function issuesToFieldErrors(issues: ApiIssue[]): FieldError[] {
  return issues.flatMap(({ path, message }) => {
    const key = path.split('.')[0] ?? '';
    const field = PAYLOAD_TO_FIELD[key] ?? key;
    return field in toFormValues() ? [{ field: field as FormField, message }] : [];
  });
}

/** Mesma validação da API (schema do @imob/shared), antes de enviar. */
export function validatePayload(payload: CreatePropertyInput): FieldError[] {
  const result = createPropertySchema.safeParse(payload);
  if (result.success) return [];
  return issuesToFieldErrors(
    result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.code === 'invalid_type' ? 'Valor inválido' : issue.message,
    })),
  );
}
