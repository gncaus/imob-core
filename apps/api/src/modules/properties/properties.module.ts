import { Module } from '@nestjs/common';
import { PropertiesController } from './properties.controller.js';
import { PropertiesService } from './properties.service.js';
import { PropertyPhotosController } from './property-photos.controller.js';
import { PropertyPhotosService } from './property-photos.service.js';

@Module({
  controllers: [PropertiesController, PropertyPhotosController],
  providers: [PropertiesService, PropertyPhotosService],
})
export class PropertiesModule {}
