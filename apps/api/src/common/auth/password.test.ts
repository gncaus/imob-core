import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('verifies the original password', async () => {
    const passwordHash = await hashPassword('senha-forte');

    expect(passwordHash).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(passwordHash, 'senha-forte')).resolves.toBe(true);
  });

  it('rejects a different password', async () => {
    const passwordHash = await hashPassword('senha-forte');

    await expect(verifyPassword(passwordHash, 'senha-errada')).resolves.toBe(false);
  });

  it('treats a malformed hash as a mismatch', async () => {
    await expect(verifyPassword('not-a-hash', 'senha-forte')).resolves.toBe(false);
  });
});
