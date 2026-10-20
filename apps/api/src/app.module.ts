import { Module } from '@nestjs/common';
import { ConfigModule } from './common/config/config.module.js';
import { LoggerModule } from './common/logger/logger.module.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [ConfigModule, LoggerModule, PrismaModule, HealthModule],
})
export class AppModule {}
