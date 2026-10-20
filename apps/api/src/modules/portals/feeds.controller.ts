import { Controller, Get, Headers, HttpStatus, Res } from '@nestjs/common';
import type { FeedStatusDto } from '@imob/shared';
import type { Response } from 'express';
import { Public } from '../../common/auth/auth.decorators.js';
import { FeedService } from './feed.service.js';

@Controller('feeds')
export class FeedsController {
  constructor(private readonly feeds: FeedService) {}

  /** Feed público lido pelos portais do Grupo OLX. */
  @Public()
  @Get('vrsync.xml')
  async vrsync(
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const feed = await this.feeds.getVrsyncFeed();
    res.setHeader('ETag', feed.etag);
    res.setHeader('Last-Modified', feed.publishedAt.toUTCString());
    res.setHeader('Cache-Control', 'public, max-age=300');
    if (ifNoneMatch === feed.etag) {
      res.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }
    res.type(feed.contentType).send(feed.xml);
  }

  @Get('vrsync/status')
  status(): Promise<FeedStatusDto> {
    return this.feeds.status();
  }
}
