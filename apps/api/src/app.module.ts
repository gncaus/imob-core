import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from './common/config/config.module.js';
import { DomainExceptionFilter } from './common/errors/domain-exception.filter.js';
import { LoggerModule } from './common/logger/logger.module.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { StorageModule } from './common/storage/storage.module.js';
import { AgentsModule } from './modules/agents/agents.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { LeadsModule } from './modules/leads/leads.module.js';
import { PortalsModule } from './modules/portals/portals.module.js';
import { PropertiesModule } from './modules/properties/properties.module.js';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    PrismaModule,
    StorageModule,
    HealthModule,
    AuthModule,
    AgentsModule,
    PropertiesModule,
    PortalsModule,
    LeadsModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule {}
