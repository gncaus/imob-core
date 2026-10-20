import { Injectable } from '@nestjs/common';
import {
  type LeadDto,
  type LeadListQuery,
  type LeadQueue,
  type MoveLeadData,
  type SessionUser,
  whatsappLink,
} from '@imob/shared';
import { ConflictError, NotFoundError } from '../../common/errors/domain-errors.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { assignNextAgent, lockLead } from './agent-assignment.js';
import { LeadRoutingService, withoutAgentNote } from './lead-routing.service.js';

const leadInclude = {
  property: { select: { id: true, code: true, title: true } },
  agent: { select: { id: true, user: { select: { name: true } } } },
} as const;

type LeadWithRelations = Prisma.LeadGetPayload<{ include: typeof leadInclude }>;

const QUEUE_LABEL: Record<LeadQueue, string> = {
  RENTAL: 'Locação',
  SALES: 'Vendas',
  TRIAGE: 'Triagem',
};

/** O painel mostra as filas mais recentes primeiro; o limite protege a tela de listas enormes. */
const LIST_LIMIT = 200;

function toDto(lead: LeadWithRelations): LeadDto {
  return {
    id: lead.id,
    source: lead.source,
    origin: lead.origin,
    leadType: lead.leadType,
    temperature: lead.temperature,
    transactionType: lead.transactionType,
    isSimilarListing: lead.isSimilarListing,
    status: lead.status,
    queue: lead.queue,
    routingReason: lead.routingReason,
    name: lead.name,
    email: lead.email,
    ddd: lead.ddd,
    phone: lead.phone,
    message: lead.message,
    whatsappLink: whatsappLink(lead.ddd, lead.phone),
    clientListingId: lead.clientListingId,
    property: lead.property,
    agent: lead.agent ? { id: lead.agent.id, name: lead.agent.user.name } : null,
    createdAt: lead.createdAt.toISOString(),
    routedAt: lead.routedAt?.toISOString() ?? null,
  };
}

const leadNotFound = () => new NotFoundError('Lead não encontrado');

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routing: LeadRoutingService,
  ) {}

  async list(query: LeadListQuery): Promise<LeadDto[]> {
    const leads = await this.prisma.lead.findMany({
      where: { queue: query.queue },
      include: leadInclude,
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
    });
    return leads.map(toDto);
  }

  /**
   * Move o lead de fila manualmente. Em Locação ou Vendas ele ganha corretor pela roleta;
   * na Triagem fica sem dono. O motivo registra quem moveu.
   */
  async move(
    id: string,
    { queue }: MoveLeadData,
    user: SessionUser,
    now = new Date(),
  ): Promise<LeadDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      await lockLead(tx, id);
      const lead = await tx.lead.findUnique({ where: { id }, include: leadInclude });
      if (!lead) throw leadNotFound();
      if (lead.status !== 'ROUTED') {
        throw new ConflictError('O lead ainda está sendo roteado. Tente de novo em instantes.');
      }
      if (lead.queue === queue) return { lead, agent: null };

      const agent = queue === 'TRIAGE' ? null : await assignNextAgent(tx, queue, now);
      const reason = `Movido manualmente para ${QUEUE_LABEL[queue]} por ${user.name}`;
      const updated = await tx.lead.update({
        where: { id },
        data: {
          queue,
          agentId: agent?.id ?? null,
          routingReason: agent ? reason : withoutAgentNote(queue, reason),
          routedAt: now,
        },
        include: leadInclude,
      });
      return { lead: updated, agent };
    });

    const { lead, agent } = result;
    if (agent && lead.queue) {
      await this.routing.notifyAssigned({
        leadId: lead.id,
        queue: lead.queue,
        agent,
        propertyCode: lead.property?.code ?? null,
        ddd: lead.ddd,
        phone: lead.phone,
      });
    }
    return toDto(lead);
  }
}
