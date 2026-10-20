import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { LeadRoutingService, type RoutingOutcome } from './lead-routing.service.js';

export const LEAD_ROUTING_QUEUE = 'lead-routing';
const ENQUEUE_TIMEOUT_MS = 5_000;

interface RouteLeadJob {
  leadId: string;
}

/** Enfileira o roteamento. O id do job é o id do lead, então enfileirar de novo não duplica. */
@Injectable()
export class LeadRoutingQueue implements OnApplicationBootstrap {
  private readonly logger = new Logger(LeadRoutingQueue.name);

  constructor(
    @InjectQueue(LEAD_ROUTING_QUEUE) private readonly queue: Queue<RouteLeadJob>,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Com o Redis fora do ar, o cliente espera a reconexão indefinidamente. O limite faz o webhook
   * falhar com 5xx; o portal reenvia e o lead (já gravado) é enfileirado na nova tentativa.
   */
  async enqueue(leadId: string): Promise<void> {
    const add = this.queue.add(
      'route',
      { leadId },
      {
        jobId: leadId,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: true,
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      },
    );
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Tempo esgotado ao enfileirar o roteamento')),
        ENQUEUE_TIMEOUT_MS,
      );
    });
    try {
      await Promise.race([add, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Ao subir, recupera leads gravados cujo job se perdeu (ex.: Redis fora do ar na entrega). */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const pending = await this.prisma.lead.findMany({
        where: { status: 'RECEIVED' },
        select: { id: true },
      });
      await Promise.all(pending.map((lead) => this.enqueue(lead.id)));
      if (pending.length > 0) {
        this.logger.log(
          { count: pending.length },
          'Leads pendentes reenfileirados para roteamento',
        );
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Falha ao reenfileirar leads pendentes');
    }
  }
}

@Processor(LEAD_ROUTING_QUEUE)
export class LeadRoutingProcessor extends WorkerHost {
  constructor(private readonly routing: LeadRoutingService) {
    super();
  }

  process(job: Job<RouteLeadJob>): Promise<RoutingOutcome> {
    return this.routing.route(job.data.leadId);
  }
}
