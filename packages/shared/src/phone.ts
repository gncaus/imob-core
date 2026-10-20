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

/**
 * Link para abrir conversa no WhatsApp: https://wa.me/55<ddd><telefone>.
 * Devolve `null` quando não há DDD + número suficientes para um telefone brasileiro.
 */
export function whatsappLink(ddd: string | null, phone: string | null): string | null {
  const digits = `${ddd ?? ''}${phone ?? ''}`.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 11) return null;
  return `https://wa.me/55${digits}`;
}
