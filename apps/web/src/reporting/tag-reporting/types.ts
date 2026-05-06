export interface Tag {
  id: string;
  name: string;
  format: string;
}

export interface TagBindingOption {
  id: string;
  creativeId: string;
  creativeVersionId: string;
  creativeSizeVariantId: string;
  creativeName: string;
  variantLabel: string;
  variantWidth: number | null;
  variantHeight: number | null;
  status: string;
}

export interface TagContextSnapshot {
  siteDomain: string;
  pageUrl: string;
  country: string;
  region: string;
  city: string;
  deviceType: string;
  deviceModel: string;
  browser: string;
  os: string;
  contextualIds: string;
  networkId: string;
  sourcePublisherId: string;
  appId: string;
  siteId: string;
  exchangeId: string;
  exchangePublisherId: string;
  exchangeSiteIdOrDomain: string;
  appBundle: string;
  appName: string;
  pagePosition: string;
  contentLanguage: string;
  contentTitle: string;
  contentSeries: string;
  carrier: string;
  appStoreName: string;
  contentGenre: string;
}

export interface TagSummary {
  totalImpressions: number;
  totalClicks: number;
  ctr: number;
  viewabilityRate: number;
  engagementRate: number;
  totalInViewDurationMs: number;
  totalAttentionDurationMs: number;
  impressionsLast7d: number;
  uniqueIdentities: number;
  avgFrequency: number;
  videoStarts: number;
  videoStartRate: number;
  videoCompletions: number;
  videoCompletionRate: number;
  latestContext: TagContextSnapshot | null;
}

export type ReportingTab = 'display' | 'video' | 'identity';

export interface DailyStat {
  date: string;
  impressions: number;
  clicks: number;
  videoStarts: number;
  videoCompletions: number;
}
