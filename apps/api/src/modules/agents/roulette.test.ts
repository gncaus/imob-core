import { describe, expect, it } from 'vitest';
import { pickNextAgent, type RouletteCandidate } from './roulette.js';

const agent = (
  id: string,
  lastLeadAt: string | null,
  overrides: Partial<RouletteCandidate> = {},
): RouletteCandidate => ({
  id,
  active: true,
  lastLeadAt: lastLeadAt === null ? null : new Date(lastLeadAt),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('pickNextAgent', () => {
  it('picks the active agent whose last lead is the oldest', () => {
    const agents = [
      agent('ana', '2026-10-20T12:00:00Z'),
      agent('bruno', '2026-10-20T09:00:00Z'),
      agent('carla', '2026-10-20T15:00:00Z'),
    ];

    expect(pickNextAgent(agents)?.id).toBe('bruno');
  });

  it('prefers an agent who never received a lead', () => {
    const agents = [agent('ana', '2026-10-20T09:00:00Z'), agent('bruno', null)];

    expect(pickNextAgent(agents)?.id).toBe('bruno');
  });

  it('skips inactive agents even if they are first in line', () => {
    const agents = [agent('ana', null, { active: false }), agent('bruno', '2026-10-20T09:00:00Z')];

    expect(pickNextAgent(agents)?.id).toBe('bruno');
  });

  it('breaks ties by the oldest registration, then by id', () => {
    const older = agent('zeca', null, { createdAt: new Date('2025-01-01T00:00:00Z') });

    expect(pickNextAgent([agent('ana', null), older])?.id).toBe('zeca');
    expect(pickNextAgent([agent('bruno', null), agent('ana', null)])?.id).toBe('ana');
  });

  it('returns null when nobody is active', () => {
    expect(pickNextAgent([agent('ana', null, { active: false })])).toBeNull();
    expect(pickNextAgent([])).toBeNull();
  });

  it('rotates through the queue as each pick updates lastLeadAt', () => {
    const agents = [agent('ana', null), agent('bruno', null), agent('carla', null)];
    const picks: string[] = [];
    for (let minute = 0; minute < 6; minute++) {
      const next = pickNextAgent(agents)!;
      picks.push(next.id);
      next.lastLeadAt = new Date(Date.UTC(2026, 9, 20, 12, minute));
    }

    expect(picks).toEqual(['ana', 'bruno', 'carla', 'ana', 'bruno', 'carla']);
  });
});
