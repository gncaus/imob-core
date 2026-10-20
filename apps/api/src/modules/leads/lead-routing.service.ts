import { Injectable, Logger } from '@nestjs/common';
import { type LeadQueue, whatsappLink } from '@imob/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { type AssignedAgent, assignNextAgent, lockLead } from './agent-assignment.js';
import { MCMV_ORIGIN } from './grupo-olx/grupo-olx-payload.js';
import { LeadNotifier } from './notifications/lead-notifier.js';
import { routeLead } from './routing.js';

export type RoutingOutcome =
  { status: 'ROUTED'; queue: LeadQueue; agentId: string | null } | { status: 'SKIPPED' };

export interface AssignmentNotice {
  leadId: string;
  queue: LeadQueue;
  agent: AssignedAgent;
  propertyCode: string | null;
  ddd: string | null;
  phone: string | null;
}

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
      await lockLead(tx, leadId);
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
      const agent =
        decision.queue === 'TRIAGE' ? null : await assignNextAgent(tx, decision.queue, now);

      await tx.lead.update({
        where: { id: leadId },
        data: {
          queue: decision.queue,
          agentId: agent?.id ?? null,
          routingReason: agent
            ? decision.reason
            : withoutAgentNote(decision.queue, decision.reason),
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
      await this.notifyAssigned({
        leadId,
        queue,
        agent,
        propertyCode: lead.property?.code ?? null,
        ddd: lead.ddd,
        phone: lead.phone,
      });
    }
    return { status: 'ROUTED', queue, agentId: agent?.id ?? null };
  }

  /** O lead já está atribuído; uma falha no aviso não pode desfazer isso nem travar o job. */
  async notifyAssigned(notice: AssignmentNotice): Promise<void> {
    await this.notifier
      .leadAssigned({
        leadId: notice.leadId,
        queue: notice.queue,
        agent: {
          id: notice.agent.id,
          name: notice.agent.user.name,
          whatsapp: notice.agent.whatsapp,
        },
        propertyCode: notice.propertyCode,
        customerWhatsappLink: whatsappLink(notice.ddd, notice.phone),
      })
      .catch((error: unknown) => {
        this.logger.error(
          { err: error, leadId: notice.leadId, agentId: notice.agent.id },
          'Falha ao avisar o corretor',
        );
      });
  }
}

export function withoutAgentNote(queue: LeadQueue, reason: string): string {
  return queue === 'TRIAGE' ? reason : `${reason}. Sem corretor ativo na fila: aguardando dono`;
}
