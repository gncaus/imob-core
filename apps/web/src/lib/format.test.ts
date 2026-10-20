import { describe, expect, it } from 'vitest';
import { centsToInput, formatCents, formatDateTime, inputToCents } from './format';

describe('inputToCents', () => {
  it.each([
    ['1.234,56', 123_456],
    ['1234,5', 123_450],
    ['R$ 850.000', 85_000_000],
    ['850000', 85_000_000],
    ['1234.56', 123_456],
    ['0,99', 99],
  ])('converts %s to %d cents', (input, cents) => {
    expect(inputToCents(input)).toBe(cents);
  });

  it('returns null for an empty field', () => {
    expect(inputToCents('   ')).toBeNull();
  });

  it.each(['abc', '1,234', '1,2,3', '-10'])('returns NaN for %s', (input) => {
    expect(inputToCents(input)).toBeNaN();
  });
});

describe('centsToInput', () => {
  it('round-trips with inputToCents', () => {
    for (const cents of [0, 99, 123_456, 85_000_000]) {
      expect(inputToCents(centsToInput(cents))).toBe(cents);
    }
    expect(centsToInput(null)).toBe('');
  });
});

describe('formatters', () => {
  it('formats money in BRL', () => {
    expect(formatCents(123_456).replace(/\s/g, ' ')).toBe('R$ 1.234,56');
    expect(formatCents(null)).toBe('—');
  });

  it('shows dates in São Paulo time', () => {
    expect(formatDateTime('2026-10-20T13:30:00Z')).toBe('20/10/2026, 10:30');
  });
});
