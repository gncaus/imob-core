import { describe, expect, it } from 'vitest';
import { parseGrupoOlxPayload } from './grupo-olx-payload.js';

/** Exemplo oficial de lead de anúncio (integration_leads.html), com mensagens encurtadas. */
const adLead = {
  leadOrigin: 'Grupo OLX',
  timestamp: '2017-10-23T15:50:30.619Z',
  originLeadId: '59ee0fc6e4b043e1b2a6d863',
  originListingId: '87027856',
  clientListingId: 'a40171',
  name: 'Nome Consumidor',
  email: 'Nome.Consumidor@Email.com',
  ddd: '11',
  phone: '999999999',
  phoneNumber: '11999999999',
  message: 'Olá, tenho interesse neste imóvel.',
  temperature: 'Alta',
  transactionType: 'SELL',
  extraData: {
    leadCerto: true,
    izi: 'Visualize o histórico de mensagem do cliente com IZI',
    feedback: 'Avalie a temperatura do lead',
    leadType: 'CONTACT_CHAT',
  },
};

/** Exemplo oficial de lead MCMV: sem originListingId nem clientListingId. */
const mcmvLead = {
  leadOrigin: 'MCMV_OLX',
  timestamp: '2026-07-10T10:15:30.000Z',
  originLeadId: 'mcmv-1234567890',
  name: 'João da Silva',
  email: 'joao.silva@example.com',
  ddd: '11',
  phone: '987654321',
  message: 'Simulação de financiamento MCMV realizada no portal.',
  temperature: 'Média',
  transactionType: 'SELL',
  extraData: { mcmv: { propertyValue: 250000, subsidyRange: 'FAIXA_1' } },
};

const parse = (body: unknown) => {
  const result = parseGrupoOlxPayload(body);
  if (!result.success) throw new Error(JSON.stringify(result.issues));
  return result.lead;
};

describe('parseGrupoOlxPayload', () => {
  it('normalizes the official ad lead example', () => {
    expect(parse(adLead)).toEqual({
      origin: 'Grupo OLX',
      originLeadId: '59ee0fc6e4b043e1b2a6d863',
      originCreatedAt: new Date('2017-10-23T15:50:30.619Z'),
      clientListingId: 'a40171',
      isMcmv: false,
      name: 'Nome Consumidor',
      email: 'nome.consumidor@email.com',
      ddd: '11',
      phone: '999999999',
      message: 'Olá, tenho interesse neste imóvel.',
      temperature: 'HIGH',
      transactionType: 'SELL',
      leadType: 'CONTACT_CHAT',
      isSimilarListing: true,
    });
  });

  it('accepts the official MCMV example without clientListingId', () => {
    expect(parse(mcmvLead)).toMatchObject({
      origin: 'MCMV_OLX',
      isMcmv: true,
      clientListingId: null,
      temperature: 'MEDIUM',
      leadType: null,
      isSimilarListing: false,
    });
  });

  it('rejects an ad lead without clientListingId', () => {
    const { clientListingId: _omit, ...withoutListing } = adLead;

    expect(parseGrupoOlxPayload(withoutListing)).toEqual({
      success: false,
      issues: [expect.objectContaining({ path: 'clientListingId' })],
    });
    expect(parseGrupoOlxPayload({ ...adLead, clientListingId: '  ' }).success).toBe(false);
  });

  it.each([
    null,
    'texto',
    [],
    {},
    { ...adLead, originLeadId: '' },
    { ...adLead, originLeadId: 42 },
  ])('rejects a payload without a usable originLeadId: %j', (body) => {
    expect(parseGrupoOlxPayload(body).success).toBe(false);
  });

  it.each([
    ['Baixa', 'LOW'],
    ['Média', 'MEDIUM'],
    ['media', 'MEDIUM'],
    ['ALTA', 'HIGH'],
    ['Morna', null],
    [undefined, null],
  ])('maps temperature %s to %s', (temperature, expected) => {
    expect(parse({ ...adLead, temperature }).temperature).toBe(expected);
  });

  it('keeps unknown or missing transaction types as null instead of rejecting', () => {
    expect(parse({ ...adLead, transactionType: 'LEASE' }).transactionType).toBeNull();
    expect(parse({ ...adLead, transactionType: undefined }).transactionType).toBeNull();
    expect(parse({ ...adLead, transactionType: 'rent' }).transactionType).toBe('RENT');
  });

  it('falls back to the deprecated phoneNumber when ddd and phone are missing', () => {
    const lead = parse({
      ...adLead,
      ddd: undefined,
      phone: undefined,
      phoneNumber: '+55 (27) 99888-7766',
    });

    expect(lead).toMatchObject({ ddd: '27', phone: '998887766' });
  });

  it('tolerates a malformed timestamp and extraData', () => {
    const lead = parse({ ...adLead, timestamp: 'ontem', extraData: 'invalido' });

    expect(lead).toMatchObject({ originCreatedAt: null, leadType: null, isSimilarListing: false });
  });

  it('only marks leadCerto when it is literally true', () => {
    expect(parse({ ...adLead, extraData: { leadCerto: 'true' } }).isSimilarListing).toBe(false);
  });
});
