import type { LeadQueue } from '@imob/shared';

export interface LeadAssignedNotification {
  leadId: string;
  queue: LeadQueue;
  agent: { id: string; name: string; whatsapp: string };
  propertyCode: string | null;
  /** Link para o corretor abrir a conversa com o cliente; nulo se o lead veio sem telefone. */
  customerWhatsappLink: string | null;
}

/**
 * Aviso ao corretor quando um lead é atribuído a ele. Classe abstrata para servir de token de
 * injeção: hoje só existe o LogNotifier; a API oficial do WhatsApp entra como outra implementação.
 */
export abstract class LeadNotifier {
  abstract leadAssigned(notification: LeadAssignedNotification): Promise<void>;
}
