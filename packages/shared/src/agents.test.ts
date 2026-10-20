import { describe, expect, it } from 'vitest';
import { agentListQuerySchema, createAgentSchema, updateAgentSchema } from './agents.js';

const validAgent = {
  name: ' Ana Souza ',
  email: ' Ana@Imob.COM ',
  password: 'senha-forte',
  queue: 'RENTAL',
  whatsapp: '(27) 99999-0000',
};

describe('createAgentSchema', () => {
  it('normalizes name, email and whatsapp and defaults active to true', () => {
    expect(createAgentSchema.parse(validAgent)).toEqual({
      name: 'Ana Souza',
      email: 'ana@imob.com',
      password: 'senha-forte',
      queue: 'RENTAL',
      whatsapp: '27999990000',
      active: true,
    });
  });

  it('rejects a short password', () => {
    expect(createAgentSchema.safeParse({ ...validAgent, password: '123' }).success).toBe(false);
  });

  it('rejects the TRIAGE queue, which has no agents', () => {
    expect(createAgentSchema.safeParse({ ...validAgent, queue: 'TRIAGE' }).success).toBe(false);
  });
});

describe('updateAgentSchema', () => {
  it('accepts a partial update', () => {
    expect(updateAgentSchema.parse({ active: false })).toEqual({ active: false });
  });

  it('rejects an empty update', () => {
    expect(updateAgentSchema.safeParse({}).success).toBe(false);
  });
});

describe('agentListQuerySchema', () => {
  it('parses the active flag from the query string', () => {
    expect(agentListQuerySchema.parse({ queue: 'SALES', active: 'false' })).toEqual({
      queue: 'SALES',
      active: false,
    });
  });
});
