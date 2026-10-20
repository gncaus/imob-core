import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  type LeadDto,
  type LeadListQuery,
  leadListQuerySchema,
  type MoveLeadData,
  moveLeadSchema,
  type SessionUser,
} from '@imob/shared';
import { CurrentUser } from '../../common/auth/auth.decorators.js';
import { UuidParamPipe } from '../../common/validation/uuid-param.pipe.js';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe.js';
import { LeadsService } from './leads.service.js';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(leadListQuerySchema)) query: LeadListQuery,
  ): Promise<LeadDto[]> {
    return this.leads.list(query);
  }

  @Patch(':id/queue')
  move(
    @Param('id', UuidParamPipe) id: string,
    @Body(new ZodValidationPipe(moveLeadSchema)) data: MoveLeadData,
    @CurrentUser() user: SessionUser,
  ): Promise<LeadDto> {
    return this.leads.move(id, data, user);
  }
}
