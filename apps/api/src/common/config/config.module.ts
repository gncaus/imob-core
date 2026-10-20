import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, parseConfig } from './env.js';

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => parseConfig(process.env) }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
