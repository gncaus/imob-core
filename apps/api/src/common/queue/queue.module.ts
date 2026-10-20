import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/env.js';
import { redisConnectionOptions } from './redis-connection.js';

/** Conexão do BullMQ com o Redis, compartilhada por todas as filas. */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        connection: redisConnectionOptions(config.REDIS_URL),
        prefix: config.QUEUE_PREFIX,
      }),
    }),
  ],
})
export class QueueModule {}
