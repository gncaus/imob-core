import type { AgentQueue } from '@imob/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { pickNextAgent } from '../agents/roulette.js';

export interface AssignedAgent {
  id: string;
  whatsapp: string;
  user: { name: string };
}

/**
 * Escolhe o próximo corretor da fila pela roleta e marca o horário do lead dele. Deve rodar
 * dentro de uma transação: o lock consultivo por fila impede que leads simultâneos peguem o
 * mesmo corretor (é liberado no fim da transação).
 */
export async function assignNextAgent(
  tx: Prisma.TransactionClient,
  queue: AgentQueue,
  now: Date,
): Promise<AssignedAgent | null> {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`lead-roulette:${queue}`}))`;
  const candidates = await tx.agent.findMany({
    where: { queue, active: true },
    include: { user: { select: { name: true } } },
  });
  const agent = pickNextAgent(candidates);
  if (agent) await tx.agent.update({ where: { id: agent.id }, data: { lastLeadAt: now } });
  return agent;
}

/** Trava a linha do lead até o fim da transação. */
export async function lockLead(tx: Prisma.TransactionClient, leadId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM leads WHERE id = ${leadId}::uuid FOR UPDATE`;
}
