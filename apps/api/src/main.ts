import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { APP_CONFIG, type AppConfig, loadRootEnvFile } from './common/config/env.js';

async function bootstrap(): Promise<void> {
  loadRootEnvFile();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.API_PORT);
}

void bootstrap();
