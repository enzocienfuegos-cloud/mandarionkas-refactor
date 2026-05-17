import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadCreatives, loadTags, type Creative, type TagOption } from '../../../creatives/catalog';
import type { DateRange } from '../../../system';
import type {
  AttributionWindowRow,
  CampaignPerformanceRow,
  ConnectionBreakdownRow,
  CreativeRow,
  DeviceBreakdownRow,
  FrequencyBucketRow,
  IdentityTypeRow,
  InventorySourceRow,
  Recommendation,
  RegionRow,
  ReportingKpi,
  ReportingMode,
  SpendView,
  TrackerHealthRow,
  TrendSeries,
  VideoFormatRow,
  VideoFunnelRow,
} from '../reporting.types';

export type DateRangeFilter = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'custom';
export type TimeGranularity = 'day' | 'hour';
type StatusFilter = 'all' | 'active' | 'paused' | 'archived';

type WorkspaceStats = {
  total_impressions: number;
  total_clicks: number;
  total_spend: number;
  total_media_spend?: number;
  total_serving_fees?: number;
  total_margin?: number;
  total_spend_without_margin?: number;
  total_spend_with_margin?: number;
  total_viewable_impressions: number;
  total_measured_impressions: number;
  total_undetermined_impressions: number;
  measurable_rate: number;
  viewability_rate: number;
  avg_ctr: number;
  total_engagements: number;
  engagement_rate: number;
  total_hover_duration_ms: number;
  video_starts: number;
  video_first_quartile: number;
  video_midpoint: number;
  video_third_quartile: number;
  video_completions: number;
  video_completion_rate: number;
  total_in_view_duration_ms: number;
  total_identities: number;
  avg_identity_frequency: number;
  avg_identity_clicks: number;
  active_campaigns: number;
  active_tags: number;
  total_creatives: number;
};

type TimelineRow = {
  date: string;
  impressions: number;
  clicks: number;
  viewable_imps: number;
  measured_imps: number;
  undetermined_imps: number;
  ctr: number;
  viewability_rate: number;
};

type CampaignBreakdownRow = {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'archived' | 'draft';
  impressions: number;
  clicks: number;
  spend?: number;
  spend_without_margin?: number;
  spend_with_margin?: number;
  media_spend?: number;
  serving_fee_spend?: number;
  margin_spend?: number;
  viewable_imps?: number;
  measured_imps?: number;
  ctr: number;
  viewability_rate: number;
};

type TagBreakdownRow = CampaignBreakdownRow & {
  format?: string | null;
};

type CreativeBreakdownRow = CampaignBreakdownRow & {
  approval_status?: string;
  creative_type?: string | null;
  source_kind?: string | null;
  serving_format?: string | null;
  variant_id?: string | null;
  variant_label?: string | null;
  allocation_model?: string | null;
};

type RegionBreakdownRow = {
  region: string;
  impressions: number;
  viewability_rate: number;
};

type SiteBreakdownRow = {
  site_domain: string;
  impressions: number;
  clicks: number;
  ctr: number;
  viewability_rate: number;
};

type AppBreakdownRow = {
  app_name: string;
  app_bundle?: string | null;
  app_id?: string | null;
  app_store_name?: string | null;
  inventory_type?: string | null;
  impressions: number;
  clicks?: number;
  ctr?: number;
  viewability_rate: number;
};

type TrackerBreakdownRow = {
  name: string;
  tracker_type: string;
  impressions: number;
  clicks: number;
  ctr: number;
  campaign_name?: string | null;
};

type IdentityFrequencyApiRow = {
  bucket_label: string;
  identity_count: number;
  impressions: number;
  clicks: number;
  ctr: number;
};

type IdentitySegmentPresetRow = {
  preset: string;
  label: string;
  identity_count: number;
  impressions: number;
  clicks: number;
  engagements: number;
};

type IdentityKeyBreakdownRow = {
  key_type: string;
  event_type: string;
  key_observations: number;
  unique_values: number;
  identity_count: number;
};

type IdentityAttributionApiRow = {
  label: string;
  exposed_identities: number;
  clicked_identities: number;
  engaged_identities: number;
  click_through_rate: number;
  engagement_through_rate: number;
};

type ContextSnapshotRow = {
  latest_context: Record<string, unknown> | null;
  device_types: Array<{ label: string; value: number }>;
  device_models: Array<{ label: string; value: number }>;
  operating_systems: Array<{ label: string; value: number }>;
  browsers: Array<{ label: string; value: number }>;
  carriers: Array<{ label: string; value: number }>;
  networks: Array<{ label: string; value: number }>;
  connection_types: Array<{ label: string; value: number }>;
  effective_connection_types: Array<{ label: string; value: number }>;
  inventory_environments: Array<{ label: string; value: number }>;
};

type CampaignOption = {
  id: string;
  name?: string;
  status?: string;
  advertiser?: { id: string; name: string } | null;
};

type SelectOption = { value: string; label: string };

type ReportingPayloads = {
  workspacePayload: { stats: WorkspaceStats; timeline: TimelineRow[] };
  campaignPayload: { breakdown: CampaignBreakdownRow[] };
  tagPayload: { breakdown: TagBreakdownRow[] };
  creativePayload: { breakdown: CreativeBreakdownRow[] };
  variantPayload: { breakdown: CreativeBreakdownRow[] };
  regionPayload: { breakdown: RegionBreakdownRow[] };
  sitePayload: { breakdown: SiteBreakdownRow[] };
  appPayload: { breakdown: AppBreakdownRow[] };
  trackerPayload: { breakdown: TrackerBreakdownRow[] };
  identityFrequencyPayload: { breakdown: IdentityFrequencyApiRow[] };
  identitySegmentPayload: { breakdown: IdentitySegmentPresetRow[] };
  identityKeyPayload: { breakdown: IdentityKeyBreakdownRow[] };
  identityAttributionPayload: { breakdown: IdentityAttributionApiRow[] };
  contextSnapshotPayload: ContextSnapshotRow;
  campaignListPayload: { campaigns: CampaignOption[] };
  tags: TagOption[];
  creatives: Creative[];
};

type HookArgs = {
  mode: ReportingMode;
  dateRange: DateRangeFilter;
  customDateRange: DateRange;
  timeGranularity: TimeGranularity;
  timezone: string;
  advertiserId: string;
  campaignId: string;
  tagId: string;
  creativeId: string;
  statusFilter: StatusFilter;
  spendView: SpendView;
  search: string;
};

type HookState = {
  advertiserOptions: SelectOption[];
  campaignOptions: SelectOption[];
  tagOptions: SelectOption[];
  creativeOptions: SelectOption[];
  kpis: ReportingKpi[];
  trend: TrendSeries[];
  topCreatives: CreativeRow[];
  topRegions: RegionRow[];
  inventorySourceRows: InventorySourceRow[];
  rawInventorySourceRows: InventorySourceRow[];
  deviceRows: DeviceBreakdownRow[];
  connectionRows: ConnectionBreakdownRow[];
  trackerHealth: TrackerHealthRow[];
  identitySegments: IdentityTypeRow[];
  videoFunnel: VideoFunnelRow[];
  recommendations: Recommendation[];
  campaignRows: CampaignPerformanceRow[];
  tagRows: CampaignPerformanceRow[];
  creativeRows: CampaignPerformanceRow[];
  variantRows: CampaignPerformanceRow[];
  videoFormatRows: VideoFormatRow[];
  identityFrequencyRows: FrequencyBucketRow[];
  identityKeyRows: Array<{ label: string; value: string; helper: string }>;
  attributionWindowRows: AttributionWindowRow[];
  audienceExportRows: Array<{ label: string; value: string; helper: string }>;
  loading: boolean;
  error: string;
};

export type ReportingDataViewModel = Omit<
  HookState,
  'loading' | 'error' | 'advertiserOptions' | 'campaignOptions' | 'tagOptions' | 'creativeOptions' | 'kpis'
>;

export type ReportingReloadOptions = {
  force?: boolean;
  silent?: boolean;
};

const REPORTING_CACHE_TTL_MS = 60_000;
const REPORTING_AUTO_REFRESH_MS = 60_000;
const reportingPayloadCache = new Map<string, { timestamp: number; payloads: ReportingPayloads }>();
const EMPTY_CONTEXT_SNAPSHOT: ContextSnapshotRow = {
  latest_context: null,
  device_types: [],
  device_models: [],
  operating_systems: [],
  browsers: [],
  carriers: [],
  networks: [],
  connection_types: [],
  effective_connection_types: [],
  inventory_environments: [],
};

async function fetchReportingPayloads(query: string, expandedQuery: string): Promise<ReportingPayloads> {
  const [
    workspacePayload,
    campaignPayload,
    tagPayload,
    creativePayload,
    variantPayload,
    regionPayload,
    sitePayload,
    appPayload,
    trackerPayload,
    identityFrequencyPayload,
    identitySegmentPayload,
    identityKeyPayload,
    identityAttributionPayload,
    contextSnapshotPayload,
    campaignListPayload,
    tags,
    creatives,
  ] = await Promise.all([
    fetchJson<{ stats: WorkspaceStats; timeline: TimelineRow[] }>(`/v1/reporting/workspace${query}`),
    fetchOptionalJson<{ breakdown: CampaignBreakdownRow[] }>(`/v1/reporting/workspace/campaign-breakdown${query}`, { breakdown: [] }),
    fetchOptionalJson<{ breakdown: TagBreakdownRow[] }>(`/v1/reporting/workspace/tag-breakdown${query}`, { breakdown: [] }),
    fetchOptionalJson<{ breakdown: CreativeBreakdownRow[] }>(`/v1/reporting/workspace/creative-breakdown${query}`, { breakdown: [] }),
    fetchOptionalJson<{ breakdown: CreativeBreakdownRow[] }>(`/v1/reporting/workspace/variant-breakdown${query}`, { breakdown: [] }),
    fetchOptionalJson<{ breakdown: RegionBreakdownRow[] }>(`/v1/reporting/workspace/region-breakdown${query}`, { breakdown: [] }),
    fetchOptionalJson<{ breakdown: SiteBreakdownRow[] }>(`/v1/reporting/workspace/site-breakdown${expandedQuery}`, { breakdown: [] }),
    fetchOptionalJson<{ breakdown: AppBreakdownRow[] }>(`/v1/reporting/workspace/app-breakdown${expandedQuery}`, { breakdown: [] }),
    fetchOptionalJson<{ breakdown: TrackerBreakdownRow[] }>(`/v1/reporting/workspace/tracker-breakdown${query}`, { breakdown: [] }),
    fetchOptionalJson<{ breakdown: IdentityFrequencyApiRow[] }>(`/v1/reporting/workspace/identity-frequency-buckets${query}`, { breakdown: [] }),
    fetchOptionalJson<{ breakdown: IdentitySegmentPresetRow[] }>(`/v1/reporting/workspace/identity-segment-presets${query}`, { breakdown: [] }),
    fetchOptionalJson<{ breakdown: IdentityKeyBreakdownRow[] }>(`/v1/reporting/workspace/identity-key-breakdown${query}`, { breakdown: [] }),
    fetchOptionalJson<{ breakdown: IdentityAttributionApiRow[] }>(`/v1/reporting/workspace/identity-attribution-windows${query}`, { breakdown: [] }),
    fetchOptionalJson<ContextSnapshotRow>(`/v1/reporting/workspace/context-snapshot${query}`, EMPTY_CONTEXT_SNAPSHOT),
    fetchOptionalJson<{ campaigns: CampaignOption[] }>(`/v1/campaigns?scope=all&limit=500`, { campaigns: [] }),
    loadTags({ scope: 'all', limit: 500 }).catch(() => []),
    loadCreatives({ scope: 'all', limit: 500 }).catch(() => []),
  ]);

  return {
    workspacePayload,
    campaignPayload,
    tagPayload,
    creativePayload,
    variantPayload,
    regionPayload,
    sitePayload,
    appPayload,
    trackerPayload,
    identityFrequencyPayload,
    identitySegmentPayload,
    identityKeyPayload,
    identityAttributionPayload,
    contextSnapshotPayload,
    campaignListPayload,
    tags,
    creatives,
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload && typeof payload === 'object'
      ? (payload as { message?: string; error?: string }).message ?? (payload as { error?: string }).error
      : null;
    throw new Error(message || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

async function fetchOptionalJson<T>(url: string, fallback: T): Promise<T> {
  try {
    return await fetchJson<T>(url);
  } catch {
    return fallback;
  }
}

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

function formatDateInTimeZone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function shiftDateString(dateString: string, days: number) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function resolveDateRange(range: DateRangeFilter, timezone: string) {
  const today = formatDateInTimeZone(new Date(), timezone);
  if (range === 'today') return { dateFrom: today, dateTo: today };
  if (range === 'yesterday') {
    const yesterday = shiftDateString(today, -1);
    return { dateFrom: yesterday, dateTo: yesterday };
  }
  if (range === '7d') return { dateFrom: shiftDateString(today, -6), dateTo: today };
  if (range === '90d') return { dateFrom: shiftDateString(today, -89), dateTo: today };
  return { dateFrom: shiftDateString(today, -29), dateTo: today };
}

function formatDateParam(value: Date, timezone: string) {
  return formatDateInTimeZone(value, timezone);
}

function resolveEffectiveDateRange(range: DateRangeFilter, customDateRange: DateRange, timezone: string) {
  if (range !== 'custom') return resolveDateRange(range, timezone);
  if (customDateRange.from && customDateRange.to) {
    const from = customDateRange.from <= customDateRange.to ? customDateRange.from : customDateRange.to;
    const to = customDateRange.from <= customDateRange.to ? customDateRange.to : customDateRange.from;
    return {
      dateFrom: formatDateParam(from, timezone),
      dateTo: formatDateParam(to, timezone),
    };
  }
  return resolveDateRange('30d', timezone);
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value >= 100 ? 0 : 2 }).format(value);
}

function formatPercent(value: number, digits = 2) {
  return `${toNumber(value).toFixed(digits)}%`;
}

function resolveWorkspaceSpend(stats: WorkspaceStats, spendView: SpendView) {
  const withoutMargin = toNumber(stats.total_spend_without_margin ?? stats.total_spend);
  const withMargin = toNumber(stats.total_spend_with_margin ?? withoutMargin);
  return spendView === 'with_margin' ? withMargin : withoutMargin;
}

function resolveRowSpend(
  row: { spend?: unknown; spend_without_margin?: unknown; spend_with_margin?: unknown },
  spendView: SpendView,
) {
  const withoutMargin = toNumber(row.spend_without_margin ?? row.spend);
  const withMargin = toNumber(row.spend_with_margin ?? withoutMargin);
  return spendView === 'with_margin' ? withMargin : withoutMargin;
}

function formatDurationMs(value: number) {
  if (value <= 0) return '0s';
  const seconds = value / 1000;
  if (seconds >= 60) return `${(seconds / 60).toFixed(1)}m`;
  return `${seconds.toFixed(1)}s`;
}

function titleCase(value: string) {
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function seriesDelta(series: number[]): {
  delta?: string;
  direction?: ReportingKpi['direction'];
} {
  if (series.length < 2) return { delta: undefined, direction: undefined };
  const first = series[0] ?? 0;
  const last = series[series.length - 1] ?? 0;
  if (first === 0 && last === 0) return { delta: undefined, direction: undefined };
  if (first === 0) {
    return { delta: `+${last.toFixed(1)}`, direction: 'up' as const };
  }
  const raw = ((last - first) / Math.abs(first)) * 100;
  const direction = raw > 0.05 ? 'up' : raw < -0.05 ? 'down' : 'flat';
  const prefix = raw > 0 ? '+' : '';
  return { delta: `${prefix}${raw.toFixed(1)}%`, direction };
}

function statusFromApproval(status: string): CampaignPerformanceRow['status'] {
  if (status === 'approved' || status === 'active') return 'active';
  if (status === 'rejected' || status === 'archived') return 'archived';
  if (status === 'paused') return 'paused';
  if (status === 'pending_review') return 'limited';
  return 'draft';
}

function buildTrend(mode: ReportingMode, timeline: TimelineRow[], stats: WorkspaceStats): TrendSeries[] {
  const impressionsPoints = timeline.map((row) => ({ date: row.date, value: toNumber(row.impressions) }));
  const clicksPoints = timeline.map((row) => ({ date: row.date, value: toNumber(row.clicks) }));
  const ctrPoints = timeline.map((row) => ({ date: row.date, value: toNumber(row.ctr) }));
  const viewabilityPoints = timeline.map((row) => ({ date: row.date, value: toNumber(row.viewability_rate) }));

  if (mode === 'video') {
    return [
      { id: 'impressions', label: 'Video impressions', tone: 'blue', points: impressionsPoints },
      { id: 'ctr', label: 'CTR', tone: 'cyan', points: ctrPoints },
      { id: 'viewability', label: 'Viewability', tone: 'slate', dashed: true, points: viewabilityPoints },
    ];
  }
  if (mode === 'identity') {
    const identityCoverage = timeline.map((row) => ({
      date: row.date,
      value: toNumber(row.impressions) > 0 ? Number(((stats.total_identities / Math.max(stats.total_impressions, 1)) * 100).toFixed(2)) : 0,
    }));
    return [
      { id: 'impressions', label: 'Qualified impressions', tone: 'emerald', points: impressionsPoints },
      { id: 'ctr', label: 'CTR', tone: 'fuchsia', points: ctrPoints },
      { id: 'identityCoverage', label: 'Identity coverage', tone: 'slate', dashed: true, points: identityCoverage },
    ];
  }
  if (mode === 'display') {
    return [
      { id: 'impressions', label: 'Impressions', tone: 'fuchsia', points: impressionsPoints },
      { id: 'clicks', label: 'Clicks', tone: 'violet', points: clicksPoints },
      { id: 'viewability', label: 'Viewability', tone: 'slate', dashed: true, points: viewabilityPoints },
    ];
  }
  return [
    { id: 'impressions', label: 'Impressions', tone: 'fuchsia', points: impressionsPoints },
    { id: 'clicks', label: 'Clicks', tone: 'violet', points: clicksPoints },
    { id: 'viewability', label: 'Viewability', tone: 'blue', points: viewabilityPoints },
    { id: 'ctr', label: 'CTR', tone: 'emerald', dashed: true, points: ctrPoints },
  ];
}

function buildKpis(
  mode: ReportingMode,
  stats: WorkspaceStats,
  timeline: TimelineRow[],
  presets: IdentitySegmentPresetRow[],
  spendView: SpendView,
  periodScope: string,
): ReportingKpi[] {
  const impressionsSeries = timeline.map((row) => toNumber(row.impressions));
  const clicksSeries = timeline.map((row) => toNumber(row.clicks));
  const ctrSeries = timeline.map((row) => toNumber(row.ctr));
  const viewabilitySeries = timeline.map((row) => toNumber(row.viewability_rate));
  const clickedUsers = presets.find((row) => row.preset === 'clicked_users')?.identity_count ?? 0;
  const highFrequencyUsers = presets.find((row) => row.preset === 'high_frequency_exposed')?.identity_count ?? 0;
  const exportableAudiences = presets.filter((row) => row.identity_count > 0).length;
  const identityCoverage = stats.total_impressions > 0 ? (stats.total_identities / stats.total_impressions) * 100 : 0;
  const attentionDurationMs = Math.max(
    toNumber(stats.total_hover_duration_ms),
    toNumber(stats.total_in_view_duration_ms),
  );
  const spendValue = resolveWorkspaceSpend(stats, spendView);
  const spendHelper = spendView === 'with_margin'
    ? `${periodScope}. Includes ${formatMoney(toNumber(stats.total_margin))} margin on top of ${formatMoney(toNumber(stats.total_spend_without_margin ?? stats.total_spend))} net spend.`
    : `${periodScope}. Net of margin. Serving fees in scope: ${formatMoney(toNumber(stats.total_serving_fees))}.`;
  const spendKpi: ReportingKpi = {
    id: spendView === 'with_margin' ? 'spend-with-margin' : 'spend-without-margin',
    label: spendView === 'with_margin' ? 'Spend with margin' : 'Spend without margin',
    value: formatMoney(spendValue),
    rawValue: spendValue,
    tone: 'amber',
    icon: 'spend',
    helper: spendHelper,
  };

  const withDelta = (label: string, value: string, icon: string, tone: ReportingKpi['tone'], sparkline: number[], helper?: string): ReportingKpi => {
    const delta = seriesDelta(sparkline);
    return {
      id: label.toLowerCase().replace(/\s+/g, '-'),
      label,
      value,
      delta: delta.delta,
      direction: delta.direction,
      comparisonLabel: delta.delta ? 'vs start of range' : undefined,
      tone,
      icon,
      helper,
      sparkline: sparkline.length >= 2 ? sparkline : undefined,
    };
  };

  if (mode === 'display') {
    return [
      withDelta('Impressions', formatCount(stats.total_impressions), 'impressions', 'fuchsia', impressionsSeries, `${periodScope}. Served display inventory`),
      withDelta('Clicks', formatCount(stats.total_clicks), 'clicks', 'fuchsia', clicksSeries, `${periodScope}. Response volume`),
      withDelta('CTR', formatPercent(stats.avg_ctr), 'ctr', 'violet', ctrSeries, `${periodScope}. Click efficiency`),
      withDelta('Viewability', formatPercent(stats.viewability_rate), 'viewability', 'blue', viewabilitySeries, `${periodScope}. Measured delivery quality`),
      spendKpi,
      {
        id: 'attention-time',
        label: 'Attention time',
        value: formatDurationMs(attentionDurationMs),
        tone: 'amber',
        icon: 'attention',
        helper: `${periodScope}. Accumulated in-view or hover duration`,
      },
      {
        id: 'engagement-rate',
        label: 'Engagement rate',
        value: formatPercent(stats.engagement_rate),
        tone: 'amber',
        icon: 'attention',
        helper: `${periodScope}. Rich media interaction rate`,
      },
      {
        id: 'active-campaigns',
        label: 'Active campaigns',
        value: formatCount(stats.active_campaigns),
        tone: 'slate',
        icon: 'campaign',
        helper: `${periodScope}. Live display campaigns`,
      },
      {
        id: 'active-tags',
        label: 'Active tags',
        value: formatCount(stats.active_tags),
        tone: 'slate',
        icon: 'tag',
        helper: `${periodScope}. Firing tags in scope`,
      },
    ];
  }

  if (mode === 'video') {
    return [
      spendKpi,
      { id: 'video-starts', label: 'Video starts', value: formatCount(stats.video_starts), tone: 'blue', icon: 'video', helper: 'Started plays in range' },
      { id: 'video-q1', label: '25% viewed', value: formatCount(stats.video_first_quartile), tone: 'blue', icon: 'video', helper: 'First quartile beacons' },
      { id: 'video-q2', label: '50% viewed', value: formatCount(stats.video_midpoint), tone: 'blue', icon: 'video', helper: 'Midpoint beacons' },
      { id: 'video-q3', label: '75% viewed', value: formatCount(stats.video_third_quartile), tone: 'blue', icon: 'video', helper: 'Third quartile beacons' },
      { id: 'video-completions', label: 'Completions', value: formatCount(stats.video_completions), tone: 'blue', icon: 'video', helper: 'Completed video sessions' },
      { id: 'video-completion-rate', label: 'Completion rate', value: formatPercent(stats.video_completion_rate), tone: 'blue', icon: 'video', helper: 'Completion efficiency' },
      { id: 'avg-watch-time', label: 'Avg. watch time', value: formatDurationMs(stats.video_starts > 0 ? stats.total_in_view_duration_ms / stats.video_starts : 0), tone: 'cyan', icon: 'attention', helper: 'Average time in view per start' },
      { id: 'video-events', label: 'Video events', value: formatCount(stats.video_first_quartile + stats.video_midpoint + stats.video_third_quartile + stats.video_completions), tone: 'slate', icon: 'tracker', helper: 'Tracked quartile beacons' },
    ];
  }

  if (mode === 'identity') {
    return [
      { id: 'identity-reach', label: 'Identity reach', value: formatCount(stats.total_identities), tone: 'emerald', icon: 'identity', helper: 'Resolved identities in scope' },
      { id: 'identity-coverage', label: 'Identity coverage', value: formatPercent(identityCoverage), tone: 'emerald', icon: 'identity', helper: 'Identity volume vs impressions' },
      { id: 'unique-identities', label: 'Unique identities', value: formatCount(stats.total_identities), tone: 'emerald', icon: 'identity', helper: 'Deduplicated users' },
      { id: 'avg-frequency', label: 'Avg. frequency', value: stats.avg_identity_frequency.toFixed(2), tone: 'slate', icon: 'dashboard', helper: 'Impressions per identity' },
      { id: 'clicked-users', label: 'Clicked users', value: formatCount(clickedUsers), tone: 'fuchsia', icon: 'clicks', helper: 'Activation-ready click cohort' },
      { id: 'high-frequency-exposed', label: 'High-frequency exposed', value: formatCount(highFrequencyUsers), tone: 'amber', icon: 'attention', helper: 'Users above exposure threshold' },
      { id: 'attribution-windows', label: 'Attribution windows', value: '4', tone: 'slate', icon: 'tracker', helper: 'Configured recency buckets' },
      { id: 'exportable-audiences', label: 'Exportable audiences', value: formatCount(exportableAudiences), tone: 'emerald', icon: 'export', helper: 'Presets with exportable volume' },
    ];
  }

  return [
    withDelta('Impressions', formatCount(stats.total_impressions), 'impressions', 'fuchsia', impressionsSeries, 'Delivered across the selected range'),
    spendKpi,
    withDelta('Clicks', formatCount(stats.total_clicks), 'clicks', 'fuchsia', clicksSeries, 'Click volume'),
    withDelta('CTR', formatPercent(stats.avg_ctr), 'ctr', 'violet', ctrSeries, 'Cross-channel engagement rate'),
    withDelta('Viewability', formatPercent(stats.viewability_rate), 'viewability', 'blue', viewabilitySeries, 'Measured inventory quality'),
    { id: 'video-completion-rate', label: 'Video completion rate', value: formatPercent(stats.video_completion_rate), tone: 'blue', icon: 'video', helper: 'Completed started plays' },
    { id: 'identity-reach', label: 'Identity reach', value: formatCount(stats.total_identities), tone: 'emerald', icon: 'identity', helper: 'Resolved identity volume' },
    { id: 'engagement-rate', label: 'Engagement rate', value: formatPercent(stats.engagement_rate), tone: 'amber', icon: 'attention', helper: 'Rich media interaction rate' },
    { id: 'active-campaigns', label: 'Active campaigns', value: formatCount(stats.active_campaigns), tone: 'slate', icon: 'campaign', helper: 'Live campaigns in workspace' },
  ];
}

function buildRecommendations(mode: ReportingMode, stats: WorkspaceStats, trackerRows: TrackerHealthRow[], presets: IdentitySegmentPresetRow[]): Recommendation[] {
  const rows: Recommendation[] = [];

  if (stats.viewability_rate > 0 && stats.viewability_rate < 65) {
    rows.push({
      id: 'low-viewability',
      severity: 'warning',
      channel: mode === 'identity' ? undefined : 'display',
      title: 'Viewability is below target',
      body: `Measured viewability is at ${formatPercent(stats.viewability_rate)}, which suggests inventory or placement quality needs review.`,
      actionLabel: 'Review placements',
      actionHref: '/reporting',
    });
  }

  if ((mode === 'all' || mode === 'video') && stats.video_starts > 0 && stats.video_completion_rate < 30) {
    rows.push({
      id: 'video-dropoff',
      severity: 'warning',
      channel: 'video',
      title: 'Video drop-off is above target',
      body: `Completion rate is ${formatPercent(stats.video_completion_rate)}. Review autoplay conditions, duration, and format mix.`,
      actionLabel: 'Inspect video funnel',
      actionHref: '/reporting',
    });
  }

  const criticalTrackers = trackerRows.filter((row) => row.status === 'critical');
  if (criticalTrackers.length) {
    rows.push({
      id: 'tracker-critical',
      severity: 'critical',
      title: 'One or more trackers need review',
      body: criticalTrackers.map((row) => `${row.tracker}: ${row.detail}`).join(' · '),
      actionLabel: 'Open tracker health',
      actionHref: '/reporting',
    });
  }

  const clickedUsers = presets.find((row) => row.preset === 'clicked_users');
  if ((mode === 'all' || mode === 'identity') && clickedUsers && clickedUsers.identity_count > 0) {
    rows.push({
      id: 'clicked-users-ready',
      severity: 'opportunity',
      channel: 'identity',
      title: 'Clicked users are export-ready',
      body: `${formatCount(clickedUsers.identity_count)} users clicked within the selected range and can be activated into audience workflows.`,
      actionLabel: 'Prepare export',
      actionHref: '/reporting',
    });
  }

  if (!rows.length) {
    rows.push({
      id: 'stable-scope',
      severity: 'info',
      title: 'No urgent issues detected',
      body: 'The current reporting scope is stable. Use filters to inspect a narrower campaign, tag, or audience slice.',
    });
  }

  return rows.slice(0, 4);
}

function matchesStatus(status: CampaignPerformanceRow['status'], filter: StatusFilter) {
  if (filter === 'all') return true;
  return status === filter;
}

function matchesSearch(name: string, search: string) {
  if (!search.trim()) return true;
  return name.toLowerCase().includes(search.trim().toLowerCase());
}

function buildTrackerHealth(rows: TrackerBreakdownRow[]): TrackerHealthRow[] {
  return rows.slice(0, 4).map((row) => {
    const status: TrackerHealthRow['status'] = row.impressions === 0
      ? 'critical'
      : row.clicks === 0
        ? 'warning'
        : 'healthy';
    const detail = row.impressions === 0
      ? 'No tracked delivery in the selected range.'
      : row.clicks === 0
        ? `${formatCount(row.impressions)} impressions recorded but no click beacons fired.`
        : `${formatCount(row.impressions)} impressions · ${formatCount(row.clicks)} clicks · ${formatPercent(row.ctr)} CTR.`;
    return {
      tracker: titleCase(row.name),
      status,
      detail,
    };
  });
}

function buildInventorySourceRows({
  sites,
  apps,
  totalImpressions,
}: {
  sites: SiteBreakdownRow[];
  apps: AppBreakdownRow[];
  totalImpressions: number;
}): InventorySourceRow[] {
  const appRows = apps.map<InventorySourceRow>((row) => {
    const inventoryLabel = row.inventory_type === 'ctv_app' ? 'CTV app' : 'Mobile app';
    const storePlatform = String(row.app_store_name ?? '').trim();
    const detail = [row.app_bundle, row.app_id]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(' · ');
    return {
      kind: 'App',
      name: row.app_name || row.app_bundle || row.app_id || 'Unknown app',
      detail: detail || undefined,
      storePlatform: storePlatform || undefined,
      inventoryType: inventoryLabel,
      impressions: toNumber(row.impressions),
      clicks: toNumber(row.clicks),
      metric: toNumber(row.clicks) > 0 ? formatPercent(toNumber(row.ctr)) : formatPercent(toNumber(row.viewability_rate)),
      metricLabel: toNumber(row.clicks) > 0 ? 'CTR' : 'Viewability',
      share: totalImpressions > 0 ? formatPercent((toNumber(row.impressions) / totalImpressions) * 100, 1) : '0.0%',
    };
  });

  const siteRows = sites.map<InventorySourceRow>((row) => {
    const impressions = toNumber(row.impressions);
    const clicks = toNumber(row.clicks);
    return {
      kind: 'Domain',
      name: row.site_domain || 'Unknown domain',
      impressions,
      clicks,
      metric: formatPercent(toNumber(row.ctr)),
      metricLabel: 'CTR',
      share: totalImpressions > 0 ? formatPercent((impressions / totalImpressions) * 100, 1) : '0.0%',
    };
  });

  return [...appRows, ...siteRows]
    .sort((a, b) => (
      b.impressions - a.impressions
      || (b.clicks ?? 0) - (a.clicks ?? 0)
      || a.name.localeCompare(b.name)
    ));
}

function buildDeviceRows({
  deviceTypes,
  deviceModels,
  operatingSystems,
  browsers,
  totalImpressions,
}: {
  deviceTypes: Array<{ label: string; value: number }>;
  deviceModels: Array<{ label: string; value: number }>;
  operatingSystems: Array<{ label: string; value: number }>;
  browsers: Array<{ label: string; value: number }>;
  totalImpressions: number;
}): DeviceBreakdownRow[] {
  const toDeviceRow = (row: { label: string; value: number }, kind: DeviceBreakdownRow['kind']): DeviceBreakdownRow => {
    const impressions = toNumber(row.value);
    const label = String(row.label || 'Unknown').trim() || 'Unknown';
    return {
      kind,
      name: kind === 'Type' ? titleCase(label) : label,
      impressions,
      metric: formatCount(impressions),
      metricLabel: 'Impressions',
      share: totalImpressions > 0 ? formatPercent((impressions / totalImpressions) * 100, 1) : '0.0%',
    };
  };

  return [
    ...deviceTypes.map((row) => toDeviceRow(row, 'Type')),
    ...deviceModels
      .filter((row) => String(row.label ?? '').trim().toLowerCase() !== 'unknown')
      .map((row) => toDeviceRow(row, 'Model')),
    ...operatingSystems.map((row) => toDeviceRow(row, 'OS')),
    ...browsers
      .filter((row) => String(row.label ?? '').trim().toLowerCase() !== 'unknown')
      .map((row) => toDeviceRow(row, 'Browser')),
  ]
    .sort((a, b) => b.impressions - a.impressions || a.name.localeCompare(b.name))
    .slice(0, 8);
}

function buildConnectionRows({
  connectionTypes,
  effectiveConnectionTypes,
  carriers,
  networks,
  totalImpressions,
}: {
  connectionTypes: Array<{ label: string; value: number }>;
  effectiveConnectionTypes: Array<{ label: string; value: number }>;
  carriers: Array<{ label: string; value: number }>;
  networks: Array<{ label: string; value: number }>;
  totalImpressions: number;
}): ConnectionBreakdownRow[] {
  const toConnectionRow = (row: { label: string; value: number }, kind: ConnectionBreakdownRow['kind']): ConnectionBreakdownRow => {
    const impressions = toNumber(row.value);
    const label = String(row.label || 'Unknown').trim() || 'Unknown';
    return {
      kind,
      name: kind === 'Connection' || kind === 'Effective' ? titleCase(label) : label,
      impressions,
      metric: formatCount(impressions),
      metricLabel: 'Impressions',
      share: totalImpressions > 0 ? formatPercent((impressions / totalImpressions) * 100, 1) : '0.0%',
    };
  };

  return [
    ...connectionTypes
      .filter((row) => String(row.label ?? '').trim().toLowerCase() !== 'unknown')
      .map((row) => toConnectionRow(row, 'Connection')),
    ...effectiveConnectionTypes
      .filter((row) => String(row.label ?? '').trim().toLowerCase() !== 'unknown')
      .map((row) => toConnectionRow(row, 'Effective')),
    ...carriers
      .filter((row) => String(row.label ?? '').trim().toLowerCase() !== 'unknown')
      .map((row) => toConnectionRow(row, 'Carrier')),
    ...networks
      .filter((row) => String(row.label ?? '').trim().toLowerCase() !== 'unknown')
      .map((row) => toConnectionRow(row, 'Network')),
  ]
    .sort((a, b) => b.impressions - a.impressions || a.name.localeCompare(b.name))
    .slice(0, 8);
}

function buildSelectOptions(entries: Array<[string, SelectOption]>) {
  return Array.from(new Map<string, SelectOption>(entries).values())
    .sort((a, b) => a.label.localeCompare(b.label));
}

const INITIAL_STATE: HookState = {
  advertiserOptions: [],
  campaignOptions: [],
  tagOptions: [],
  creativeOptions: [],
  kpis: [],
  trend: [],
  topCreatives: [],
  topRegions: [],
  inventorySourceRows: [],
  rawInventorySourceRows: [],
  deviceRows: [],
  connectionRows: [],
  trackerHealth: [],
  identitySegments: [],
  videoFunnel: [],
  recommendations: [],
  campaignRows: [],
  tagRows: [],
  creativeRows: [],
  variantRows: [],
  videoFormatRows: [],
  identityFrequencyRows: [],
  identityKeyRows: [],
  attributionWindowRows: [],
  audienceExportRows: [],
  loading: true,
  error: '',
};

export function useReportingData({
  mode,
  dateRange,
  customDateRange,
  timeGranularity,
  timezone,
  advertiserId,
  campaignId,
  tagId,
  creativeId,
  statusFilter,
  spendView,
  search,
}: HookArgs) {
  const [state, setState] = useState<HookState>(INITIAL_STATE);
  const requestSequence = useRef(0);

  const effectiveDateRange = useMemo(
    () => resolveEffectiveDateRange(dateRange, customDateRange, timezone),
    [customDateRange, dateRange, timezone],
  );

  const query = useMemo(() => {
    const channel = mode === 'video'
      ? 'video'
      : mode === 'display'
        ? 'display'
        : undefined;
    return buildQuery({
      dateFrom: effectiveDateRange.dateFrom,
      dateTo: effectiveDateRange.dateTo,
      advertiserId: advertiserId || undefined,
      campaignId: campaignId || undefined,
      tagId: tagId || undefined,
      creativeId: creativeId || undefined,
      channel,
      granularity: timeGranularity,
      timezone,
    });
  }, [advertiserId, campaignId, creativeId, effectiveDateRange.dateFrom, effectiveDateRange.dateTo, mode, tagId, timeGranularity, timezone]);

  const reload = useCallback(async (options: ReportingReloadOptions = {}) => {
    const { force = false, silent = false } = options;
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;

    if (!silent) {
      setState((current) => ({ ...current, loading: true, error: '' }));
    } else {
      setState((current) => ({ ...current, error: '' }));
    }

    try {
      const expandedQuery = query ? `${query}&limit=100` : '?limit=100';
      const cachedPayloads = reportingPayloadCache.get(query);
      const payloads = !force && cachedPayloads && Date.now() - cachedPayloads.timestamp < REPORTING_CACHE_TTL_MS
        ? cachedPayloads.payloads
        : await fetchReportingPayloads(query, expandedQuery).then((nextPayloads) => {
          reportingPayloadCache.set(query, { timestamp: Date.now(), payloads: nextPayloads });
          return nextPayloads;
        });

      if (requestId !== requestSequence.current) return;

      const {
        workspacePayload,
        campaignPayload,
        tagPayload,
        creativePayload,
        variantPayload,
        regionPayload,
        sitePayload,
        appPayload,
        trackerPayload,
        identityFrequencyPayload,
        identitySegmentPayload,
        identityKeyPayload,
        identityAttributionPayload,
        contextSnapshotPayload,
        campaignListPayload,
        tags,
        creatives,
      } = payloads;

      const stats = workspacePayload.stats;
      const periodScope = effectiveDateRange.dateFrom === effectiveDateRange.dateTo
        ? 'Selected day total'
        : 'Selected range total';
      const timeline = workspacePayload.timeline ?? [];
      const campaignRows = (campaignPayload.breakdown ?? [])
        .map<CampaignPerformanceRow>((row) => ({
          id: row.id,
          name: row.name,
          status: row.status,
          impressions: toNumber(row.impressions),
          clicks: toNumber(row.clicks),
          ctr: toNumber(row.ctr),
          spend: resolveRowSpend(row, spendView),
          spendHelper: spendView === 'with_margin' ? 'Includes configured margin.' : 'Net of configured margin.',
          viewability: toNumber(row.viewability_rate),
        }))
        .filter((row) => matchesStatus(row.status, statusFilter) && matchesSearch(row.name, search));

      const tagRows = (tagPayload.breakdown ?? [])
        .map<CampaignPerformanceRow>((row) => ({
          id: row.id,
          name: row.format ? `${row.name} · ${row.format}` : row.name,
          status: row.status,
          impressions: toNumber(row.impressions),
          clicks: toNumber(row.clicks),
          ctr: toNumber(row.ctr),
          spend: resolveRowSpend(row, spendView),
          spendHelper: spendView === 'with_margin' ? 'Includes configured margin.' : 'Net of configured margin.',
          viewability: toNumber(row.viewability_rate),
        }))
        .filter((row) => matchesStatus(row.status, statusFilter) && matchesSearch(row.name, search));

      const creativeRowsFromBreakdown = (creativePayload.breakdown ?? [])
        .map<CampaignPerformanceRow>((row) => ({
          id: row.id,
          name: row.name,
          secondaryLabel: [row.creative_type, row.serving_format ?? row.source_kind].filter(Boolean).join(' · ') || undefined,
          status: statusFromApproval(String(row.approval_status ?? row.status ?? 'draft')),
          impressions: Math.round(toNumber(row.impressions)),
          clicks: Math.round(toNumber(row.clicks)),
          ctr: toNumber(row.ctr),
          spend: resolveRowSpend(row, spendView),
          spendHelper: row.allocation_model === 'event_hybrid'
            ? `Uses exact tracked creative events when available, with weighted fallback for unattributed delivery${spendView === 'with_margin' ? '. Includes configured margin.' : '.'}`
            : row.allocation_model === 'binding_weight'
              ? 'Estimated from tag delivery and creative binding weights.'
              : spendView === 'with_margin'
                ? 'Includes configured margin.'
                : 'Net of configured margin.',
          viewability: toNumber(row.viewability_rate),
        }))
        .filter((row) => matchesStatus(row.status, statusFilter) && matchesSearch(row.name, search));

      const creativeRows = creativeRowsFromBreakdown.length
        ? creativeRowsFromBreakdown.slice(0, 25)
        : creatives
          .map<CampaignPerformanceRow>((creative: Creative) => ({
            id: creative.id,
            name: creative.name,
            status: statusFromApproval(creative.approvalStatus),
            impressions: 0,
            clicks: 0,
            ctr: 0,
            completionRate: creative.format === 'vast_video' ? toNumber(creative.latestVersion?.durationMs) / 1000 : undefined,
          }))
          .filter((row) => matchesStatus(row.status, statusFilter) && matchesSearch(row.name, search))
          .slice(0, 25);

      const variantRows = (variantPayload.breakdown ?? [])
        .map<CampaignPerformanceRow>((row) => ({
          id: row.id,
          name: row.name,
          secondaryLabel: [row.variant_label || 'Default variant', row.serving_format ?? row.source_kind].filter(Boolean).join(' · '),
          status: statusFromApproval(String(row.approval_status ?? row.status ?? 'draft')),
          impressions: Math.round(toNumber(row.impressions)),
          clicks: Math.round(toNumber(row.clicks)),
          ctr: toNumber(row.ctr),
          spend: resolveRowSpend(row, spendView),
          spendHelper: row.allocation_model === 'event_hybrid'
            ? `Uses exact tracked variant events when available, with weighted fallback for unattributed delivery${spendView === 'with_margin' ? '. Includes configured margin.' : '.'}`
            : row.allocation_model === 'binding_weight'
              ? 'Estimated from tag delivery and variant binding weights.'
              : spendView === 'with_margin'
                ? 'Includes configured margin.'
                : 'Net of configured margin.',
          viewability: toNumber(row.viewability_rate),
        }))
        .filter((row) => matchesStatus(row.status, statusFilter) && matchesSearch(row.name, search))
        .slice(0, 25);

      const identitySegments = (identityKeyPayload.breakdown ?? [])
        .slice(0, 5)
        .map<IdentityTypeRow>((row) => ({
          key: row.key_type,
          value: toNumber(row.unique_values),
          percentage: stats.total_identities > 0 ? Number(((toNumber(row.identity_count) / stats.total_identities) * 100).toFixed(1)) : 0,
        }));

      const identityFrequencyRows = (identityFrequencyPayload.breakdown ?? []).map<FrequencyBucketRow>((row) => ({
        bucket: row.bucket_label,
        identities: toNumber(row.identity_count),
        impressions: toNumber(row.impressions),
        clicks: toNumber(row.clicks),
        ctr: formatPercent(toNumber(row.ctr)),
      }));

      const attributionWindowRows = (identityAttributionPayload.breakdown ?? []).map<AttributionWindowRow>((row) => ({
        label: row.label,
        value: `${formatCount(toNumber(row.clicked_identities))} clicked`,
        helper: `${formatCount(toNumber(row.exposed_identities))} exposed · ${formatPercent(toNumber(row.click_through_rate))} click-through`,
      }));

      const topRegions = (regionPayload.breakdown ?? [])
        .slice(0, 4)
        .map<RegionRow>((row) => ({
          name: row.region,
          impressions: toNumber(row.impressions),
          metric: formatPercent(toNumber(row.viewability_rate)),
          metricLabel: 'Viewability',
          share: stats.total_impressions > 0 ? formatPercent((toNumber(row.impressions) / stats.total_impressions) * 100, 1) : '0.0%',
        }));

      const inventorySourceRows = buildInventorySourceRows({
        sites: sitePayload.breakdown ?? [],
        apps: appPayload.breakdown ?? [],
        totalImpressions: toNumber(stats.total_impressions),
      });
      const rawInventorySourceRows = inventorySourceRows;
      const deviceRows = buildDeviceRows({
        deviceTypes: contextSnapshotPayload.device_types ?? [],
        deviceModels: contextSnapshotPayload.device_models ?? [],
        operatingSystems: contextSnapshotPayload.operating_systems ?? [],
        browsers: contextSnapshotPayload.browsers ?? [],
        totalImpressions: toNumber(stats.total_impressions),
      });
      const connectionRows = buildConnectionRows({
        connectionTypes: contextSnapshotPayload.connection_types ?? [],
        effectiveConnectionTypes: contextSnapshotPayload.effective_connection_types ?? [],
        carriers: contextSnapshotPayload.carriers ?? [],
        networks: contextSnapshotPayload.networks ?? [],
        totalImpressions: toNumber(stats.total_impressions),
      });

      const trackerHealth = buildTrackerHealth(trackerPayload.breakdown ?? []);

      const topCreatives = creativeRowsFromBreakdown.length
        ? creativeRowsFromBreakdown
          .slice()
          .sort((a, b) => (
            b.impressions - a.impressions
            || b.clicks - a.clicks
            || a.name.localeCompare(b.name)
          ))
          .slice(0, 12)
          .map<CreativeRow>((row) => ({
            name: row.name,
            format: row.secondaryLabel || 'Creative',
            impressions: row.impressions,
            clicks: row.clicks,
            ctr: row.ctr,
            metric: `${formatCount(row.impressions)} impressions`,
            helper: `${formatCount(row.clicks)} clicks · ${formatPercent(row.ctr)} CTR`,
          }))
        : creatives
          .filter((creative) => mode !== 'video' || creative.format === 'vast_video')
          .filter((creative) => mode !== 'display' || creative.format === 'display')
          .filter((creative) => matchesSearch(creative.name, search))
          .slice(0, 12)
          .map<CreativeRow>((creative) => ({
            name: creative.name,
            format: titleCase(creative.format),
            impressions: 0,
            clicks: 0,
            ctr: 0,
            metric: creative.approvalStatus.replace(/_/g, ' '),
            helper: creative.latestVersion?.width && creative.latestVersion?.height
              ? `${creative.latestVersion.width}x${creative.latestVersion.height} · ${creative.latestVersion.sourceKind}`
              : `${creative.latestVersion?.sourceKind ?? 'latest version'} · ${new Date(creative.createdAt).toLocaleDateString()}`,
          }));

      const inventoryTotal = (contextSnapshotPayload.inventory_environments ?? []).reduce((sum, row) => sum + toNumber(row.value), 0);
      const videoFormatRows = (contextSnapshotPayload.inventory_environments ?? [])
        .slice(0, 4)
        .map<VideoFormatRow>((row, index) => ({
          id: row.label,
          label: titleCase(row.label),
          starts: toNumber(row.value),
          percentage: inventoryTotal > 0 ? Number(((toNumber(row.value) / inventoryTotal) * 100).toFixed(1)) : 0,
          tone: (['blue', 'fuchsia', 'emerald', 'amber'] as const)[index] ?? 'slate',
        }));

      const videoFunnel: VideoFunnelRow[] = [
        { id: 'starts', label: 'Starts', value: stats.video_starts, rate: 100 },
        { id: 'q1', label: '25% viewed', value: stats.video_first_quartile, rate: stats.video_starts > 0 ? Number(((stats.video_first_quartile / stats.video_starts) * 100).toFixed(1)) : 0 },
        { id: 'q2', label: '50% viewed', value: stats.video_midpoint, rate: stats.video_starts > 0 ? Number(((stats.video_midpoint / stats.video_starts) * 100).toFixed(1)) : 0 },
        { id: 'q3', label: '75% viewed', value: stats.video_third_quartile, rate: stats.video_starts > 0 ? Number(((stats.video_third_quartile / stats.video_starts) * 100).toFixed(1)) : 0 },
        { id: 'complete', label: 'Completions', value: stats.video_completions, rate: stats.video_starts > 0 ? Number(((stats.video_completions / stats.video_starts) * 100).toFixed(2)) : 0 },
      ];

      const identityKeyRows = (identityKeyPayload.breakdown ?? [])
        .slice(0, 5)
        .map((row) => ({
          label: titleCase(row.key_type),
          value: formatCount(toNumber(row.unique_values)),
          helper: `${formatCount(toNumber(row.key_observations))} observations · ${formatCount(toNumber(row.identity_count))} identities`,
        }));

      const audienceExportRows = (identitySegmentPayload.breakdown ?? [])
        .map((row) => ({
          label: row.label,
          value: row.identity_count > 0 ? 'Export-ready' : 'Review',
          helper: `${formatCount(toNumber(row.identity_count))} identities · ${formatCount(toNumber(row.clicks))} clicks · ${formatCount(toNumber(row.impressions))} impressions · save as audience to persist`,
        }));

      const advertiserOptions = Array.from(
        new Map(
          (campaignListPayload.campaigns ?? [])
            .filter((campaign) => campaign.advertiser?.id && campaign.advertiser?.name)
            .map((campaign) => [campaign.advertiser!.id, { value: campaign.advertiser!.id, label: campaign.advertiser!.name }]),
        ).values(),
      ).sort((a, b) => a.label.localeCompare(b.label));
      const campaignOptions = buildSelectOptions([
        ...(campaignListPayload.campaigns ?? [])
          .filter((campaign) => campaign.id && campaign.name)
          .map<[string, SelectOption]>((campaign) => [campaign.id, { value: campaign.id, label: campaign.name! }]),
        ...(campaignPayload.breakdown ?? [])
          .filter((campaign) => campaign.id && campaign.name)
          .map<[string, SelectOption]>((campaign) => [campaign.id, { value: campaign.id, label: campaign.name }]),
      ]);
      const tagOptions = buildSelectOptions(
        [
          ...tags
            .filter((tag) => tag.id && tag.name)
            .map<[string, SelectOption]>((tag) => [
              tag.id,
              {
                value: tag.id,
                label: tag.format ? `${tag.name} · ${tag.format}` : tag.name,
              },
            ]),
          ...(tagPayload.breakdown ?? [])
            .filter((tag) => tag.id && tag.name)
            .map<[string, SelectOption]>((tag) => [
              tag.id,
              {
                value: tag.id,
                label: tag.format ? `${tag.name} · ${tag.format}` : tag.name,
              },
            ]),
        ],
      );
      const creativeOptions = buildSelectOptions([
        ...(creativePayload.breakdown ?? [])
          .filter((creative) => creative.id && creative.name)
          .map<[string, SelectOption]>((creative) => [creative.id, { value: creative.id, label: creative.name }]),
        ...creatives
          .filter((creative) => creative.id && creative.name)
          .map<[string, SelectOption]>((creative) => [creative.id, { value: creative.id, label: creative.name }]),
      ]);

      const kpis = buildKpis(mode, stats, timeline, identitySegmentPayload.breakdown ?? [], spendView, periodScope);
      const trend = buildTrend(mode, timeline, stats);
      const recommendations = buildRecommendations(mode, stats, trackerHealth, identitySegmentPayload.breakdown ?? []);

      if (requestId !== requestSequence.current) return;

      setState({
        advertiserOptions,
        campaignOptions,
        tagOptions,
        creativeOptions,
        kpis,
        trend,
        topCreatives,
        topRegions,
        inventorySourceRows: inventorySourceRows.slice(0, 12),
        rawInventorySourceRows,
        deviceRows,
        connectionRows,
        trackerHealth,
        identitySegments,
        videoFunnel,
        recommendations,
        campaignRows,
        tagRows,
        creativeRows,
        variantRows,
        videoFormatRows,
        identityFrequencyRows,
        identityKeyRows,
        attributionWindowRows,
        audienceExportRows,
        loading: false,
        error: '',
      });
    } catch (error) {
      if (requestId !== requestSequence.current) return;

      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load reporting workspace',
      }));
    }
  }, [mode, query, search, spendView, statusFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void reload({ force: true, silent: true });
    }, REPORTING_AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [reload]);

  return {
    ...state,
    reload,
  };
}
