import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { GrupoOlxWebhookGuard } from './grupo-olx/grupo-olx-webhook.guard.js';
import { LeadIngestionService } from './lead-ingestion.service.js';
import {
  LEAD_ROUTING_QUEUE,
  LeadRoutingProcessor,
  LeadRoutingQueue,
} from './lead-routing.queue.js';
import { LeadRoutingService } from './lead-routing.service.js';
import { LeadWebhooksController } from './lead-webhooks.controller.js';
import { LeadNotifier } from './notifications/lead-notifier.js';
import { LogNotifier } from './notifications/log-notifier.js';

@Module({
  imports: [BullModule.registerQueue({ name: LEAD_ROUTING_QUEUE })],
  controllers: [LeadWebhooksController],
  providers: [
    LeadIngestionService,
    GrupoOlxWebhookGuard,
    LeadRoutingQueue,
    LeadRoutingService,
    LeadRoutingProcessor,
    { provide: LeadNotifier, useClass: LogNotifier },
  ],
})
export class LeadsModule {}
