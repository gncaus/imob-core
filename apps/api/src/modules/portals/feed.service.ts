import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { FeedStatusDto } from '@imob/shared';
import { APP_CONFIG, type AppConfig } from '../../common/config/env.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { PhotoStorage } from '../../common/storage/photo-storage.js';
import { photosInOrder } from '../properties/property.mapper.js';
import { type FeedCandidate, selectFeedListings } from './feed-selection.js';
import type { CompanyInfo } from './portal-feed-generator.js';
import { VrsyncFeedGenerator } from './vrsync/vrsync-feed.generator.js';

export interface GeneratedFeed {
  xml: string;
  etag: string;
  /** Quando o conteúdo mudou pela última vez (PublishDate e Last-Modified). */
  publishedAt: Date;
  contentType: string;
}

export const VRSYNC_FEED_PATH = '/feeds/vrsync.xml';

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);
  private readonly vrsync = new VrsyncFeedGenerator();
  private cached: { feed: GeneratedFeed; builtAt: number } | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PhotoStorage,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * O portal lê o feed a cada ~12 h: um cache curto mantém a resposta rápida. O ETag e o
   * PublishDate só mudam quando os anúncios mudam, então o arquivo é estável entre gerações.
   */
  async getVrsyncFeed(now = new Date()): Promise<GeneratedFeed> {
    const ttlMs = this.config.FEED_CACHE_TTL_SECONDS * 1000;
    if (this.cached && now.getTime() - this.cached.builtAt < ttlMs) return this.cached.feed;

    const selection = selectFeedListings(await this.loadCandidates(), this.vrsync.maxListings);
    const company = this.company();
    const hash = createHash('sha256')
      .update(JSON.stringify({ company, listings: selection.listings }))
      .digest('base64url');
    const etag = `"${hash}"`;
    const previous = this.cached?.feed;
    const publishedAt = previous?.etag === etag ? previous.publishedAt : now;

    const feed: GeneratedFeed = {
      xml: this.vrsync.generate({
        generatedAt: publishedAt,
        company,
        listings: selection.listings,
      }),
      etag,
      publishedAt,
      contentType: this.vrsync.contentType,
    };
    this.cached = { feed, builtAt: now.getTime() };
    this.logger.log(
      { included: selection.listings.length, excluded: selection.excluded.length },
      'Feed VRSync gerado',
    );
    return feed;
  }

  /** Sempre calculado na hora (sem cache): o painel mostra o estado atual dos imóveis. */
  async status(): Promise<FeedStatusDto> {
    const selection = selectFeedListings(await this.loadCandidates(), this.vrsync.maxListings);
    return {
      feedUrl: `${this.config.API_PUBLIC_URL}${VRSYNC_FEED_PATH}`,
      includedCount: selection.includedIds.length,
      included: selection.includedIds.map((id, index) => ({
        id,
        code: selection.listings[index]!.code,
        title: selection.listings[index]!.title,
      })),
      excluded: selection.excluded.map(({ candidate, issues }) => ({
        id: candidate.id,
        code: candidate.code,
        title: candidate.title,
        issues,
      })),
    };
  }

  private company(): CompanyInfo {
    return {
      name: this.config.COMPANY_NAME,
      email: this.config.COMPANY_EMAIL,
      phone: this.config.COMPANY_PHONE ?? null,
      website: this.config.COMPANY_WEBSITE ?? null,
    };
  }

  private async loadCandidates(): Promise<FeedCandidate[]> {
    const properties = await this.prisma.property.findMany({ include: { photos: photosInOrder } });
    return properties.map((property) => ({
      ...property,
      photos: property.photos.map((photo) => ({
        ...photo,
        url: this.storage.publicUrl(photo.storageKey),
      })),
    }));
  }
}
