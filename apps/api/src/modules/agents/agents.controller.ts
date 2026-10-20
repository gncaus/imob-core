import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  type AgentDto,
  type AgentListQuery,
  agentListQuerySchema,
  type CreateAgentData,
  createAgentSchema,
  type UpdateAgentData,
  updateAgentSchema,
} from '@imob/shared';
import { Roles } from '../../common/auth/auth.decorators.js';
import { UuidParamPipe } from '../../common/validation/uuid-param.pipe.js';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe.js';
import { AgentsService } from './agents.service.js';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(agentListQuerySchema)) query: AgentListQuery,
  ): Promise<AgentDto[]> {
    return this.agents.list(query);
  }

  @Get(':id')
  get(@Param('id', UuidParamPipe) id: string): Promise<AgentDto> {
    return this.agents.get(id);
  }

  @Roles('ADMIN')
  @Post()
  create(@Body(new ZodValidationPipe(createAgentSchema)) data: CreateAgentData): Promise<AgentDto> {
    return this.agents.create(data);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(
    @Param('id', UuidParamPipe) id: string,
    @Body(new ZodValidationPipe(updateAgentSchema)) data: UpdateAgentData,
  ): Promise<AgentDto> {
    return this.agents.update(id, data);
  }

  @Roles('ADMIN')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', UuidParamPipe) id: string): Promise<void> {
    return this.agents.remove(id);
  }
}
