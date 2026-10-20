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
  type CreatePropertyData,
  createPropertySchema,
  type PropertyDto,
  type PropertyListQuery,
  propertyListQuerySchema,
  type PropertySummaryDto,
  type UpdatePropertyData,
  updatePropertySchema,
} from '@imob/shared';
import { Roles } from '../../common/auth/auth.decorators.js';
import { UuidParamPipe } from '../../common/validation/uuid-param.pipe.js';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe.js';
import { PropertiesService } from './properties.service.js';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(propertyListQuerySchema)) query: PropertyListQuery,
  ): Promise<PropertySummaryDto[]> {
    return this.properties.list(query);
  }

  @Get(':id')
  get(@Param('id', UuidParamPipe) id: string): Promise<PropertyDto> {
    return this.properties.get(id);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createPropertySchema)) data: CreatePropertyData,
  ): Promise<PropertyDto> {
    return this.properties.create(data);
  }

  @Patch(':id')
  update(
    @Param('id', UuidParamPipe) id: string,
    @Body(new ZodValidationPipe(updatePropertySchema)) data: UpdatePropertyData,
  ): Promise<PropertyDto> {
    return this.properties.update(id, data);
  }

  @Roles('ADMIN')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', UuidParamPipe) id: string): Promise<void> {
    return this.properties.remove(id);
  }
}
