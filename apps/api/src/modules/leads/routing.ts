import type { LeadQueue, LeadTransactionType, PropertyPurpose } from '@imob/shared';

/**
 * Roteamento de leads para a fila certa: Locação (RENTAL), Vendas (SALES) ou Triagem (TRIAGE).
 * Função pura; a regra é: na dúvida, Triagem. Nunca chutar.
 *
 * Ordem das regras:
 * 1. Lead MCMV (Minha Casa Minha Vida) → Vendas.
 * 2. Lead de imóvel semelhante (leadCerto) → segue o transactionType do portal; o imóvel citado
 *    não é o de interesse, então a finalidade dele não é considerada.
 * 3. transactionType RENT → Locação; SELL → Vendas. Se o imóvel encontrado tiver finalidade que
 *    contradiz o portal (ex.: RENT num imóvel só de venda), vai para Triagem.
 * 4. Sem transactionType → finalidade do imóvel: RENT → Locação; SALE → Vendas.
 * 5. Imóvel de venda e locação sem transactionType, ou imóvel não encontrado → Triagem.
 */

export interface RoutingInput {
  transactionType: LeadTransactionType | null;
  isMcmv: boolean;
  isSimilarListing: boolean;
  clientListingId: string | null;
  /** Imóvel encontrado pelo clientListingId, se houver. */
  property: { code: string; purpose: PropertyPurpose } | null;
}

export interface RoutingDecision {
  queue: LeadQueue;
  /** Motivo legível, exibido no card do lead. */
  reason: string;
}

const QUEUE_BY_TRANSACTION: Record<LeadTransactionType, LeadQueue> = {
  RENT: 'RENTAL',
  SELL: 'SALES',
};

/** Finalidades do imóvel compatíveis com cada transactionType do portal. */
const COMPATIBLE_PURPOSES: Record<LeadTransactionType, readonly PropertyPurpose[]> = {
  RENT: ['RENT', 'SALE_RENT'],
  SELL: ['SALE', 'SALE_RENT'],
};

const PURPOSE_LABEL: Record<PropertyPurpose, string> = {
  SALE: 'venda',
  RENT: 'locação',
  SALE_RENT: 'venda e locação',
};

export function routeLead(input: RoutingInput): RoutingDecision {
  const { transactionType, property } = input;

  if (input.isMcmv) {
    return { queue: 'SALES', reason: 'Lead MCMV (Minha Casa Minha Vida) do portal' };
  }

  if (input.isSimilarListing) {
    if (transactionType) {
      return {
        queue: QUEUE_BY_TRANSACTION[transactionType],
        reason: `transactionType=${transactionType} do portal (lead de imóvel semelhante)`,
      };
    }
    return {
      queue: 'TRIAGE',
      reason: 'Lead de imóvel semelhante sem transactionType: não dá para saber a finalidade',
    };
  }

  if (transactionType) {
    if (property && !COMPATIBLE_PURPOSES[transactionType].includes(property.purpose)) {
      return {
        queue: 'TRIAGE',
        reason: `transactionType=${transactionType} do portal, mas o imóvel ${property.code} é só de ${PURPOSE_LABEL[property.purpose]}`,
      };
    }
    return {
      queue: QUEUE_BY_TRANSACTION[transactionType],
      reason: `transactionType=${transactionType} do portal`,
    };
  }

  if (!property) {
    const listing = input.clientListingId ? ` ${input.clientListingId}` : '';
    return {
      queue: 'TRIAGE',
      reason: `Sem transactionType e imóvel${listing} não encontrado`,
    };
  }

  switch (property.purpose) {
    case 'RENT':
      return { queue: 'RENTAL', reason: `Imóvel ${property.code} é de locação` };
    case 'SALE':
      return { queue: 'SALES', reason: `Imóvel ${property.code} é de venda` };
    case 'SALE_RENT':
      return {
        queue: 'TRIAGE',
        reason: `Imóvel ${property.code} é de venda e locação e o portal não informou transactionType`,
      };
  }
}
