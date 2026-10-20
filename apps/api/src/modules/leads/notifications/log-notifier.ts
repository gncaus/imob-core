import { Injectable, Logger } from '@nestjs/common';
import { type LeadAssignedNotification, LeadNotifier } from './lead-notifier.js';

/** Registra o aviso no log estruturado, no lugar do envio real pelo WhatsApp. */
@Injectable()
export class LogNotifier extends LeadNotifier {
  private readonly logger = new Logger('LeadNotifier');

  leadAssigned(notification: LeadAssignedNotification): Promise<void> {
    this.logger.log(
      {
        leadId: notification.leadId,
        agentId: notification.agent.id,
        queue: notification.queue,
        propertyCode: notification.propertyCode,
        // O link é o conteúdo do aviso: é o que o corretor usaria para chamar o cliente.
        whatsappLink: notification.customerWhatsappLink,
      },
      `Novo lead para ${notification.agent.name}`,
    );
    return Promise.resolve();
  }
}
