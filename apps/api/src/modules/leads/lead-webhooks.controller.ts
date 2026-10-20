import { Body, Controller, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/auth/auth.decorators.js';
import { GrupoOlxWebhookGuard } from './grupo-olx/grupo-olx-webhook.guard.js';
import { LeadIngestionService } from './lead-ingestion.service.js';

@Controller('webhooks/leads')
export class LeadWebhooksController {
  constructor(private readonly ingestion: LeadIngestionService) {}

  /**
   * O portal só olha o status HTTP: 2xx somente depois de o lead estar gravado.
   * 201 para lead novo, 200 para reenvio de um lead que já existe.
   */
  @Public()
  @UseGuards(GrupoOlxWebhookGuard)
  @Post('grupo-olx')
  async grupoOlx(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ id: string }> {
    const result = await this.ingestion.ingestGrupoOlx(body);
    res.status(result.duplicate ? HttpStatus.OK : HttpStatus.CREATED);
    return { id: result.leadId };
  }
}
