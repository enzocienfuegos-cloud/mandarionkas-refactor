import type {
  AttributionWindowRow,
  CampaignPerformanceRow,
  CreativeRow,
  FrequencyBucketRow,
  IdentityTypeRow,
  Recommendation,
  RegionRow,
  ReportingKpi,
  ReportingMode,
  Tone,
  TrackerHealthRow,
  TrendSeries,
  VideoFormatRow,
  VideoFunnelRow,
} from './reporting.types';

const trendDates = ['Apr 29', 'Apr 30', 'May 01', 'May 02', 'May 03', 'May 04', 'May 05'];

function makeSparkline(seed: number[]) {
  return seed;
}

export const kpisByMode: Record<ReportingMode, ReportingKpi[]> = {
  all: [
    { id: 'impressions', label: 'Impressions', value: '8.4M', delta: '+12.4%', direction: 'up', comparisonLabel: 'vs previous period', tone: 'fuchsia', icon: 'impressions', sparkline: makeSparkline([22, 26, 29, 31, 36, 39, 42]) },
    { id: 'clicks', label: 'Clicks', value: '148K', delta: '+8.1%', direction: 'up', comparisonLabel: 'click volume', tone: 'fuchsia', icon: 'clicks', sparkline: makeSparkline([12, 13, 14, 14, 16, 17, 18]) },
    { id: 'ctr', label: 'CTR', value: '1.76%', delta: '+0.08%', direction: 'up', comparisonLabel: 'engagement rate', tone: 'violet', icon: 'ctr', sparkline: makeSparkline([1.4, 1.5, 1.45, 1.52, 1.6, 1.68, 1.76]) },
    { id: 'viewability', label: 'Viewability', value: '71.4%', delta: '+3.2%', direction: 'up', comparisonLabel: 'measured inventory', tone: 'blue', icon: 'viewability', sparkline: makeSparkline([61, 63, 64, 66, 68, 70, 71]) },
    { id: 'vcr', label: 'Video Completion Rate', value: '31.2%', delta: '+1.5%', direction: 'up', comparisonLabel: 'video funnel', tone: 'blue', icon: 'video', sparkline: makeSparkline([26, 27, 27, 28, 29, 30, 31]) },
    { id: 'match', label: 'Identity Match Rate', value: '48.0%', delta: '+2.0%', direction: 'up', comparisonLabel: 'resolved identities', tone: 'emerald', icon: 'identity', sparkline: makeSparkline([39, 41, 42, 43, 45, 46, 48]) },
    { id: 'attention', label: 'Engagement Attention', value: '18.4s', delta: '+7.8%', direction: 'up', comparisonLabel: 'avg active time', tone: 'amber', icon: 'attention', sparkline: makeSparkline([11, 12, 13, 14, 15, 17, 18]) },
    { id: 'campaigns', label: 'Active Campaigns', value: '24', delta: '+3', direction: 'up', comparisonLabel: 'currently live', tone: 'slate', icon: 'campaign', sparkline: makeSparkline([17, 18, 19, 20, 22, 23, 24]) },
  ],
  display: [
    { id: 'impressions', label: 'Impressions', value: '6.1M', delta: '+10.9%', direction: 'up', comparisonLabel: 'served display', tone: 'fuchsia', icon: 'impressions', sparkline: makeSparkline([16, 17, 19, 20, 23, 26, 28]) },
    { id: 'clicks', label: 'Clicks', value: '123K', delta: '+6.4%', direction: 'up', comparisonLabel: 'response volume', tone: 'fuchsia', icon: 'clicks', sparkline: makeSparkline([10, 11, 12, 12, 13, 14, 15]) },
    { id: 'ctr', label: 'CTR', value: '2.01%', delta: '+0.12%', direction: 'up', comparisonLabel: 'click efficiency', tone: 'violet', icon: 'ctr', sparkline: makeSparkline([1.7, 1.74, 1.79, 1.84, 1.9, 1.95, 2.01]) },
    { id: 'viewability', label: 'Viewability', value: '73.6%', delta: '+2.4%', direction: 'up', comparisonLabel: 'measured rate', tone: 'blue', icon: 'viewability', sparkline: makeSparkline([65, 66, 68, 69, 71, 72, 74]) },
    { id: 'attention', label: 'Attention Time', value: '16.8s', delta: '+5.3%', direction: 'up', comparisonLabel: 'avg active time', tone: 'amber', icon: 'attention', sparkline: makeSparkline([12, 12, 13, 14, 15, 16, 17]) },
    { id: 'engagement', label: 'Engagement Rate', value: '4.28%', delta: '+0.5%', direction: 'up', comparisonLabel: 'rich media events', tone: 'amber', icon: 'attention', sparkline: makeSparkline([3.2, 3.4, 3.6, 3.8, 4.0, 4.1, 4.28]) },
    { id: 'activeCampaigns', label: 'Active Campaigns', value: '18', delta: '+2', direction: 'up', comparisonLabel: 'display live', tone: 'slate', icon: 'campaign', sparkline: makeSparkline([13, 13, 14, 15, 16, 17, 18]) },
    { id: 'activeTags', label: 'Active Tags', value: '42', delta: '+5', direction: 'up', comparisonLabel: 'firing tags', tone: 'slate', icon: 'tag', sparkline: makeSparkline([31, 31, 33, 35, 37, 39, 42]) },
  ],
  video: [
    { id: 'starts', label: 'Video Starts', value: '24.5K', delta: '+9.7%', direction: 'up', comparisonLabel: 'started plays', tone: 'blue', icon: 'video', sparkline: makeSparkline([15, 16, 17, 19, 21, 23, 24]) },
    { id: 'q1', label: '25% Viewed', value: '17.4K', delta: '+8.9%', direction: 'up', comparisonLabel: 'first quartile', tone: 'blue', icon: 'video', sparkline: makeSparkline([10, 11, 12, 13, 14, 16, 17]) },
    { id: 'q2', label: '50% Viewed', value: '11.2K', delta: '+7.4%', direction: 'up', comparisonLabel: 'midpoint', tone: 'blue', icon: 'video', sparkline: makeSparkline([6, 7, 7, 8, 9, 10, 11]) },
    { id: 'q3', label: '75% Viewed', value: '7.8K', delta: '+6.1%', direction: 'up', comparisonLabel: 'third quartile', tone: 'blue', icon: 'video', sparkline: makeSparkline([4, 5, 5, 6, 6, 7, 8]) },
    { id: 'complete', label: 'Completions', value: '7.6K', delta: '+6.0%', direction: 'up', comparisonLabel: 'full views', tone: 'blue', icon: 'video', sparkline: makeSparkline([4, 4, 5, 5, 6, 7, 8]) },
    { id: 'completionRate', label: 'Completion Rate', value: '31.25%', delta: '+1.2%', direction: 'up', comparisonLabel: 'completion efficiency', tone: 'blue', icon: 'video', sparkline: makeSparkline([26, 27, 28, 29, 29, 30, 31]) },
    { id: 'watch', label: 'Avg. Watch Time', value: '14.2s', delta: '+3.6%', direction: 'up', comparisonLabel: 'per started play', tone: 'cyan', icon: 'attention', sparkline: makeSparkline([10, 10, 11, 12, 13, 14, 14]) },
    { id: 'events', label: 'Video Events', value: '61K', delta: '+11.9%', direction: 'up', comparisonLabel: 'captured signals', tone: 'slate', icon: 'tracker', sparkline: makeSparkline([30, 32, 35, 39, 44, 53, 61]) },
  ],
  identity: [
    { id: 'reach', label: 'Identity Reach', value: '224K', delta: '+13.0%', direction: 'up', comparisonLabel: 'resolved users', tone: 'emerald', icon: 'identity', sparkline: makeSparkline([101, 110, 128, 136, 170, 194, 224]) },
    { id: 'match', label: 'Match Rate', value: '48.0%', delta: '+2.0%', direction: 'up', comparisonLabel: 'resolvable events', tone: 'emerald', icon: 'identity', sparkline: makeSparkline([39, 40, 41, 43, 45, 46, 48]) },
    { id: 'unique', label: 'Unique Identities', value: '224K', delta: '+12.2%', direction: 'up', comparisonLabel: 'deduplicated ids', tone: 'emerald', icon: 'identity', sparkline: makeSparkline([105, 113, 124, 140, 172, 195, 224]) },
    { id: 'freq', label: 'Avg. Frequency', value: '5.2', delta: '-0.4', direction: 'down', comparisonLabel: 'per identity', tone: 'slate', icon: 'dashboard', sparkline: makeSparkline([6.1, 6.0, 5.8, 5.7, 5.5, 5.3, 5.2]) },
    { id: 'clicked', label: 'Clicked Users', value: '18.6K', delta: '+4.8%', direction: 'up', comparisonLabel: 'engaged cohort', tone: 'fuchsia', icon: 'clicks', sparkline: makeSparkline([11, 11, 12, 13, 14, 16, 18]) },
    { id: 'hf', label: 'High-Frequency Exposed', value: '11.4K', delta: '-3.1%', direction: 'down', comparisonLabel: 'overexposed users', tone: 'amber', icon: 'attention', sparkline: makeSparkline([16, 15, 15, 14, 13, 12, 11]) },
    { id: 'attrib', label: 'Attribution Windows', value: '3', delta: 'stable', direction: 'flat', comparisonLabel: 'configured models', tone: 'slate', icon: 'tracker', sparkline: makeSparkline([3, 3, 3, 3, 3, 3, 3]) },
    { id: 'exportable', label: 'Exportable Audiences', value: '5', delta: '+1', direction: 'up', comparisonLabel: 'activation ready', tone: 'emerald', icon: 'export', sparkline: makeSparkline([2, 2, 3, 3, 4, 4, 5]) },
  ],
};

export const trendSeriesByMode: Record<ReportingMode, TrendSeries[]> = {
  all: [
    { id: 'display', label: 'Display', channel: 'display', tone: 'fuchsia', points: trendDates.map((date, i) => ({ date, display: [320, 360, 402, 418, 455, 492, 530][i] })) },
    { id: 'video', label: 'Video', channel: 'video', tone: 'blue', points: trendDates.map((date, i) => ({ date, video: [120, 138, 146, 170, 182, 194, 210][i] })) },
    { id: 'identity', label: 'Identity', channel: 'identity', tone: 'emerald', points: trendDates.map((date, i) => ({ date, identity: [90, 110, 130, 148, 170, 182, 204][i] })) },
    { id: 'total', label: 'Total', tone: 'slate', dashed: true, points: trendDates.map((date, i) => ({ date, total: [530, 608, 678, 736, 807, 868, 944][i] })) },
  ],
  display: [
    { id: 'display', label: 'Display', channel: 'display', tone: 'fuchsia', points: trendDates.map((date, i) => ({ date, display: [320, 360, 402, 418, 455, 492, 530][i] })) },
    { id: 'previous', label: 'Previous period', tone: 'slate', dashed: true, points: trendDates.map((date, i) => ({ date, previous: [280, 300, 318, 347, 359, 384, 401][i] })) },
  ],
  video: [
    { id: 'video', label: 'Video', channel: 'video', tone: 'blue', points: trendDates.map((date, i) => ({ date, video: [120, 138, 146, 170, 182, 194, 210][i] })) },
    { id: 'previous', label: 'Previous period', tone: 'slate', dashed: true, points: trendDates.map((date, i) => ({ date, previous: [96, 110, 112, 132, 144, 151, 166][i] })) },
  ],
  identity: [
    { id: 'identity', label: 'Identity', channel: 'identity', tone: 'emerald', points: trendDates.map((date, i) => ({ date, identity: [90, 110, 130, 148, 170, 182, 204][i] })) },
    { id: 'previous', label: 'Previous period', tone: 'slate', dashed: true, points: trendDates.map((date, i) => ({ date, previous: [66, 75, 82, 94, 103, 111, 124][i] })) },
  ],
};

export const displayCampaignRows: CampaignPerformanceRow[] = [
  { id: 'cmp-01', name: 'Retail Prospecting Q2', status: 'active', impressions: 2140000, clicks: 49200, ctr: 2.3, viewability: 73.8 },
  { id: 'cmp-02', name: 'Credit Card Retargeting', status: 'limited', impressions: 1480000, clicks: 26800, ctr: 1.81, viewability: 69.2 },
  { id: 'cmp-03', name: 'Always-on Awareness', status: 'active', impressions: 980000, clicks: 12100, ctr: 1.23, viewability: 76.4 },
  { id: 'cmp-04', name: 'Travel Brand Summer Setup', status: 'draft', impressions: 0, clicks: 0, ctr: 0, viewability: 0 },
];

export const tagPerformanceRows: CampaignPerformanceRow[] = [
  { id: 'tag-01', name: 'Homepage takeover', status: 'active', impressions: 1400000, clicks: 19400, ctr: 1.39, viewability: 75.1 },
  { id: 'tag-02', name: 'Mid-article sticky', status: 'active', impressions: 1210000, clicks: 25410, ctr: 2.1, viewability: 78.3 },
  { id: 'tag-03', name: 'Ros placement mobile', status: 'limited', impressions: 820000, clicks: 11320, ctr: 1.38, viewability: 62.7 },
];

export const creativePerformanceRows: CampaignPerformanceRow[] = [
  { id: 'cr-01', name: 'Summer Sale HTML5', status: 'active', impressions: 1120000, clicks: 22100, ctr: 1.97, viewability: 74.5 },
  { id: 'cr-02', name: 'Card Rewards Carousel', status: 'active', impressions: 980000, clicks: 19450, ctr: 1.98, viewability: 72.1 },
  { id: 'cr-03', name: 'Q2 Retargeting Static', status: 'paused', impressions: 640000, clicks: 7020, ctr: 1.1, viewability: 66.9 },
];

export const topVideoCreatives: CreativeRow[] = [
  { name: '15s Prospecting Video', format: 'In-Stream', metric: '38.2% completion', helper: '9.6K starts · 14.1s avg watch' },
  { name: 'Outstream Promo Loop', format: 'Outstream', metric: '24.6% completion', helper: '6.2K starts · 8.4s avg watch' },
  { name: 'Rewarded Offer CTA', format: 'Rewarded', metric: '61.4% completion', helper: '3.2K starts · 21.3s avg watch' },
];

export const videoFunnelRows: VideoFunnelRow[] = [
  { id: 'starts', label: 'Starts', value: 24512, rate: 100 },
  { id: 'q1', label: '25% Viewed', value: 17450, rate: 71.2 },
  { id: 'q2', label: '50% Viewed', value: 11246, rate: 45.9 },
  { id: 'q3', label: '75% Viewed', value: 7820, rate: 31.9 },
  { id: 'complete', label: 'Completions', value: 7652, rate: 31.25 },
];

export const videoFormatRows: VideoFormatRow[] = [
  { id: 'in-stream', label: 'In-Stream', starts: 12842, percentage: 52.4, tone: 'blue' },
  { id: 'outstream', label: 'Outstream', starts: 6214, percentage: 25.3, tone: 'fuchsia' },
  { id: 'rewarded', label: 'Rewarded', starts: 3218, percentage: 13.1, tone: 'emerald' },
  { id: 'in-banner', label: 'In-Banner', starts: 2238, percentage: 9.2, tone: 'amber' },
];

export const identityTypeRows: IdentityTypeRow[] = [
  { key: 'device_id', value: 224160, percentage: 48 },
  { key: 'site_domain', value: 224160, percentage: 48 },
  { key: 'browser', value: 168120, percentage: 36 },
  { key: 'device_type', value: 112080, percentage: 24 },
  { key: 'email_sha256', value: 56040, percentage: 12 },
];

export const identityFrequencyBuckets: FrequencyBucketRow[] = [
  { bucket: '1 impression', identities: 14220, impressions: 14220, clicks: 0, ctr: '0.00%' },
  { bucket: '2-3 impressions', identities: 44320, impressions: 101200, clicks: 820, ctr: '0.81%' },
  { bucket: '4-5 impressions', identities: 31320, impressions: 141020, clicks: 1690, ctr: '1.20%' },
  { bucket: '11-20 impressions', identities: 11040, impressions: 165540, clicks: 3890, ctr: '2.35%' },
  { bucket: '21+ impressions', identities: 4120, impressions: 140340, clicks: 4210, ctr: '3.00%' },
];

export const attributionWindows: AttributionWindowRow[] = [
  { label: '1-day click', value: '14.2K users', helper: 'fast-response attribution' },
  { label: '7-day click', value: '21.8K users', helper: 'primary conversion window' },
  { label: '1-day view', value: '9.4K users', helper: 'assisted exposure signal' },
];

export const topRegionsRows: RegionRow[] = [
  { name: 'San Salvador', impressions: 2140000, ctr: '2.14%', share: '24%' },
  { name: 'Guatemala City', impressions: 1640000, ctr: '1.84%', share: '18%' },
  { name: 'San José', impressions: 1320000, ctr: '1.71%', share: '15%' },
  { name: 'Tegucigalpa', impressions: 1100000, ctr: '1.46%', share: '12%' },
];

export const topCreativesRows: CreativeRow[] = [
  { name: 'Summer Hero 970x250', format: 'Display', metric: '2.31% CTR', helper: '1.6M imps · 74% viewability' },
  { name: '15s Prospecting Video', format: 'Video', metric: '38.2% completion', helper: '9.6K starts · 14.1s avg watch' },
  { name: 'Retargeting HTML5', format: 'Display', metric: '1.92% CTR', helper: '910K imps · 71% viewability' },
];

export const trackerHealthRows: TrackerHealthRow[] = [
  { tracker: 'Display event ingestion', status: 'healthy', detail: '99.8% success · 2m latency' },
  { tracker: 'Video quartile beaconing', status: 'warning', detail: '2 placements missing midpoint events' },
  { tracker: 'Identity stitching batch', status: 'healthy', detail: 'last run completed 14m ago' },
  { tracker: 'Audience export sync', status: 'critical', detail: '1 pending activation file requires review' },
];

export const recommendationsByMode: Record<ReportingMode, Recommendation[]> = {
  all: [
    { id: 'rec-1', channel: 'display', severity: 'opportunity', title: 'Rotate low-viewability placements', body: 'Three large placements are pulling blended viewability down. Prioritize premium above-the-fold inventory.', actionLabel: 'Review placements', actionHref: '/reporting' },
    { id: 'rec-2', channel: 'video', severity: 'warning', title: 'Mid-funnel video drop-off is above target', body: '50% viewed and 75% viewed are falling faster than starts. Review format mix and autoplay settings.', actionLabel: 'Inspect video funnel', actionHref: '/reporting' },
    { id: 'rec-3', channel: 'identity', severity: 'info', title: 'Build an export for clicked users', body: 'Clicked users in the last 7 days have enough scale to activate into retargeting workflows.', actionLabel: 'Prepare export', actionHref: '/reporting' },
  ],
  display: [
    { id: 'display-1', channel: 'display', severity: 'warning', title: 'Two tags are underfiring', body: 'Tag delivery is trailing campaign pacing in mobile placements.', actionLabel: 'Open tag performance', actionHref: '/reporting' },
    { id: 'display-2', channel: 'display', severity: 'opportunity', title: 'Top domains can take incremental budget', body: 'High-viewability domains still have room before saturation.', actionLabel: 'Review domains', actionHref: '/reporting' },
  ],
  video: [
    { id: 'video-1', channel: 'video', severity: 'warning', title: 'Outstream starts are healthy but completions lag', body: 'Completion rate on outstream units is 8 points below in-stream. Consider shorter creative cuts.', actionLabel: 'Review formats', actionHref: '/reporting' },
    { id: 'video-2', channel: 'video', severity: 'critical', title: 'One tracker is missing quartile events', body: 'A subset of placements is not firing midpoint events consistently.', actionLabel: 'Open tracker health', actionHref: '/reporting' },
  ],
  identity: [
    { id: 'identity-1', channel: 'identity', severity: 'opportunity', title: 'Clicked users segment is export-ready', body: 'Audience has reached activation threshold for CRM and paid social workflows.', actionLabel: 'Export audience', actionHref: '/reporting' },
    { id: 'identity-2', channel: 'identity', severity: 'warning', title: 'High-frequency cohort is growing', body: 'Exposure beyond 20 impressions is increasing in two geos. Review suppression rules.', actionLabel: 'Inspect frequency', actionHref: '/reporting' },
  ],
};

export const toneOrder: Tone[] = ['fuchsia', 'violet', 'blue', 'cyan', 'emerald', 'amber', 'rose', 'slate'];
