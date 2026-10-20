import { Injectable, Logger } from '@nestjs/common';
import { ValidationError } from '../../common/errors/domain-errors.js';
import { isUniqueViolation } from '../../common/errors/prisma-errors.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { LeadStatus, Prisma } from '../../generated/prisma/client.js';
import { parseGrupoOlxPayload } from './grupo-olx/grupo-olx-payload.js';
import { LeadRoutingQueue } from './lead-routing.queue.js';

export interface IngestResult {
  leadId: string;
  /** `true` quando o portal reenviou um lead já gravado (mesmo `originLeadId`). */
  duplicate: boolean;
}

@Injectable()
export class LeadIngestionService {
  private readonly logger = new Logger(LeadIngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly routingQueue: LeadRoutingQueue,
  ) {}

  /**
   * Grava o lead, enfileira o roteamento e responde; o roteamento roda fora da requisição.
   * Idempotente por `originLeadId`: o portal reenvia em qualquer resposta fora de 2xx.
   * Se o enfileiramento falhar, a resposta é 5xx e o reenvio do portal tenta enfileirar de novo.
   */
  async ingestGrupoOlx(body: unknown): Promise<IngestResult> {
    const parsed = parseGrupoOlxPayload(body);
    if (!parsed.success) throw new ValidationError(parsed.issues);
    const { lead } = parsed;

    const existing = await this.findExisting(lead.originLeadId);
    if (existing) return this.duplicate(existing);

    // O clientListingId é o ListingID que enviamos no feed, ou seja, o código do imóvel.
    const property = lead.clientListingId
      ? await this.prisma.property.findUnique({
          where: { code: lead.clientListingId.toUpperCase() },
          select: { id: true },
        })
      : null;

    let leadId: string;
    try {
      const created = await this.prisma.lead.create({
        data: {
          source: 'GRUPO_OLX',
          origin: lead.origin,
          originLeadId: lead.originLeadId,
          originCreatedAt: lead.originCreatedAt,
          clientListingId: lead.clientListingId,
          propertyId: property?.id ?? null,
          name: lead.name,
          email: lead.email,
          ddd: lead.ddd,
          phone: lead.phone,
          message: lead.message,
          temperature: lead.temperature,
          transactionType: lead.transactionType,
          leadType: lead.leadType,
          isSimilarListing: lead.isSimilarListing,
          rawPayload: body as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      leadId = created.id;
    } catch (error) {
      // Duas entregas simultâneas do mesmo lead: a segunda perde a corrida no índice único.
      if (isUniqueViolation(error)) {
        const winner = await this.findExisting(lead.originLeadId);
        if (winner) return this.duplicate(winner);
      }
      throw error;
    }

    this.logger.log(
      { leadId, propertyId: property?.id ?? null, origin: lead.origin },
      'Lead do Grupo OLX recebido',
    );
    await this.routingQueue.enqueue(leadId);
    return { leadId, duplicate: false };
  }

  private findExisting(originLeadId: string) {
    return this.prisma.lead.findUnique({
      where: { source_originLeadId: { source: 'GRUPO_OLX', originLeadId } },
      select: { id: true, status: true },
    });
  }

  /** Reenvio: se o lead ainda não foi roteado (ex.: falha ao enfileirar antes), tenta de novo. */
  private async duplicate(existing: { id: string; status: LeadStatus }): Promise<IngestResult> {
    this.logger.log({ leadId: existing.id }, 'Lead do Grupo OLX repetido ignorado');
    if (existing.status === 'RECEIVED') await this.routingQueue.enqueue(existing.id);
    return { leadId: existing.id, duplicate: true };
  }
}
