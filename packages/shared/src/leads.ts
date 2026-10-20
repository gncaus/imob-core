import { z } from 'zod';
import {
  leadQueueSchema,
  type LeadQueue,
  type LeadSource,
  type LeadTransactionType,
} from './enums.js';

export const leadListQuerySchema = z.object({
  queue: leadQueueSchema.optional(),
});
export type LeadListQuery = z.output<typeof leadListQuerySchema>;

export const moveLeadSchema = z.object({ queue: leadQueueSchema });
export type MoveLeadData = z.output<typeof moveLeadSchema>;

export type LeadTemperature = 'LOW' | 'MEDIUM' | 'HIGH';
export type LeadStatus = 'RECEIVED' | 'ROUTED';

export interface LeadDto {
  id: string;
  source: LeadSource;
  /** leadOrigin do portal, ex.: "Grupo OLX" ou "MCMV_OLX". */
  origin: string | null;
  /** Canal do lead no portal, ex.: CLICK_WHATSAPP. */
  leadType: string | null;
  temperature: LeadTemperature | null;
  transactionType: LeadTransactionType | null;
  isSimilarListing: boolean;
  status: LeadStatus;
  queue: LeadQueue | null;
  routingReason: string | null;
  name: string | null;
  email: string | null;
  ddd: string | null;
  phone: string | null;
  message: string | null;
  whatsappLink: string | null;
  clientListingId: string | null;
  property: { id: string; code: string; title: string } | null;
  agent: { id: string; name: string } | null;
  createdAt: string;
  routedAt: string | null;
}
