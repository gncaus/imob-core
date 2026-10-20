import { describe, expect, it } from 'vitest';
import { agentQueueSchema, leadQueueSchema } from './enums.js';

describe('enums', () => {
  it('lead queues include every agent queue plus triage', () => {
    expect(leadQueueSchema.options).toEqual([...agentQueueSchema.options, 'TRIAGE']);
  });

  it('rejects unknown values', () => {
    expect(leadQueueSchema.safeParse('OTHER').success).toBe(false);
  });
});
