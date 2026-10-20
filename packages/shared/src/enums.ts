import { z } from 'zod';

export const userRoleSchema = z.enum(['ADMIN', 'AGENT']);
export type UserRole = z.infer<typeof userRoleSchema>;

/** Fila de atendimento de um corretor. */
export const agentQueueSchema = z.enum(['RENTAL', 'SALES']);
export type AgentQueue = z.infer<typeof agentQueueSchema>;

/** Fila de um lead: as filas de corretor mais a triagem manual. */
export const leadQueueSchema = z.enum(['RENTAL', 'SALES', 'TRIAGE']);
export type LeadQueue = z.infer<typeof leadQueueSchema>;

/** Finalidade do imóvel. */
export const propertyPurposeSchema = z.enum(['SALE', 'RENT', 'SALE_RENT']);
export type PropertyPurpose = z.infer<typeof propertyPurposeSchema>;

/** Nível de detalhe do endereço exibido nos portais (atributo `displayAddress` do VRSync). */
export const displayAddressSchema = z.enum(['ALL', 'STREET', 'NEIGHBORHOOD']);
export type DisplayAddress = z.infer<typeof displayAddressSchema>;

export const leadSourceSchema = z.enum(['GRUPO_OLX', 'SITE', 'MANUAL']);
export type LeadSource = z.infer<typeof leadSourceSchema>;

/** Tipo de transação informado pelo portal no lead. */
export const leadTransactionTypeSchema = z.enum(['RENT', 'SELL']);
export type LeadTransactionType = z.infer<typeof leadTransactionTypeSchema>;
