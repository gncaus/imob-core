/**
 * Roleta de corretores: o próximo lead da fila vai para o corretor ativo que recebeu lead há
 * mais tempo. Quem nunca recebeu vem primeiro; empate decide pelo cadastro mais antigo.
 */

export interface RouletteCandidate {
  id: string;
  active: boolean;
  lastLeadAt: Date | null;
  createdAt: Date;
}

export function pickNextAgent<T extends RouletteCandidate>(candidates: readonly T[]): T | null {
  let next: T | null = null;
  for (const candidate of candidates) {
    if (!candidate.active) continue;
    if (next === null || comesBefore(candidate, next)) next = candidate;
  }
  return next;
}

function comesBefore(a: RouletteCandidate, b: RouletteCandidate): boolean {
  if (a.lastLeadAt === null || b.lastLeadAt === null) {
    if (a.lastLeadAt !== b.lastLeadAt) return a.lastLeadAt === null;
  } else if (a.lastLeadAt.getTime() !== b.lastLeadAt.getTime()) {
    return a.lastLeadAt < b.lastLeadAt;
  }
  if (a.createdAt.getTime() !== b.createdAt.getTime()) return a.createdAt < b.createdAt;
  return a.id < b.id;
}
