import type {
  DisplayAddress,
  LeadQueue,
  LeadTemperature,
  PropertyPurpose,
  PublicationType,
} from '@imob/shared';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatCents(cents: number | null): string {
  return cents === null ? '—' : brl.format(cents / 100);
}

/** Datas vêm em UTC da API e são exibidas no horário de São Paulo. */
export function formatDateTime(iso: string | null): string {
  return iso ? dateTime.format(new Date(iso)) : '—';
}

/** Centavos para o texto do campo: 123456 → "1.234,56". */
export function centsToInput(cents: number | null): string {
  if (cents === null) return '';
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Texto em reais para centavos: "1.234,56", "1234,5" e "R$ 1.234" viram inteiros.
 * Vazio vira `null`; texto inválido vira `NaN` (o schema do shared aponta o erro).
 */
export function inputToCents(value: string): number | null {
  let clean = value.replace(/[R$\s]/g, '');
  // "1234.56" (ponto decimal, sem vírgula) também é aceito.
  if (!clean.includes(',') && /^\d+\.\d{1,2}$/.test(clean)) clean = clean.replace('.', ',');
  clean = clean.replace(/\./g, '');
  if (clean === '') return null;
  const parts = clean.split(',');
  const [reais = '', centavos = ''] = parts;
  if (parts.length > 2 || !/^\d+$/.test(reais) || !/^\d{0,2}$/.test(centavos)) return Number.NaN;
  return Number(reais) * 100 + Number(centavos.padEnd(2, '0'));
}

export const PURPOSE_LABEL: Record<PropertyPurpose, string> = {
  SALE: 'Venda',
  RENT: 'Locação',
  SALE_RENT: 'Venda e locação',
};

export const QUEUE_LABEL: Record<LeadQueue, string> = {
  RENTAL: 'Locação',
  SALES: 'Vendas',
  TRIAGE: 'Triagem',
};

export const TEMPERATURE_LABEL: Record<LeadTemperature, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
};

export const DISPLAY_ADDRESS_LABEL: Record<DisplayAddress, string> = {
  ALL: 'Endereço completo',
  STREET: 'Só a rua (sem número)',
  NEIGHBORHOOD: 'Só o bairro',
};

export const PUBLICATION_TYPE_LABEL: Record<PublicationType, string> = {
  STANDARD: 'Padrão',
  PREMIUM: 'Destaque',
  SUPER_PREMIUM: 'Super destaque',
  PREMIERE_1: 'Destaque exclusivo',
  PREMIERE_2: 'Destaque superior',
  TRIPLE: 'Destaque triplo',
};

/** Canais do Grupo OLX (extraData.leadType). */
const LEAD_TYPE_LABEL: Record<string, string> = {
  CLICK_SCHEDULE: 'Agendamento',
  CLICK_WHATSAPP: 'WhatsApp',
  CONTACT_CHAT: 'Chat',
  CONTACT_FORM: 'Formulário',
  PHONE_VIEW: 'Telefone',
  VISIT_REQUEST: 'Pedido de visita',
};

export function leadTypeLabel(leadType: string | null): string {
  if (!leadType) return 'Não informado';
  return LEAD_TYPE_LABEL[leadType] ?? leadType;
}

export function originLabel(origin: string | null): string {
  if (origin === 'MCMV_OLX') return 'Grupo OLX · MCMV';
  return origin ?? 'Origem desconhecida';
}
