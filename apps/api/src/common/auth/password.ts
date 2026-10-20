import { hash, verify } from '@node-rs/argon2';

// argon2id com os parâmetros padrão da biblioteca (m=19 MiB, t=2, p=1), que seguem a OWASP.
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // Hash malformado: trata como senha incorreta em vez de estourar 500.
    return false;
  }
}
