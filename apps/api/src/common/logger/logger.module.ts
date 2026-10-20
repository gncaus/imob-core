import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { APP_CONFIG, type AppConfig } from '../config/env.js';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.LOG_LEVEL,
          // Credenciais e cookies nunca vão para o log.
          redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
          transport:
            config.NODE_ENV === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          autoLogging: { ignore: (req) => req.url === '/health' },
        },
      }),
    }),
  ],
})
export class LoggerModule {}
