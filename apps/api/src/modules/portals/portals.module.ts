import { Module } from '@nestjs/common';
import { FeedService } from './feed.service.js';
import { FeedsController } from './feeds.controller.js';

@Module({
  controllers: [FeedsController],
  providers: [FeedService],
})
export class PortalsModule {}
