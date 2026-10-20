import { describe, expect, it } from 'vitest';
import { brazilianPhoneSchema, whatsappLink } from './phone.js';

describe('whatsappLink', () => {
  it('builds the wa.me link with the country code', () => {
    expect(whatsappLink('27', '99999-0000')).toBe('https://wa.me/5527999990000');
    expect(whatsappLink('27', '33334444')).toBe('https://wa.me/552733334444');
  });

  it.each([
    [null, '999990000'],
    ['27', null],
    ['27', '123'],
    [null, null],
  ])('returns null for ddd=%s phone=%s', (ddd, phone) => {
    expect(whatsappLink(ddd, phone)).toBeNull();
  });
});

describe('brazilianPhoneSchema', () => {
  it.each([
    ['(27) 99999-0000', '27999990000'],
    ['27 3333-4444', '2733334444'],
    ['+55 27 99999-0000', '27999990000'],
    ['5527999990000', '27999990000'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(brazilianPhoneSchema.parse(input)).toBe(expected);
  });

  it.each(['', '99999-0000', '0799999000', '279999900001', 'abc'])('rejects %s', (input) => {
    expect(brazilianPhoneSchema.safeParse(input).success).toBe(false);
  });
});
