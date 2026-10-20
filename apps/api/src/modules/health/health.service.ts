import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';

type CheckStatus = 'up' | 'down';

export interface HealthReport {
  status: 'ok' | 'error';
  checks: { database: CheckStatus };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthReport> {
    const database = await this.checkDatabase();
    return { status: database === 'up' ? 'ok' : 'error', checks: { database } };
  }

  private async checkDatabase(): Promise<CheckStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch (error) {
      this.logger.error({ err: error }, 'Healthcheck do banco falhou');
      return 'down';
    }
  }
}
