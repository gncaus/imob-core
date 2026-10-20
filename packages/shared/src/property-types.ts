import { z } from 'zod';

/**
 * Tipos de imóvel aceitos pelo VRSync (elemento PropertyType), com o rótulo exibido no painel.
 * Fonte: https://developers.grupozap.com/feeds/vrsync/elements/details.html
 */
export const PROPERTY_TYPES = {
  'Residential / Apartment': 'Apartamento',
  'Residential / Home': 'Casa',
  'Residential / Condo': 'Casa de condomínio',
  'Residential / Village House': 'Casa de vila',
  'Residential / Farm Ranch': 'Fazenda / sítio / chácara',
  'Residential / Penthouse': 'Cobertura',
  'Residential / Flat': 'Flat',
  'Residential / Kitnet': 'Kitnet / conjugado',
  'Residential / Studio': 'Studio',
  'Residential / Loft': 'Loft',
  'Residential / Land Lot': 'Terreno / lote residencial',
  'Residential / Sobrado': 'Sobrado',
  'Residential / Agricultural': 'Chácara',
  'Commercial / Consultorio': 'Consultório',
  'Commercial / Edificio Residencial': 'Edifício residencial',
  'Commercial / Industrial': 'Galpão / depósito / armazém',
  'Commercial / Garage': 'Garagem',
  'Commercial / Hotel': 'Hotel / motel / pousada',
  'Commercial / Building': 'Imóvel comercial',
  'Commercial / Corporate Floor': 'Andar / laje corporativa',
  'Commercial / Land Lot': 'Terreno / lote comercial',
  'Commercial / Business': 'Ponto comercial / loja / box',
  'Commercial / Edificio Comercial': 'Prédio inteiro',
  'Commercial / Office': 'Conjunto comercial / sala',
} as const;

export type PropertyType = keyof typeof PROPERTY_TYPES;

export const propertyTypeSchema = z.enum(
  Object.keys(PROPERTY_TYPES) as [PropertyType, ...PropertyType[]],
  'Tipo de imóvel inválido',
);

/** Unidades federativas, para validar a sigla do estado (State abbreviation). */
export const BRAZILIAN_STATES = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
} as const;

export type BrazilianState = keyof typeof BRAZILIAN_STATES;

export const brazilianStateSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
  z.enum(Object.keys(BRAZILIAN_STATES) as [BrazilianState, ...BrazilianState[]], 'UF inválida'),
);
