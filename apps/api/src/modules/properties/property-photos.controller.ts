import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  type PropertyPhotoDto,
  type ReorderPhotosData,
  reorderPhotosSchema,
  type UpdatePhotoData,
  updatePhotoSchema,
} from '@imob/shared';
import { UuidParamPipe } from '../../common/validation/uuid-param.pipe.js';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe.js';
import { PHOTO_MAX_BYTES } from './portal-readiness.js';
import { PropertyPhotosService } from './property-photos.service.js';

@Controller('properties/:propertyId/photos')
export class PropertyPhotosController {
  constructor(private readonly photos: PropertyPhotosService) {}

  /** Upload multipart no campo `file`. Acima de 7 MB o multer recusa com 413. */
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: PHOTO_MAX_BYTES, files: 1 } }))
  upload(
    @Param('propertyId', UuidParamPipe) propertyId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<PropertyPhotoDto> {
    return this.photos.upload(propertyId, file);
  }

  @Put('order')
  reorder(
    @Param('propertyId', UuidParamPipe) propertyId: string,
    @Body(new ZodValidationPipe(reorderPhotosSchema)) data: ReorderPhotosData,
  ): Promise<PropertyPhotoDto[]> {
    return this.photos.reorder(propertyId, data);
  }

  @Patch(':photoId')
  update(
    @Param('propertyId', UuidParamPipe) propertyId: string,
    @Param('photoId', UuidParamPipe) photoId: string,
    @Body(new ZodValidationPipe(updatePhotoSchema)) data: UpdatePhotoData,
  ): Promise<PropertyPhotoDto> {
    return this.photos.update(propertyId, photoId, data);
  }

  @Delete(':photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('propertyId', UuidParamPipe) propertyId: string,
    @Param('photoId', UuidParamPipe) photoId: string,
  ): Promise<void> {
    return this.photos.remove(propertyId, photoId);
  }
}
