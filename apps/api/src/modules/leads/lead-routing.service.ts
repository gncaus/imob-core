import { Injectable, Logger } from '@nestjs/common';
import { type LeadQueue, whatsappLink } from '@imob/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { pickNextAgent } from '../agents/roulette.js';
import { MCMV_ORIGIN } from './grupo-olx/grupo-olx-payload.js';
import { type LeadAssignedNotification, LeadNotifier } from './notifications/lead-notifier.js';
import { routeLead } from './routing.js';

export type RoutingOutcome =
  { status: 'ROUTED'; queue: LeadQueue; agentId: string | null } | { status: 'SKIPPED' };

@Injectable()
export class LeadRoutingService {
  private readonly logger = new Logger(LeadRoutingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: LeadNotifier,
  ) {}

  /**
   * Define a fila do lead e, fora da Triagem, atribui o corretor pela roleta.
   * Idempotente: um lead já roteado é ignorado, então o job pode ser reexecutado sem efeito.
   */
  async route(leadId: string, now = new Date()): Promise<RoutingOutcome> {
    const result = await this.prisma.$transaction(async (tx) => {
      // Trava o lead: dois jobs para o mesmo lead não roteiam duas vezes.
      await tx.$queryRaw`SELECT id FROM leads WHERE id = ${leadId}::uuid FOR UPDATE`;
      const lead = await tx.lead.findUnique({
        where: { id: leadId },
        include: { property: { select: { code: true, purpose: true } } },
      });
      if (!lead || lead.status !== 'RECEIVED') return null;

      const decision = routeLead({
        transactionType: lead.transactionType,
        isMcmv: lead.origin === MCMV_ORIGIN,
        isSimilarListing: lead.isSimilarListing,
        clientListingId: lead.clientListingId,
        property: lead.property,
      });

      let agent: { id: string; whatsapp: string; user: { name: string } } | null = null;
      if (decision.queue !== 'TRIAGE') {
        // Trava a roleta da fila: leads simultâneos não caem no mesmo corretor.
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`lead-roulette:${decision.queue}`}))`;
        const candidates = await tx.agent.findMany({
          where: { queue: decision.queue, active: true },
          include: { user: { select: { name: true } } },
        });
        agent = pickNextAgent(candidates);
        if (agent) await tx.agent.update({ where: { id: agent.id }, data: { lastLeadAt: now } });
      }

      const reason = agent ? decision.reason : withoutAgentNote(decision.queue, decision.reason);
      await tx.lead.update({
        where: { id: leadId },
        data: {
          queue: decision.queue,
          agentId: agent?.id ?? null,
          routingReason: reason,
          status: 'ROUTED',
          routedAt: now,
        },
      });
      return { lead, queue: decision.queue, agent };
    });

    if (!result) {
      this.logger.log({ leadId }, 'Lead já roteado ou inexistente; nada a fazer');
      return { status: 'SKIPPED' };
    }

    const { lead, queue, agent } = result;
    this.logger.log(
      { leadId, propertyId: lead.propertyId, queue, agentId: agent?.id ?? null },
      'Lead roteado',
    );

    if (agent) {
      const notification: LeadAssignedNotification = {
        leadId,
        queue,
        agent: { id: agent.id, name: agent.user.name, whatsapp: agent.whatsapp },
        propertyCode: lead.property?.code ?? null,
        customerWhatsappLink: whatsappLink(lead.ddd, lead.phone),
      };
      // O lead já está roteado; uma falha no aviso não pode desfazer isso nem travar o job.
      await this.notifier.leadAssigned(notification).catch((error: unknown) => {
        this.logger.error({ err: error, leadId, agentId: agent.id }, 'Falha ao avisar o corretor');
      });
    }
    return { status: 'ROUTED', queue, agentId: agent?.id ?? null };
  }
}

function withoutAgentNote(queue: LeadQueue, reason: string): string {
  return queue === 'TRIAGE' ? reason : `${reason}. Sem corretor ativo na fila: aguardando dono`;
}
