import { createHash, timingSafeEqual } from 'node:crypto';
import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { APP_CONFIG, type AppConfig } from '../../../common/config/env.js';
import { UnauthenticatedError } from '../../../common/errors/domain-errors.js';

/**
 * Autenticação do webhook do Grupo OLX: o portal envia `Authorization: Basic base64(usuario:CHAVE)`
 * e a chave secreta (por CRM, não por anunciante) vem no lugar da senha. Chave errada responde 401.
 * Fonte: https://developers.grupozap.com/webhooks/security.html
 */
export function extractBasicSecret(header: string | undefined): string | null {
  const match = /^Basic\s+([A-Za-z0-9+/=]+)\s*$/i.exec(header ?? '');
  if (!match) return null;
  const decoded = Buffer.from(match[1]!, 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  return separator === -1 ? null : decoded.slice(separator + 1);
}

/** Compara por hash para o tempo não depender do conteúdo nem do tamanho da chave. */
function secretsMatch(received: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(received), digest(expected));
}

@Injectable()
export class GrupoOlxWebhookGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const secret = extractBasicSecret(request.headers.authorization);
    if (secret === null || !secretsMatch(secret, this.config.GRUPO_OLX_WEBHOOK_SECRET)) {
      throw new UnauthenticatedError('Chave do webhook inválida');
    }
    return true;
  }
}
