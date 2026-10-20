import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

/** Configuração HTTP comum ao servidor real e aos testes e2e. */
export function configureApp(app: INestApplication): void {
  app.use(cookieParser());
  app.enableShutdownHooks();
}
