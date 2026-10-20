import { z } from 'zod';
import { displayAddressSchema, propertyPurposeSchema } from './enums.js';
import {
  brazilianStateSchema,
  type BrazilianState,
  type PropertyType,
  propertyTypeSchema,
} from './property-types.js';

export const publicationTypeSchema = z.enum([
  'STANDARD',
  'PREMIUM',
  'SUPER_PREMIUM',
  'PREMIERE_1',
  'PREMIERE_2',
  'TRIPLE',
]);
export type PublicationType = z.infer<typeof publicationTypeSchema>;

/** Texto opcional: espaços nas pontas são removidos e string vazia vira `null`. */
function optionalText(max: number) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().max(max, `Máximo de ${max} caracteres`).nullable().optional(),
  );
}

/** Valor em centavos (inteiro, nunca float). */
const cents = z
  .number('Informe um valor em centavos')
  .int('Valores monetários devem estar em centavos (inteiro)')
  .nonnegative('O valor não pode ser negativo')
  .max(Number.MAX_SAFE_INTEGER)
  .nullable()
  .optional();

const count = z.number().int().min(0).max(999).nullable().optional();
const squareMetres = z
  .number()
  .int('Informe a área em m² inteiros')
  .positive()
  .nullable()
  .optional();

export const propertyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z0-9][A-Z0-9_-]{0,49}$/,
    'O código deve ter de 1 a 50 caracteres: letras, números, hífen ou sublinhado',
  );

const postalCodeSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.replace(/\D/g, '') || null : value),
  z
    .string()
    .regex(/^\d{8}$/, 'CEP deve ter 8 dígitos')
    .nullable()
    .optional(),
);

const propertyFields = {
  code: propertyCodeSchema,
  title: z.string().trim().min(1, 'Informe o título').max(100, 'Máximo de 100 caracteres'),
  description: optionalText(3000),
  purpose: propertyPurposeSchema,
  propertyType: propertyTypeSchema.nullable().optional(),

  salePriceCents: cents,
  rentPriceCents: cents,
  condoFeeCents: cents,
  /** IPTU anual. */
  iptuCents: cents,

  usableArea: squareMetres,
  totalArea: squareMetres,
  bedrooms: count,
  suites: count,
  bathrooms: count,
  parkingSpots: count,

  postalCode: postalCodeSchema,
  state: brazilianStateSchema.nullable().optional(),
  city: optionalText(120),
  neighborhood: optionalText(120),
  street: optionalText(200),
  streetNumber: optionalText(20),
  complement: optionalText(120),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  displayAddress: displayAddressSchema.default('ALL'),

  publicationType: publicationTypeSchema.default('STANDARD'),
  publishToPortals: z.boolean().default(false),
};

export const createPropertySchema = z.object(propertyFields);
export type CreatePropertyInput = z.input<typeof createPropertySchema>;
export type CreatePropertyData = z.output<typeof createPropertySchema>;

export const updatePropertySchema = z
  .object({
    ...propertyFields,
    displayAddress: displayAddressSchema,
    publicationType: publicationTypeSchema,
    publishToPortals: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Nenhum campo para atualizar');
export type UpdatePropertyInput = z.input<typeof updatePropertySchema>;
export type UpdatePropertyData = z.output<typeof updatePropertySchema>;

export const propertyListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  purpose: propertyPurposeSchema.optional(),
  /** `true`: só prontos para portais; `false`: só com pendências. */
  ready: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});
export type PropertyListQuery = z.output<typeof propertyListQuerySchema>;

export const updatePhotoSchema = z
  .object({
    caption: optionalText(200),
    /** Só aceita `true`: marcar uma foto como principal desmarca as outras. */
    isPrimary: z.literal(true),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Nenhum campo para atualizar');
export type UpdatePhotoData = z.output<typeof updatePhotoSchema>;

export const reorderPhotosSchema = z.object({
  photoIds: z.array(z.uuid()).min(1),
});
export type ReorderPhotosData = z.output<typeof reorderPhotosSchema>;

/** Uma pendência que impede o imóvel de ir para os portais. */
export interface PortalReadinessIssue {
  /** Identificador estável da regra, ex.: `PHOTOS_MIN_COUNT`. */
  code: string;
  /** Campo do formulário relacionado, quando houver. */
  field: string | null;
  /** Mensagem para o usuário. */
  message: string;
}

export interface PropertyPhotoDto {
  id: string;
  url: string;
  position: number;
  isPrimary: boolean;
  caption: string | null;
  contentType: string;
  sizeBytes: number;
}

export interface PropertyDto {
  id: string;
  code: string;
  title: string;
  description: string | null;
  purpose: z.infer<typeof propertyPurposeSchema>;
  propertyType: PropertyType | null;
  salePriceCents: number | null;
  rentPriceCents: number | null;
  condoFeeCents: number | null;
  iptuCents: number | null;
  usableArea: number | null;
  totalArea: number | null;
  bedrooms: number | null;
  suites: number | null;
  bathrooms: number | null;
  parkingSpots: number | null;
  postalCode: string | null;
  state: BrazilianState | null;
  city: string | null;
  neighborhood: string | null;
  street: string | null;
  streetNumber: string | null;
  complement: string | null;
  latitude: number | null;
  longitude: number | null;
  displayAddress: z.infer<typeof displayAddressSchema>;
  publicationType: PublicationType;
  publishToPortals: boolean;
  photos: PropertyPhotoDto[];
  readiness: { ready: boolean; issues: PortalReadinessIssue[] };
  createdAt: string;
  updatedAt: string;
}

export interface PropertySummaryDto {
  id: string;
  code: string;
  title: string;
  purpose: z.infer<typeof propertyPurposeSchema>;
  propertyType: PropertyType | null;
  salePriceCents: number | null;
  rentPriceCents: number | null;
  city: string | null;
  neighborhood: string | null;
  publishToPortals: boolean;
  primaryPhotoUrl: string | null;
  photoCount: number;
  readiness: { ready: boolean; issueCount: number };
  updatedAt: string;
}
