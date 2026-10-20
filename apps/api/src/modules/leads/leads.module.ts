import { Module } from '@nestjs/common';
import { GrupoOlxWebhookGuard } from './grupo-olx/grupo-olx-webhook.guard.js';
import { LeadIngestionService } from './lead-ingestion.service.js';
import { LeadWebhooksController } from './lead-webhooks.controller.js';

@Module({
  controllers: [LeadWebhooksController],
  providers: [LeadIngestionService, GrupoOlxWebhookGuard],
})
export class LeadsModule {}
