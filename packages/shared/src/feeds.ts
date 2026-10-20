import type { PortalReadinessIssue } from './properties.js';

export interface FeedPropertyRef {
  id: string;
  code: string;
  title: string;
}

/** Situação do feed para a página "Feed" do painel. */
export interface FeedStatusDto {
  feedUrl: string;
  includedCount: number;
  included: FeedPropertyRef[];
  excluded: (FeedPropertyRef & { issues: PortalReadinessIssue[] })[];
}
