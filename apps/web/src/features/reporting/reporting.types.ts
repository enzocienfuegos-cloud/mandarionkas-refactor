export type ReportingMode = 'all' | 'display' | 'video' | 'identity';
export type SpendView = 'without_margin' | 'with_margin';

export type Channel = 'display' | 'video' | 'identity';

export type Tone =
  | 'fuchsia'
  | 'violet'
  | 'blue'
  | 'cyan'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'slate';

export type MetricDirection = 'up' | 'down' | 'flat';

export type WidgetSize = 'small' | 'medium' | 'large' | 'wide' | 'full';

export type WidgetType =
  | 'trend'
  | 'displayTable'
  | 'campaignPerformance'
  | 'tagPerformance'
  | 'creativePerformance'
  | 'variantPerformance'
  | 'videoFunnel'
  | 'videoFormat'
  | 'identityInsights'
  | 'identityFrequency'
  | 'identityKeys'
  | 'identityAttribution'
  | 'audienceExport'
  | 'inventorySources'
  | 'topRegions'
  | 'topCreatives'
  | 'trackerHealth'
  | 'recommendations'
  | 'dataTable';

export type ReportingKpi = {
  id: string;
  label: string;
  value: string;
  rawValue?: number;
  delta?: string;
  direction?: MetricDirection;
  helper?: string;
  comparisonLabel?: string;
  tone: Tone;
  icon: string;
  sparkline?: number[];
};

export type WidgetConfig = {
  id: string;
  type: WidgetType;
  title: string;
  description?: string;
  icon?: string;
  tone?: Tone;
  size: WidgetSize;
  order: number;
  defaultVisible: boolean;
  visibleIn: ReportingMode[];
};

export type ReportingModeConfig = {
  id: ReportingMode;
  label: string;
  title: string;
  subtitle: string;
  accent: Tone;
  widgets: WidgetConfig[];
};

export type TrendPoint = {
  date: string;
  value?: number;
  display?: number;
  video?: number;
  identity?: number;
  total?: number;
  previous?: number;
};

export type TrendSeries = {
  id: string;
  label: string;
  channel?: Channel;
  tone: Tone;
  dashed?: boolean;
  points: TrendPoint[];
};

export type CampaignPerformanceRow = {
  id: string;
  name: string;
  status: 'active' | 'draft' | 'paused' | 'limited' | 'archived';
  impressions: number;
  clicks: number;
  ctr: number;
  spend?: number;
  spendHelper?: string;
  secondaryLabel?: string;
  viewability?: number;
  completionRate?: number;
  identityReach?: number;
};

export type VideoFunnelRow = {
  id: string;
  label: string;
  value: number;
  rate: number;
};

export type VideoFormatRow = {
  id: string;
  label: string;
  starts: number;
  percentage: number;
  tone: Tone;
};

export type IdentityTypeRow = {
  key: string;
  value: number;
  percentage: number;
};

export type FrequencyBucketRow = {
  bucket: string;
  identities: number;
  impressions: number;
  clicks: number;
  ctr: string;
};

export type AttributionWindowRow = {
  label: string;
  value: string;
  helper: string;
};

export type RegionRow = {
  name: string;
  impressions: number;
  metric: string;
  metricLabel?: string;
  share: string;
};

export type InventorySourceRow = RegionRow & {
  kind: 'Domain' | 'App';
  detail?: string;
};

export type CreativeRow = {
  name: string;
  format: string;
  metric: string;
  helper: string;
};

export type TrackerHealthRow = {
  tracker: string;
  status: 'healthy' | 'warning' | 'critical';
  detail: string;
};

export type Recommendation = {
  id: string;
  channel?: Channel;
  severity: 'info' | 'opportunity' | 'warning' | 'critical';
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
};
