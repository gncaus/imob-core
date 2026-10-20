import { z } from 'zod';
import { emailSchema, passwordSchema } from './auth.js';
import { agentQueueSchema } from './enums.js';
import { brazilianPhoneSchema } from './phone.js';

const nameSchema = z
  .string()
  .trim()
  .min(2, 'Informe o nome')
  .max(120, 'O nome deve ter no máximo 120 caracteres');

export const createAgentSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  queue: agentQueueSchema,
  whatsapp: brazilianPhoneSchema,
  active: z.boolean().default(true),
});
export type CreateAgentInput = z.input<typeof createAgentSchema>;
export type CreateAgentData = z.output<typeof createAgentSchema>;

export const updateAgentSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    queue: agentQueueSchema,
    whatsapp: brazilianPhoneSchema,
    active: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Nenhum campo para atualizar');
export type UpdateAgentInput = z.input<typeof updateAgentSchema>;
export type UpdateAgentData = z.output<typeof updateAgentSchema>;

export const agentListQuerySchema = z.object({
  queue: agentQueueSchema.optional(),
  active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});
export type AgentListQuery = z.output<typeof agentListQuerySchema>;

export interface AgentDto {
  id: string;
  userId: string;
  name: string;
  email: string;
  queue: z.infer<typeof agentQueueSchema>;
  whatsapp: string;
  active: boolean;
  lastLeadAt: string | null;
  createdAt: string;
  updatedAt: string;
}
