import type { SessionUser } from '@imob/shared';
import type { CookieOptions, Request } from 'express';
import type { AppConfig } from '../config/env.js';

export const SESSION_COOKIE = 'imob_session';

export interface SessionTokenPayload {
  sub: string;
}

export interface AuthenticatedRequest extends Request {
  user: SessionUser;
}

export function sessionCookieOptions(config: AppConfig): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.COOKIE_SECURE ?? config.NODE_ENV === 'production',
    path: '/',
    maxAge: config.SESSION_TTL_SECONDS * 1000,
  };
}
