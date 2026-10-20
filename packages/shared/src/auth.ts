import { z } from 'zod';
import { userRoleSchema } from './enums.js';

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('E-mail inválido'));

export const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres')
  .max(128, 'A senha deve ter no máximo 128 caracteres');

export const loginSchema = z.object({
  email: emailSchema,
  // No login não se aplica a regra de tamanho: senha errada é só senha errada.
  password: z.string().min(1, 'Informe a senha').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const sessionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: userRoleSchema,
});
export type SessionUser = z.infer<typeof sessionUserSchema>;
