import { Injectable, Logger } from '@nestjs/common';
import { ValidationError } from '../../common/errors/domain-errors.js';
import { isUniqueViolation } from '../../common/errors/prisma-errors.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { parseGrupoOlxPayload } from './grupo-olx/grupo-olx-payload.js';

export interface IngestResult {
  leadId: string;
  /** `true` quando o portal reenviou um lead já gravado (mesmo `originLeadId`). */
  duplicate: boolean;
}

@Injectable()
export class LeadIngestionService {
  private readonly logger = new Logger(LeadIngestionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Grava o lead e responde rápido; o roteamento roda depois, fora da requisição.
   * Idempotente por `originLeadId`: o portal reenvia em qualquer resposta fora de 2xx.
   */
  async ingestGrupoOlx(body: unknown): Promise<IngestResult> {
    const parsed = parseGrupoOlxPayload(body);
    if (!parsed.success) throw new ValidationError(parsed.issues);
    const { lead } = parsed;

    const existing = await this.findExisting(lead.originLeadId);
    if (existing) return this.duplicate(existing.id);

    // O clientListingId é o ListingID que enviamos no feed, ou seja, o código do imóvel.
    const property = lead.clientListingId
      ? await this.prisma.property.findUnique({
          where: { code: lead.clientListingId.toUpperCase() },
          select: { id: true },
        })
      : null;

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
      this.logger.log(
        { leadId: created.id, propertyId: property?.id ?? null, origin: lead.origin },
        'Lead do Grupo OLX recebido',
      );
      return { leadId: created.id, duplicate: false };
    } catch (error) {
      // Duas entregas simultâneas do mesmo lead: a segunda perde a corrida no índice único.
      if (isUniqueViolation(error)) {
        const winner = await this.findExisting(lead.originLeadId);
        if (winner) return this.duplicate(winner.id);
      }
      throw error;
    }
  }

  private findExisting(originLeadId: string) {
    return this.prisma.lead.findUnique({
      where: { source_originLeadId: { source: 'GRUPO_OLX', originLeadId } },
      select: { id: true },
    });
  }

  private duplicate(leadId: string): IngestResult {
    this.logger.log({ leadId }, 'Lead do Grupo OLX repetido ignorado');
    return { leadId, duplicate: true };
  }
}
