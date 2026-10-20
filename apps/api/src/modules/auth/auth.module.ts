import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthGuard } from '../../common/auth/auth.guard.js';
import { APP_CONFIG, type AppConfig } from '../../common/config/env.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.JWT_SECRET,
        signOptions: { expiresIn: config.SESSION_TTL_SECONDS },
      }),
    }),
    // Aplicado só no login (via @UseGuards na rota), contra força bruta de senha.
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => [
        { name: 'login', ttl: 60_000, limit: config.LOGIN_RATE_LIMIT_PER_MINUTE },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}
