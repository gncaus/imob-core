import type { PropertyPurpose } from '@imob/shared';
import { describe, expect, it } from 'vitest';
import { routeLead, type RoutingInput } from './routing.js';

const input = (overrides: Partial<RoutingInput> = {}): RoutingInput => ({
  transactionType: null,
  isMcmv: false,
  isSimilarListing: false,
  clientListingId: 'VV-101',
  property: null,
  ...overrides,
});

const property = (purpose: PropertyPurpose) => ({ code: 'VV-101', purpose });

describe('routeLead', () => {
  describe('rules 1 and 2: transactionType from the portal', () => {
    it('RENT goes to Locação', () => {
      expect(routeLead(input({ transactionType: 'RENT' }))).toEqual({
        queue: 'RENTAL',
        reason: 'transactionType=RENT do portal',
      });
    });

    it('SELL goes to Vendas', () => {
      expect(routeLead(input({ transactionType: 'SELL' }))).toEqual({
        queue: 'SALES',
        reason: 'transactionType=SELL do portal',
      });
    });

    it.each([
      ['RENT', 'RENT', 'RENTAL'],
      ['RENT', 'SALE_RENT', 'RENTAL'],
      ['SELL', 'SALE', 'SALES'],
      ['SELL', 'SALE_RENT', 'SALES'],
    ] as const)('%s on a %s property goes to %s', (transactionType, purpose, queue) => {
      expect(routeLead(input({ transactionType, property: property(purpose) })).queue).toBe(queue);
    });

    it('trusts the portal when the listing is unknown', () => {
      expect(routeLead(input({ transactionType: 'RENT', property: null })).queue).toBe('RENTAL');
    });
  });

  describe('ambiguity: portal contradicts the property purpose', () => {
    it('RENT on a sale-only property goes to Triagem', () => {
      expect(routeLead(input({ transactionType: 'RENT', property: property('SALE') }))).toEqual({
        queue: 'TRIAGE',
        reason: 'transactionType=RENT do portal, mas o imóvel VV-101 é só de venda',
      });
    });

    it('SELL on a rent-only property goes to Triagem', () => {
      expect(routeLead(input({ transactionType: 'SELL', property: property('RENT') })).queue).toBe(
        'TRIAGE',
      );
    });
  });

  describe('rule 3: no transactionType, use the property purpose', () => {
    it('rent property goes to Locação', () => {
      expect(routeLead(input({ property: property('RENT') }))).toEqual({
        queue: 'RENTAL',
        reason: 'Imóvel VV-101 é de locação',
      });
    });

    it('sale property goes to Vendas', () => {
      expect(routeLead(input({ property: property('SALE') }))).toEqual({
        queue: 'SALES',
        reason: 'Imóvel VV-101 é de venda',
      });
    });
  });

  describe('rule 4: never guess, send to Triagem', () => {
    it('sale-and-rent property without transactionType', () => {
      expect(routeLead(input({ property: property('SALE_RENT') }))).toEqual({
        queue: 'TRIAGE',
        reason: 'Imóvel VV-101 é de venda e locação e o portal não informou transactionType',
      });
    });

    it('property not found', () => {
      expect(routeLead(input({ clientListingId: 'XYZ-9' }))).toEqual({
        queue: 'TRIAGE',
        reason: 'Sem transactionType e imóvel XYZ-9 não encontrado',
      });
    });

    it('no listing at all', () => {
      expect(routeLead(input({ clientListingId: null })).reason).toBe(
        'Sem transactionType e imóvel não encontrado',
      );
    });
  });

  describe('rule 5: MCMV', () => {
    it('goes to Vendas regardless of the other fields', () => {
      const decision = routeLead(
        input({ isMcmv: true, transactionType: 'RENT', property: property('RENT') }),
      );

      expect(decision).toEqual({
        queue: 'SALES',
        reason: 'Lead MCMV (Minha Casa Minha Vida) do portal',
      });
    });
  });

  describe('rule 6: leadCerto (similar listing)', () => {
    it('follows transactionType and ignores the purpose of the cited property', () => {
      const decision = routeLead(
        input({ isSimilarListing: true, transactionType: 'RENT', property: property('SALE') }),
      );

      expect(decision).toEqual({
        queue: 'RENTAL',
        reason: 'transactionType=RENT do portal (lead de imóvel semelhante)',
      });
    });

    it('goes to Triagem without transactionType, even if the cited property has a purpose', () => {
      const decision = routeLead(input({ isSimilarListing: true, property: property('RENT') }));

      expect(decision.queue).toBe('TRIAGE');
    });
  });

  it('rule 7: always explains the decision', () => {
    const cases: RoutingInput[] = [
      input({ transactionType: 'RENT' }),
      input({ property: property('SALE_RENT') }),
      input({ isMcmv: true }),
      input({ isSimilarListing: true }),
    ];
    for (const routingInput of cases) {
      expect(routeLead(routingInput).reason.length).toBeGreaterThan(10);
    }
  });
});
