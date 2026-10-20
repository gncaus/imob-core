import { z } from 'zod';
import type { ValidationIssue } from '../../../common/errors/domain-errors.js';

/**
 * Payload do webhook de leads do Grupo OLX (ZAP, Viva Real, OLX).
 * Fonte: https://developers.grupozap.com/webhooks/integration_leads.html
 *
 * A documentação só garante `originLeadId` e, em leads de anúncio, `clientListingId`. Os demais
 * campos são lidos de forma tolerante: um valor inesperado vira `null` em vez de recusar o lead,
 * porque um 4xx faz o portal desistir após as retentativas e o lead se perderia. O payload bruto
 * é sempre guardado, então nada se perde na normalização.
 */

export const MCMV_ORIGIN = 'MCMV_OLX';

const optionalString = z
  .unknown()
  .optional()
  .transform((value) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null));

const payloadSchema = z.looseObject({
  leadOrigin: optionalString,
  timestamp: optionalString,
  originLeadId: z.string('originLeadId é obrigatório').trim().min(1, 'originLeadId é obrigatório'),
  originListingId: optionalString,
  clientListingId: optionalString,
  name: optionalString,
  email: optionalString,
  ddd: optionalString,
  phone: optionalString,
  phoneNumber: optionalString,
  message: optionalString,
  temperature: optionalString,
  transactionType: optionalString,
  extraData: z
    .looseObject({ leadCerto: z.unknown(), leadType: optionalString })
    .nullish()
    .catch(null),
});

export type LeadTemperature = 'LOW' | 'MEDIUM' | 'HIGH';
export type LeadTransactionType = 'RENT' | 'SELL';

/** Lead normalizado, pronto para persistir. */
export interface GrupoOlxLead {
  origin: string | null;
  originLeadId: string;
  originCreatedAt: Date | null;
  clientListingId: string | null;
  isMcmv: boolean;
  name: string | null;
  email: string | null;
  ddd: string | null;
  phone: string | null;
  message: string | null;
  temperature: LeadTemperature | null;
  transactionType: LeadTransactionType | null;
  leadType: string | null;
  isSimilarListing: boolean;
}

export type ParseResult =
  { success: true; lead: GrupoOlxLead } | { success: false; issues: ValidationIssue[] };

const TEMPERATURES: Record<string, LeadTemperature> = {
  baixa: 'LOW',
  media: 'MEDIUM',
  alta: 'HIGH',
};

/** "Média", "media" e "MÉDIA" viram MEDIUM. */
function parseTemperature(value: string | null): LeadTemperature | null {
  if (value === null) return null;
  const key = value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  return TEMPERATURES[key] ?? null;
}

function parseTransactionType(value: string | null): LeadTransactionType | null {
  const upper = value?.toUpperCase();
  return upper === 'RENT' || upper === 'SELL' ? upper : null;
}

function parseTimestamp(value: string | null): Date | null {
  if (value === null) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const digits = (value: string | null) => value?.replace(/\D/g, '') || null;

/** Usa `ddd` + `phone`; se faltarem, recorre ao `phoneNumber` (depreciado) com o DDD na frente. */
function parsePhone(
  ddd: string | null,
  phone: string | null,
  phoneNumber: string | null,
): { ddd: string | null; phone: string | null } {
  const dddDigits = digits(ddd);
  const phoneDigits = digits(phone);
  if (dddDigits || phoneDigits) return { ddd: dddDigits, phone: phoneDigits };

  const full = digits(phoneNumber)?.replace(/^55(?=\d{10,11}$)/, '') ?? null;
  if (full && full.length >= 10) return { ddd: full.slice(0, 2), phone: full.slice(2) };
  return { ddd: null, phone: full };
}

export function parseGrupoOlxPayload(body: unknown): ParseResult {
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.') || 'body',
        message: issue.message,
      })),
    };
  }
  const data = parsed.data;
  const isMcmv = data.leadOrigin === MCMV_ORIGIN;

  // Lead de anúncio sem clientListingId deve receber 4xx para o portal revisar e reenviar.
  // Lead MCMV não está ligado a um anúncio e não tem esse campo.
  if (!isMcmv && data.clientListingId === null) {
    return {
      success: false,
      issues: [
        { path: 'clientListingId', message: 'clientListingId é obrigatório em lead de anúncio' },
      ],
    };
  }

  return {
    success: true,
    lead: {
      origin: data.leadOrigin,
      originLeadId: data.originLeadId,
      originCreatedAt: parseTimestamp(data.timestamp),
      clientListingId: data.clientListingId,
      isMcmv,
      name: data.name,
      email: data.email?.toLowerCase() ?? null,
      ...parsePhone(data.ddd, data.phone, data.phoneNumber),
      message: data.message,
      temperature: parseTemperature(data.temperature),
      transactionType: parseTransactionType(data.transactionType),
      leadType: data.extraData?.leadType ?? null,
      isSimilarListing: data.extraData?.leadCerto === true,
    },
  };
}
