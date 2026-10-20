import { describe, expect, it } from 'vitest';
import { extractBasicSecret } from './grupo-olx-webhook.guard.js';

const basic = (value: string) => `Basic ${Buffer.from(value).toString('base64')}`;

describe('extractBasicSecret', () => {
  it('decodes the official example header', () => {
    expect(
      extractBasicSecret('Basic dml2YXJlYWw6NTk0RjgwM0IzODBBNDEzOTZFRDYzRENBMzk1MDM1NDI='),
    ).toBe('594F803B380A41396ED63DCA39503542');
  });

  it('keeps colons that are part of the secret', () => {
    expect(extractBasicSecret(basic('grupozap:abc:def'))).toBe('abc:def');
  });

  it('accepts the scheme in any case', () => {
    expect(extractBasicSecret(basic('x:segredo').replace('Basic', 'basic'))).toBe('segredo');
  });

  it.each([undefined, '', 'Bearer abc', 'Basic', 'Basic !!!', basic('sem-dois-pontos')])(
    'returns null for %j',
    (header) => {
      expect(extractBasicSecret(header)).toBeNull();
    },
  );
});
