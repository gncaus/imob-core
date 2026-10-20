import { describe, expect, it } from 'vitest';
import { brazilianPhoneSchema } from './phone.js';

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
