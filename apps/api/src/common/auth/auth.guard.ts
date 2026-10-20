import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { UserRole } from '@imob/shared';
import { ForbiddenError, UnauthenticatedError } from '../errors/domain-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.decorators.js';
import { type AuthenticatedRequest, SESSION_COOKIE, type SessionTokenPayload } from './session.js';

/**
 * Guard global: toda rota exige sessão válida, exceto as marcadas com `@Public()`.
 * O usuário é recarregado do banco a cada requisição para refletir exclusões e troca de papel.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = await this.verifySession(request);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) throw new UnauthenticatedError();
    request.user = user;

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, targets);
    if (roles && !roles.includes(user.role)) throw new ForbiddenError();
    return true;
  }

  private async verifySession(request: AuthenticatedRequest): Promise<string> {
    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    const token = cookies?.[SESSION_COOKIE];
    if (!token) throw new UnauthenticatedError('Faça login para continuar');
    try {
      const payload = await this.jwt.verifyAsync<SessionTokenPayload>(token);
      return payload.sub;
    } catch {
      throw new UnauthenticatedError();
    }
  }
}
