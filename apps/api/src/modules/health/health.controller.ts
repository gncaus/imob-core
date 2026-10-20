import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../../common/auth/auth.decorators.js';
import { HealthService, type HealthReport } from './health.service.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async check(): Promise<HealthReport> {
    const report = await this.health.check();
    if (report.status !== 'ok') throw new ServiceUnavailableException(report);
    return report;
  }
}
