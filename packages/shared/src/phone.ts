import { z } from 'zod';

/**
 * Telefone brasileiro com DDD, sem o código do país: 10 dígitos (fixo) ou 11 (celular).
 * Aceita máscara na entrada ("(27) 99999-0000") e normaliza para apenas dígitos.
 */
export const brazilianPhoneSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .transform((digits) => (digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits))
  .pipe(z.string().regex(/^[1-9]{2}9?\d{8}$/, 'Telefone inválido: informe DDD + número'));
