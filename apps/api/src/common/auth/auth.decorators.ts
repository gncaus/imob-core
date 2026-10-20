import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { SessionUser, UserRole } from '@imob/shared';
import type { AuthenticatedRequest } from './session.js';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';

/** Libera a rota do guard de autenticação global. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restringe a rota aos papéis informados. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
