import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { loginSchema, type LoginInput, type SessionUser } from '@imob/shared';
import type { Response } from 'express';
import { CurrentUser, Public } from '../../common/auth/auth.decorators.js';
import { SESSION_COOKIE, sessionCookieOptions } from '../../common/auth/session.js';
import { APP_CONFIG, type AppConfig } from '../../common/config/env.js';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) input: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SessionUser }> {
    const { user, token } = await this.auth.login(input);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions(this.config));
    return { user };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response): void {
    // O Express 5 ignora maxAge no clearCookie e sempre expira o cookie.
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(this.config));
  }

  @Get('me')
  me(@CurrentUser() user: SessionUser): { user: SessionUser } {
    return { user };
  }
}
