import React, { useEffect, useMemo, useState } from 'react';

type DateRange = 7 | 30 | 90;
type RangeMode = 'preset' | 'custom';
type IdentityTypeFilter = '' | 'external_user_id' | 'device_id' | 'cookie_id';
type IdentitySegmentPreset = '' | 'high_frequency_exposed' | 'clicked_users' | 'engaged_non_clickers';
type IdentityExportFormat =
  | 'full'
  | 'activation'
  | 'click_ids'
  | 'meta_click_ids'
  | 'google_click_ids'
  | 'tiktok_click_ids'
  | 'microsoft_click_ids';
type ChartGrain = 'day' | 'week' | 'month';
type ChartMetric = 'impressions' | 'clicks' | 'ctr' | 'viewabilityRate';
type PrimaryKpiId =
  | 'impressions'
  | 'clicks'
  | 'spend'
  | 'ctr'
  | 'viewability'
  | 'engagements'
  | 'engagementRate'
  | 'attentionTime'
  | 'inViewTime';
type SecondaryKpiId =
  | 'activeCampaigns'
  | 'activeTags'
  | 'creatives'
  | 'measurableRate'
  | 'identities';
type ReportModuleId =
  | 'primaryKpis'
  | 'secondaryKpis'
  | 'performanceTrend'
  | 'topInsights'
  | 'audienceLibrary'
  | 'regionalInsights'
  | 'trackerPerformance'
  | 'identityFrequency'
  | 'identityAttribution'
  | 'identityKeys'
  | 'campaignTagBreakdowns'
  | 'creativeBreakdowns';

interface RankedMetric {
  label: string;
  value: number;
  secondary?: string;
}

interface TimelinePoint {
  date: string;
  impressions: number;
  clicks: number;
  viewableImps: number;
  measuredImps: number;
  ctr: number;
  viewabilityRate: number;
}

interface BreakdownItem {
  id?: string;
  label: string;
  secondary?: string;
  tertiary?: string;
  impressions: number;
  clicks: number;
  ctr: number;
  uniqueIdentities?: number;
  avgFrequency?: number;
  viewableImpressions?: number;
  measuredImpressions?: number;
  undeterminedImpressions?: number;
  viewabilityRate?: number;
}

interface VariantItem {
  id: string;
  creativeName: string;
  label: string;
  size: string;
  status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  uniqueIdentities?: number;
  avgFrequency?: number;
}

interface SavedAudience {
  id: string;
  name: string;
  canonicalType: IdentityTypeFilter | '';
  country: string;
  siteDomain: string;
  region: string;
  city: string;
  segmentPreset: IdentitySegmentPreset | '';
  activationTemplate: IdentityExportFormat;
  campaignId: string;
  tagId: string;
  creativeId: string;
  variantId: string;
  minImpressions: number;
  minClicks: number;
}

interface AudiencePresetMetric extends RankedMetric {
  presetValue: IdentitySegmentPreset;
}

interface WorkspaceAnalytics {
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  totalViewableImpressions: number;
  totalMeasuredImpressions: number;
  totalUndeterminedImpressions: number;
  measurableRate: number;
  viewabilityRate: number;
  avgCtr: number;
  totalEngagements: number;
  engagementRate: number;
  totalHoverDurationMs: number;
  totalInViewDurationMs: number;
  totalIdentities: number;
  avgIdentityFrequency: number;
  avgIdentityClicks: number;
  activeCampaigns: number;
  activeTags: number;
  totalCreatives: number;
  campaigns: BreakdownItem[];
  tags: BreakdownItem[];
  creatives: BreakdownItem[];
  variants: VariantItem[];
  topSites: RankedMetric[];
  topCountries: RankedMetric[];
  topRegions: RankedMetric[];
  topCities: RankedMetric[];
  trackerPerformance: RankedMetric[];
  topIdentities: RankedMetric[];
  identityFrequency: RankedMetric[];
  identitySegments: RankedMetric[];
  identityKeyBreakdown: RankedMetric[];
  identityAttribution: RankedMetric[];
  engagements: RankedMetric[];
  savedAudiences: SavedAudience[];
  audiencePresets: AudiencePresetMetric[];
  timeline: TimelinePoint[];
}

const DATE_RANGES: DateRange[] = [7, 30, 90];
const IDENTITY_FILTERS: Array<{ value: IdentityTypeFilter; label: string }> = [
  { value: '', label: 'All identities' },
  { value: 'external_user_id', label: 'External user ID' },
  { value: 'device_id', label: 'Device ID' },
  { value: 'cookie_id', label: 'Cookie ID' },
];
const IDENTITY_SEGMENT_PRESETS: Array<{ value: IdentitySegmentPreset; label: string }> = [
  { value: '', label: 'Custom audience' },
  { value: 'high_frequency_exposed', label: 'High-frequency exposed' },
  { value: 'clicked_users', label: 'Clicked users' },
  { value: 'engaged_non_clickers', label: 'Engaged non-clickers' },
];
const IDENTITY_EXPORT_FORMATS: Array<{ value: IdentityExportFormat; label: string }> = [
  { value: 'full', label: 'Full export' },
  { value: 'activation', label: 'Activation export' },
  { value: 'click_ids', label: 'Click IDs only' },
  { value: 'meta_click_ids', label: 'Meta click IDs' },
  { value: 'google_click_ids', label: 'Google click IDs' },
  { value: 'tiktok_click_ids', label: 'TikTok click IDs' },
  { value: 'microsoft_click_ids', label: 'Microsoft click IDs' },
];
const CHART_GRAINS: Array<{ value: ChartGrain; label: string }> = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];
const PRIMARY_KPI_ORDER_DEFAULT: PrimaryKpiId[] = [
  'impressions',
  'clicks',
  'spend',
  'ctr',
  'viewability',
  'engagements',
  'engagementRate',
  'attentionTime',
  'inViewTime',
];
const SECONDARY_KPI_ORDER_DEFAULT: SecondaryKpiId[] = [
  'activeCampaigns',
  'activeTags',
  'creatives',
  'measurableRate',
  'identities',
];
const REPORT_MODULE_ORDER_DEFAULT: ReportModuleId[] = [
  'primaryKpis',
  'secondaryKpis',
  'performanceTrend',
  'topInsights',
  'audienceLibrary',
  'regionalInsights',
  'trackerPerformance',
  'identityFrequency',
  'identityAttribution',
  'identityKeys',
  'campaignTagBreakdowns',
  'creativeBreakdowns',
];
const PRIMARY_KPI_STORAGE_KEY = 'smx-reporting-primary-kpi-order-v1';
const SECONDARY_KPI_STORAGE_KEY = 'smx-reporting-secondary-kpi-order-v1';
const MODULE_STORAGE_KEY = 'smx-reporting-module-order-v1';
const REPORTING_LAYOUT_PREFERENCE_KEY = 'reportingLayout';

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function fmtNum(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtCtr(value: number): string {
  return `${toNumber(value).toFixed(2)}%`;
}

function fmtSecondsFromMs(value: number): string {
  const seconds = toNumber(value) / 1000;
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(2)}h`;
  if (seconds >= 60) return `${(seconds / 60).toFixed(1)}m`;
  return `${seconds.toFixed(1)}s`;
}

function readStoredOrder<T extends string>(storageKey: string, fallback: T[]): T[] {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    const allowed = new Set(fallback);
    const normalized = parsed.filter((item): item is T => typeof item === 'string' && allowed.has(item as T));
    const missing = fallback.filter((item) => !normalized.includes(item));
    return normalized.length ? [...normalized, ...missing] : fallback;
  } catch {
    return fallback;
  }
}

function normalizeExplicitOrder<T extends string>(candidate: unknown, fallback: T[]): T[] {
  if (!Array.isArray(candidate)) return fallback;
  const allowed = new Set(fallback);
  const normalized = candidate.filter((item): item is T => typeof item === 'string' && allowed.has(item as T));
  return normalized.length ? [...normalized, ...fallback.filter((item) => !normalized.includes(item))] : fallback;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length || fromIndex === toIndex) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function reorderByValue<T>(items: T[], dragged: T, target: T): T[] {
  const fromIndex = items.indexOf(dragged);
  const toIndex = items.indexOf(target);
  return moveItem(items, fromIndex, toIndex);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

const CHART_METRICS: Array<{ value: ChartMetric; label: string; formatter: (value: number) => string }> = [
  { value: 'impressions', label: 'Impressions', formatter: fmtNum },
  { value: 'clicks', label: 'Clicks', formatter: fmtNum },
  { value: 'ctr', label: 'CTR', formatter: fmtCtr },
  { value: 'viewabilityRate', label: 'Viewability', formatter: fmtCtr },
];

function formatRange(days: DateRange): string {
  return `${days}d`;
}

function getDateFrom(days: DateRange): string {
  const date = new Date();
  date.setDate(date.getDate() - (days - 1));
  return date.toISOString().slice(0, 10);
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeQuery({
  dateRange,
  rangeMode,
  customStartDate,
  customEndDate,
  campaignId = '',
  tagId = '',
}: {
  dateRange: DateRange;
  rangeMode: RangeMode;
  customStartDate: string;
  customEndDate: string;
  campaignId?: string;
  tagId?: string;
}): string {
  const params = new URLSearchParams();
  const dateFrom = rangeMode === 'custom' ? customStartDate : getDateFrom(dateRange);
  const dateTo = rangeMode === 'custom' ? customEndDate : getToday();
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  if (campaignId) params.set('campaignId', campaignId);
  if (tagId) params.set('tagId', tagId);
  params.set('limit', '10');
  return `?${params.toString()}`;
}

function normalizeRankedMetricList(items: any[], labelKey: string, valueKey: string, secondary?: (item: any) => string | undefined): RankedMetric[] {
  return (Array.isArray(items) ? items : []).map((item) => ({
    label: String(item?.[labelKey] ?? 'Unknown'),
    value: toNumber(item?.[valueKey]),
    secondary: secondary ? secondary(item) : undefined,
  }));
}

function normalizeBreakdownList(items: any[], config: {
  labelKey: string;
  secondary?: (item: any) => string | undefined;
  tertiary?: (item: any) => string | undefined;
}): BreakdownItem[] {
  return (Array.isArray(items) ? items : []).map((item) => ({
    id: item?.id ? String(item.id) : undefined,
    label: String(item?.[config.labelKey] ?? 'Unknown'),
    secondary: config.secondary ? config.secondary(item) : undefined,
    tertiary: config.tertiary ? config.tertiary(item) : undefined,
    impressions: toNumber(item?.impressions),
    clicks: toNumber(item?.clicks),
    ctr: toNumber(item?.ctr),
    uniqueIdentities: toNumber(item?.uniqueIdentities ?? item?.unique_identities),
    avgFrequency: toNumber(item?.avgFrequency ?? item?.avg_frequency),
    viewableImpressions: toNumber(item?.viewableImps ?? item?.viewable_imps),
    measuredImpressions: toNumber(item?.measuredImps ?? item?.measured_imps),
    undeterminedImpressions: toNumber(item?.undeterminedImps ?? item?.undetermined_imps),
    viewabilityRate: toNumber(item?.viewabilityRate ?? item?.viewability_rate),
  }));
}

function normalizeWorkspaceAnalytics(
  workspacePayload: any,
  campaignPayload: any,
  tagPayload: any,
  sitePayload: any,
  countryPayload: any,
  regionPayload: any,
  cityPayload: any,
  trackerPayload: any,
  engagementPayload: any,
  identityPayload: any,
  identityFrequencyPayload: any,
  identitySegmentsPayload: any,
  identityKeyPayload: any,
  identityAttributionPayload: any,
  savedAudiencePayload: any,
  creativePayload: any,
  variantPayload: any,
): WorkspaceAnalytics {
  const source = workspacePayload?.stats ?? workspacePayload ?? {};
  const timeline = (Array.isArray(workspacePayload?.timeline) ? workspacePayload.timeline : []).map((item: any) => ({
    date: String(item?.date ?? ''),
    impressions: toNumber(item?.impressions),
    clicks: toNumber(item?.clicks),
    viewableImps: toNumber(item?.viewableImps ?? item?.viewable_imps),
    measuredImps: toNumber(item?.measuredImps ?? item?.measured_imps),
    ctr: toNumber(item?.ctr),
    viewabilityRate: toNumber(item?.viewabilityRate ?? item?.viewability_rate),
  })).filter((item: TimelinePoint) => item.date);

  return {
    totalImpressions: toNumber(source?.totalImpressions ?? source?.total_impressions),
    totalClicks: toNumber(source?.totalClicks ?? source?.total_clicks),
    totalSpend: toNumber(source?.totalSpend ?? source?.total_spend),
    totalViewableImpressions: toNumber(source?.totalViewableImpressions ?? source?.total_viewable_impressions),
    totalMeasuredImpressions: toNumber(source?.totalMeasuredImpressions ?? source?.total_measured_impressions),
    totalUndeterminedImpressions: toNumber(source?.totalUndeterminedImpressions ?? source?.total_undetermined_impressions),
    measurableRate: toNumber(source?.measurableRate ?? source?.measurable_rate),
    viewabilityRate: toNumber(source?.viewabilityRate ?? source?.viewability_rate),
    avgCtr: toNumber(source?.avgCtr ?? source?.avg_ctr),
    totalEngagements: toNumber(source?.totalEngagements ?? source?.total_engagements),
    engagementRate: toNumber(source?.engagementRate ?? source?.engagement_rate),
    totalHoverDurationMs: toNumber(source?.totalHoverDurationMs ?? source?.total_hover_duration_ms),
    totalInViewDurationMs: toNumber(source?.totalInViewDurationMs ?? source?.total_in_view_duration_ms),
    totalIdentities: toNumber(source?.totalIdentities ?? source?.total_identities),
    avgIdentityFrequency: toNumber(source?.avgIdentityFrequency ?? source?.avg_identity_frequency),
    avgIdentityClicks: toNumber(source?.avgIdentityClicks ?? source?.avg_identity_clicks),
    activeCampaigns: toNumber(source?.activeCampaigns ?? source?.active_campaigns),
    activeTags: toNumber(source?.activeTags ?? source?.active_tags),
    totalCreatives: toNumber(source?.totalCreatives ?? source?.total_creatives),
    campaigns: normalizeBreakdownList(campaignPayload?.breakdown ?? [], {
      labelKey: 'name',
      secondary: (item) => `${String(item?.status ?? 'unknown')} · ${fmtCtr(toNumber(item?.viewabilityRate ?? item?.viewability_rate))} viewability`,
      tertiary: (item) => `${fmtNum(toNumber(item?.viewableImps ?? item?.viewable_imps))} viewable of ${fmtNum(toNumber(item?.measuredImps ?? item?.measured_imps))} measured · ${fmtNum(toNumber(item?.uniqueIdentities ?? item?.unique_identities))} unique identities · ${toNumber(item?.avgFrequency ?? item?.avg_frequency).toFixed(2)} avg frequency`,
    }),
    tags: normalizeBreakdownList(tagPayload?.breakdown ?? [], {
      labelKey: 'name',
      secondary: (item) => `${String(item?.format ?? 'unknown')} · ${fmtCtr(toNumber(item?.viewabilityRate ?? item?.viewability_rate))} viewability`,
      tertiary: (item) => `${String(item?.status ?? 'unknown')} · ${fmtNum(toNumber(item?.viewableImps ?? item?.viewable_imps))} of ${fmtNum(toNumber(item?.measuredImps ?? item?.measured_imps))} measured · ${fmtNum(toNumber(item?.uniqueIdentities ?? item?.unique_identities))} unique identities · ${toNumber(item?.avgFrequency ?? item?.avg_frequency).toFixed(2)} avg frequency`,
    }),
    creatives: normalizeBreakdownList(creativePayload?.breakdown ?? [], {
      labelKey: 'name',
      secondary: (item) => `${String(item?.source_kind ?? 'unknown')} · v${String(item?.version_number ?? '—')}`,
      tertiary: (item) => `${String(item?.serving_format ?? 'unknown')} · ${fmtNum(toNumber(item?.uniqueIdentities ?? item?.unique_identities))} unique identities · ${toNumber(item?.avgFrequency ?? item?.avg_frequency).toFixed(2)} avg frequency`,
    }),
    variants: (Array.isArray(variantPayload?.breakdown) ? variantPayload.breakdown : []).map((item: any) => ({
      id: String(item?.id ?? ''),
      creativeName: String(item?.creative_name ?? 'Untitled creative'),
      label: String(item?.label ?? 'Variant'),
      size: `${toNumber(item?.width)}x${toNumber(item?.height)}`,
      status: String(item?.status ?? 'unknown'),
      impressions: toNumber(item?.impressions),
      clicks: toNumber(item?.clicks),
      ctr: toNumber(item?.ctr),
      uniqueIdentities: toNumber(item?.uniqueIdentities ?? item?.unique_identities),
      avgFrequency: toNumber(item?.avgFrequency ?? item?.avg_frequency),
    })),
    topSites: normalizeRankedMetricList(sitePayload?.breakdown ?? [], 'site_domain', 'impressions', (item) => `${fmtCtr(toNumber(item?.ctr))} CTR · ${fmtCtr(toNumber(item?.viewability_rate))} viewability · ${fmtNum(toNumber(item?.viewable_imps))}/${fmtNum(toNumber(item?.measured_imps))} measured · ${fmtNum(toNumber(item?.unique_identities))} unique identities · ${toNumber(item?.avg_frequency).toFixed(2)} avg frequency`),
    topCountries: normalizeRankedMetricList(countryPayload?.breakdown ?? [], 'country', 'impressions', (item) => `${fmtCtr(toNumber(item?.ctr))} CTR · ${fmtCtr(toNumber(item?.viewability_rate))} viewability · ${fmtNum(toNumber(item?.viewable_imps))}/${fmtNum(toNumber(item?.measured_imps))} measured · ${fmtNum(toNumber(item?.unique_identities))} unique identities · ${toNumber(item?.avg_frequency).toFixed(2)} avg frequency`),
    topRegions: normalizeRankedMetricList(regionPayload?.breakdown ?? [], 'region', 'impressions', (item) => `${fmtCtr(toNumber(item?.ctr))} CTR · ${fmtCtr(toNumber(item?.viewability_rate))} viewability · ${fmtNum(toNumber(item?.viewable_imps))}/${fmtNum(toNumber(item?.measured_imps))} measured · ${fmtNum(toNumber(item?.unique_identities))} unique identities · ${toNumber(item?.avg_frequency).toFixed(2)} avg frequency`),
    topCities: normalizeRankedMetricList(cityPayload?.breakdown ?? [], 'city', 'impressions', (item) => `${fmtCtr(toNumber(item?.ctr))} CTR · ${fmtCtr(toNumber(item?.viewability_rate))} viewability · ${fmtNum(toNumber(item?.viewable_imps))}/${fmtNum(toNumber(item?.measured_imps))} measured · ${fmtNum(toNumber(item?.unique_identities))} unique identities · ${toNumber(item?.avg_frequency).toFixed(2)} avg frequency`),
    trackerPerformance: normalizeRankedMetricList(trackerPayload?.breakdown ?? [], 'name', 'clicks', (item) => `${String(item?.tracker_type ?? 'measurement')} · ${fmtNum(toNumber(item?.impressions))} imps · ${fmtCtr(toNumber(item?.ctr))} CTR · ${fmtNum(toNumber(item?.unique_identities))} unique identities · ${toNumber(item?.avg_frequency).toFixed(2)} avg frequency${item?.campaign_name ? ` · ${String(item.campaign_name)}` : ''}`),
    topIdentities: normalizeRankedMetricList(identityPayload?.breakdown ?? [], 'canonical_value', 'impressions', (item) => {
      const location = [item?.last_city, item?.last_region, item?.last_country].filter(Boolean).join(', ');
      return `${String(item?.canonical_type ?? 'identity')} · ${fmtCtr(toNumber(item?.ctr))} CTR${location ? ` · ${location}` : ''}`;
    }),
    identityFrequency: normalizeRankedMetricList(identityFrequencyPayload?.breakdown ?? [], 'bucket_label', 'identity_count', (item) => {
      return `${fmtNum(toNumber(item?.impressions))} imps · ${fmtNum(toNumber(item?.clicks))} clicks · ${fmtCtr(toNumber(item?.ctr))} CTR`;
    }),
    identitySegments: normalizeRankedMetricList(identitySegmentsPayload?.breakdown ?? [], 'label', 'identity_count', (item) => {
      return `${fmtNum(toNumber(item?.impressions))} imps · ${fmtNum(toNumber(item?.clicks))} clicks · ${fmtNum(toNumber(item?.engagements))} engagements`;
    }),
    identityKeyBreakdown: normalizeRankedMetricList(identityKeyPayload?.breakdown ?? [], 'key_type', 'key_observations', (item) => {
      return `${String(item?.event_type ?? 'unknown')} · ${fmtNum(toNumber(item?.unique_values))} unique values · ${fmtNum(toNumber(item?.identity_count))} identities`;
    }),
    identityAttribution: normalizeRankedMetricList(identityAttributionPayload?.breakdown ?? [], 'label', 'exposed_identities', (item) => {
      return `${fmtNum(toNumber(item?.clicked_identities))} clicked · ${fmtNum(toNumber(item?.engaged_identities))} engaged · ${fmtCtr(toNumber(item?.click_through_rate))} click-through · ${fmtCtr(toNumber(item?.engagement_through_rate))} engagement-through`;
    }),
    engagements: normalizeRankedMetricList(engagementPayload?.breakdown ?? [], 'event_type', 'event_count', (item) => {
      const duration = toNumber(item?.total_duration_ms);
      return duration > 0 ? `${fmtNum(duration)} ms total` : undefined;
    }),
    savedAudiences: (Array.isArray(savedAudiencePayload?.audiences) ? savedAudiencePayload.audiences : []).map((item: any) => ({
      id: String(item?.id ?? ''),
      name: String(item?.name ?? 'Untitled audience'),
      canonicalType: String(item?.canonical_type ?? '') as IdentityTypeFilter | '',
      country: String(item?.country ?? ''),
      siteDomain: String(item?.site_domain ?? ''),
      region: String(item?.region ?? ''),
      city: String(item?.city ?? ''),
      segmentPreset: String(item?.segment_preset ?? '') as IdentitySegmentPreset | '',
      activationTemplate: String(item?.activation_template ?? 'full') as IdentityExportFormat,
      campaignId: String(item?.campaign_id ?? ''),
      tagId: String(item?.tag_id ?? ''),
      creativeId: String(item?.creative_id ?? ''),
      variantId: String(item?.creative_size_variant_id ?? ''),
      minImpressions: toNumber(item?.min_impressions),
      minClicks: toNumber(item?.min_clicks),
    })),
    audiencePresets: (Array.isArray(identitySegmentsPayload?.breakdown) ? identitySegmentsPayload.breakdown : [])
      .map((item: any) => ({
        label: String(item?.label ?? 'Audience preset'),
        value: toNumber(item?.identity_count),
        secondary: `${fmtNum(toNumber(item?.impressions))} imps · ${fmtNum(toNumber(item?.clicks))} clicks · ${fmtNum(toNumber(item?.engagements))} engagements`,
        presetValue:
          String(item?.preset ?? '') === 'high_frequency_exposed'
          || String(item?.preset ?? '') === 'clicked_users'
          || String(item?.preset ?? '') === 'engaged_non_clickers'
            ? String(item?.preset) as IdentitySegmentPreset
            : '',
      }))
      .filter((item: AudiencePresetMetric) => Boolean(item.presetValue)),
    timeline,
  };
}

function getTimelineBucket(dateValue: string, grain: ChartGrain): string {
  const date = new Date(`${dateValue}T00:00:00Z`);
  if (grain === 'month') {
    return date.toISOString().slice(0, 7);
  }
  if (grain === 'week') {
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() - day + 1);
    return date.toISOString().slice(0, 10);
  }
  return dateValue;
}

function buildChartPoints(timeline: TimelinePoint[], grain: ChartGrain, metric: ChartMetric) {
  const buckets = new Map<string, TimelinePoint>();
  timeline.forEach((point) => {
    const key = getTimelineBucket(point.date, grain);
    const current = buckets.get(key) ?? {
      date: key,
      impressions: 0,
      clicks: 0,
      viewableImps: 0,
      measuredImps: 0,
      ctr: 0,
      viewabilityRate: 0,
    };
    current.impressions += point.impressions;
    current.clicks += point.clicks;
    current.viewableImps += point.viewableImps;
    current.measuredImps += point.measuredImps;
    buckets.set(key, current);
  });
  return Array.from(buckets.values())
    .map((point) => {
      const ctr = point.impressions > 0 ? (point.clicks / point.impressions) * 100 : 0;
      const viewabilityRate = point.measuredImps > 0 ? (point.viewableImps / point.measuredImps) * 100 : 0;
      return {
        label: point.date,
        value: metric === 'ctr' ? ctr : metric === 'viewabilityRate' ? viewabilityRate : point[metric],
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function PerformanceChart({
  points,
  metric,
}: {
  points: Array<{ label: string; value: number }>;
  metric: ChartMetric;
}) {
  const metricConfig = CHART_METRICS.find((item) => item.value === metric) ?? CHART_METRICS[0];
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const width = 760;
  const height = 220;
  const pad = { left: 48, right: 18, top: 20, bottom: 42 };
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  const linePoints = points.map((point, index) => {
    const x = points.length === 1 ? pad.left + chartWidth / 2 : pad.left + (index / (points.length - 1)) * chartWidth;
    const y = pad.top + chartHeight - (point.value / maxValue) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  if (points.length === 0) {
    return <div className="py-16 text-center text-sm text-slate-400">No timeline data available for this range.</div>;
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[260px] w-full">
      {[0, 0.5, 1].map((fraction) => {
        const y = pad.top + chartHeight - fraction * chartHeight;
        return (
          <g key={fraction}>
            <line x1={pad.left} y1={y} x2={pad.left + chartWidth} y2={y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
              {metricConfig.formatter(maxValue * fraction)}
            </text>
          </g>
        );
      })}
      {points.map((point, index) => {
        const slotWidth = chartWidth / Math.max(points.length, 1);
        const barWidth = Math.max(4, Math.min(24, slotWidth * 0.45));
        const x = points.length === 1 ? pad.left + chartWidth / 2 - barWidth / 2 : pad.left + (index / (points.length - 1)) * chartWidth - barWidth / 2;
        const barHeight = (point.value / maxValue) * chartHeight;
        return (
          <g key={`${point.label}-${index}`}>
            <rect
              x={x}
              y={pad.top + chartHeight - barHeight}
              width={barWidth}
              height={barHeight}
              rx="4"
              fill="#818cf8"
              opacity="0.28"
            />
            {(index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 6) === 0) && (
              <text x={x + barWidth / 2} y={height - 16} textAnchor="middle" fontSize="10" fill="#94a3b8">
                {point.label.slice(5)}
              </text>
            )}
          </g>
        );
      })}
      {points.length > 1 && <polyline points={linePoints} fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
      {points.map((point, index) => {
        const x = points.length === 1 ? pad.left + chartWidth / 2 : pad.left + (index / (points.length - 1)) * chartWidth;
        const y = pad.top + chartHeight - (point.value / maxValue) * chartHeight;
        return (
          <circle key={`dot-${point.label}-${index}`} cx={x} cy={y} r="4" fill="#4f46e5">
            <title>{`${point.label}: ${metricConfig.formatter(point.value)}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

function KpiCard({ label, value, icon, color, sub }: { label: string; value: string; icon: string; color: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500 font-medium">{label}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub ? <p className="text-xs text-slate-400 mt-1">{sub}</p> : null}
    </div>
  );
}

function ReorderButtons({
  canMoveBackward,
  canMoveForward,
  onMoveBackward,
  onMoveForward,
  backwardLabel,
  forwardLabel,
}: {
  canMoveBackward: boolean;
  canMoveForward: boolean;
  onMoveBackward: () => void;
  onMoveForward: () => void;
  backwardLabel: string;
  forwardLabel: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onMoveBackward}
        disabled={!canMoveBackward}
        className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={backwardLabel}
        title={backwardLabel}
      >
        ←
      </button>
      <button
        type="button"
        onClick={onMoveForward}
        disabled={!canMoveForward}
        className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={forwardLabel}
        title={forwardLabel}
      >
        →
      </button>
    </div>
  );
}

function ModuleControls({
  title,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: {
  title: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <DragHandle label={`Drag ${title}`} />
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          title="Move module up"
          aria-label="Move module up"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          title="Move module down"
          aria-label="Move module down"
        >
          ↓
        </button>
      </div>
    </div>
  );
}

function DragHandle({ label }: { label: string }) {
  return (
    <span
      className="inline-flex cursor-grab items-center rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 active:cursor-grabbing"
      title={label}
      aria-label={label}
    >
      ⋮⋮
    </span>
  );
}

function RankedList({ title, emptyLabel, items }: { title: string; emptyLabel: string; items: RankedMetric[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      </div>
      {!items.length ? (
        <div className="px-5 py-10 text-center text-sm text-slate-400">{emptyLabel}</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((item) => (
            <div key={`${title}-${item.label}`} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{item.label}</p>
                {item.secondary ? <p className="mt-0.5 text-xs text-slate-500">{item.secondary}</p> : null}
              </div>
              <p className="text-sm font-semibold text-slate-700">{fmtNum(item.value)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BreakdownTable({
  title,
  emptyLabel,
  rows,
  secondaryLabel,
}: {
  title: string;
  emptyLabel: string;
  rows: BreakdownItem[];
  secondaryLabel: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      </div>
      {!rows.length ? (
        <div className="px-5 py-10 text-center text-sm text-slate-400">{emptyLabel}</div>
      ) : (
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              {['Name', secondaryLabel, 'Impressions', 'Clicks', 'CTR'].map((heading) => (
                <th key={heading} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={row.id ?? `${row.label}-${index}`} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-slate-800 max-w-[220px] truncate">{row.label}</td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {row.secondary ?? '—'}
                  {row.tertiary ? <span className="block text-xs text-slate-400 mt-0.5">{row.tertiary}</span> : null}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{fmtNum(row.impressions)}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{fmtNum(row.clicks)}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{fmtCtr(row.ctr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function VariantTable({ rows }: { rows: VariantItem[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-800">Top Variants</h2>
      </div>
      {!rows.length ? (
        <div className="px-5 py-10 text-center text-sm text-slate-400">No variant data available</div>
      ) : (
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              {['Creative', 'Variant', 'Size', 'Status', 'Impressions', 'CTR'].map((heading) => (
                <th key={heading} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-slate-800 max-w-[200px] truncate">{row.creativeName}</td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {row.label}
                  <span className="block text-xs text-slate-400 mt-0.5">
                    {fmtNum(row.uniqueIdentities ?? 0)} unique identities · {(row.avgFrequency ?? 0).toFixed(2)} avg frequency
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{row.size}</td>
                <td className="px-4 py-3 text-sm text-slate-600 capitalize">{row.status}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{fmtNum(row.impressions)}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{fmtCtr(row.ctr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<WorkspaceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>(30);
  const [rangeMode, setRangeMode] = useState<RangeMode>('preset');
  const [customStartDate, setCustomStartDate] = useState(() => getDateFrom(30));
  const [customEndDate, setCustomEndDate] = useState(() => getToday());
  const [identityTypeFilter, setIdentityTypeFilter] = useState<IdentityTypeFilter>('');
  const [identityCountryFilter, setIdentityCountryFilter] = useState('');
  const [identitySiteDomainFilter, setIdentitySiteDomainFilter] = useState('');
  const [identityRegionFilter, setIdentityRegionFilter] = useState('');
  const [identityCityFilter, setIdentityCityFilter] = useState('');
  const [identityMinImpressions, setIdentityMinImpressions] = useState('1');
  const [identityMinClicks, setIdentityMinClicks] = useState('0');
  const [identitySegmentPreset, setIdentitySegmentPreset] = useState<IdentitySegmentPreset>('');
  const [globalCampaignFilter, setGlobalCampaignFilter] = useState('');
  const [globalTagFilter, setGlobalTagFilter] = useState('');
  const [identityCreativeFilter, setIdentityCreativeFilter] = useState('');
  const [identityVariantFilter, setIdentityVariantFilter] = useState('');
  const [identityExportFormat, setIdentityExportFormat] = useState<IdentityExportFormat>('full');
  const [savingAudience, setSavingAudience] = useState(false);
  const [chartGrain, setChartGrain] = useState<ChartGrain>('day');
  const [chartMetric, setChartMetric] = useState<ChartMetric>('impressions');
  const [primaryKpiOrder, setPrimaryKpiOrder] = useState<PrimaryKpiId[]>(() => readStoredOrder(PRIMARY_KPI_STORAGE_KEY, PRIMARY_KPI_ORDER_DEFAULT));
  const [secondaryKpiOrder, setSecondaryKpiOrder] = useState<SecondaryKpiId[]>(() => readStoredOrder(SECONDARY_KPI_STORAGE_KEY, SECONDARY_KPI_ORDER_DEFAULT));
  const [moduleOrder, setModuleOrder] = useState<ReportModuleId[]>(() => readStoredOrder(MODULE_STORAGE_KEY, REPORT_MODULE_ORDER_DEFAULT));
  const [draggedPrimaryKpi, setDraggedPrimaryKpi] = useState<PrimaryKpiId | null>(null);
  const [draggedSecondaryKpi, setDraggedSecondaryKpi] = useState<SecondaryKpiId | null>(null);
  const [draggedModule, setDraggedModule] = useState<ReportModuleId | null>(null);
  const [layoutPrefsLoaded, setLayoutPrefsLoaded] = useState(false);

  const query = useMemo(() => makeQuery({
    dateRange,
    rangeMode,
    customStartDate,
    customEndDate,
    campaignId: globalCampaignFilter,
    tagId: globalTagFilter,
  }), [dateRange, rangeMode, customStartDate, customEndDate, globalCampaignFilter, globalTagFilter]);
  const identityQuery = useMemo(() => {
    const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
    if (identityTypeFilter) params.set('canonicalType', identityTypeFilter);
    if (identityCreativeFilter) params.set('creativeId', identityCreativeFilter);
    if (identityVariantFilter) params.set('variantId', identityVariantFilter);
    if (identitySiteDomainFilter) params.set('siteDomain', identitySiteDomainFilter);
    if (identityRegionFilter) params.set('region', identityRegionFilter);
    if (identityCityFilter) params.set('city', identityCityFilter);
    return `?${params.toString()}`;
  }, [query, identityTypeFilter, identityCreativeFilter, identityVariantFilter, identitySiteDomainFilter, identityRegionFilter, identityCityFilter]);
  const customDatesValid = Boolean(customStartDate && customEndDate && customStartDate <= customEndDate);
  const campaignOptions = data?.campaigns ?? [];
  const tagOptions = data?.tags ?? [];
  const creativeOptions = data?.creatives ?? [];
  const variantOptions = data?.variants ?? [];
  const siteOptions = data?.topSites ?? [];
  const regionOptions = data?.topRegions ?? [];
  const cityOptions = data?.topCities ?? [];
  const audiencePresets = data?.audiencePresets ?? [];
  const chartPoints = useMemo(
    () => buildChartPoints(data?.timeline ?? [], chartGrain, chartMetric),
    [data?.timeline, chartGrain, chartMetric],
  );
  const selectedChartMetric = CHART_METRICS.find((metric) => metric.value === chartMetric) ?? CHART_METRICS[0];

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ preferences?: Record<string, unknown> }>('/v1/auth/preferences')
      .then((payload) => {
        if (cancelled) return;
        const layout = payload?.preferences?.[REPORTING_LAYOUT_PREFERENCE_KEY] as Record<string, unknown> | undefined;
        if (layout && typeof layout === 'object') {
          setPrimaryKpiOrder(normalizeExplicitOrder(layout.primaryKpiOrder, PRIMARY_KPI_ORDER_DEFAULT));
          setSecondaryKpiOrder(normalizeExplicitOrder(layout.secondaryKpiOrder, SECONDARY_KPI_ORDER_DEFAULT));
          setModuleOrder(normalizeExplicitOrder(layout.moduleOrder, REPORT_MODULE_ORDER_DEFAULT));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLayoutPrefsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(PRIMARY_KPI_STORAGE_KEY, JSON.stringify(primaryKpiOrder));
    window.localStorage.setItem(SECONDARY_KPI_STORAGE_KEY, JSON.stringify(secondaryKpiOrder));
    window.localStorage.setItem(MODULE_STORAGE_KEY, JSON.stringify(moduleOrder));
  }, [primaryKpiOrder, secondaryKpiOrder, moduleOrder]);

  useEffect(() => {
    if (!layoutPrefsLoaded) return;
    const timeout = window.setTimeout(() => {
      void fetchJson('/v1/auth/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          preferences: {
            [REPORTING_LAYOUT_PREFERENCE_KEY]: {
              primaryKpiOrder,
              secondaryKpiOrder,
              moduleOrder,
            },
          },
        }),
      }).catch(() => {});
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [layoutPrefsLoaded, primaryKpiOrder, secondaryKpiOrder, moduleOrder]);

  const primaryKpis = useMemo<Record<PrimaryKpiId, { label: string; value: string; icon: string; color: string; sub?: string }>>(() => ({
    impressions: { label: 'Impressions', value: fmtNum(data?.totalImpressions ?? 0), icon: '👁️', color: 'text-slate-800' },
    clicks: { label: 'Clicks', value: fmtNum(data?.totalClicks ?? 0), icon: '🖱️', color: 'text-blue-700' },
    spend: { label: 'Spend', value: fmtCurrency(data?.totalSpend ?? 0), icon: '💸', color: 'text-emerald-700' },
    ctr: { label: 'CTR', value: fmtCtr(data?.avgCtr ?? 0), icon: '📈', color: 'text-indigo-700' },
    viewability: {
      label: 'Viewability',
      value: fmtCtr(data?.viewabilityRate ?? 0),
      icon: '🎯',
      color: 'text-fuchsia-700',
      sub: `${fmtNum(data?.totalViewableImpressions ?? 0)} viewable of ${fmtNum(data?.totalMeasuredImpressions ?? 0)} measured · ${fmtCtr(data?.measurableRate ?? 0)} measurable`,
    },
    engagements: {
      label: 'Engagements',
      value: fmtNum(data?.totalEngagements ?? 0),
      icon: '✨',
      color: 'text-amber-700',
      sub: `${fmtCtr(data?.engagementRate ?? 0)} engagement rate`,
    },
    engagementRate: {
      label: 'Engagement Rate',
      value: fmtCtr(data?.engagementRate ?? 0),
      icon: '⚡',
      color: 'text-orange-700',
      sub: `${fmtNum(data?.totalEngagements ?? 0)} engagements on ${fmtNum(data?.totalImpressions ?? 0)} impressions`,
    },
    attentionTime: {
      label: 'Attention Time',
      value: fmtSecondsFromMs(data?.totalHoverDurationMs ?? 0),
      icon: '⏳',
      color: 'text-amber-700',
      sub: 'Total hover duration',
    },
    inViewTime: {
      label: 'In-View Time',
      value: fmtSecondsFromMs(data?.totalInViewDurationMs ?? 0),
      icon: '⏱️',
      color: 'text-cyan-700',
      sub: 'Total measured visible duration',
    },
  }), [data]);

  const secondaryKpis = useMemo<Record<SecondaryKpiId, { label: string; value: string; icon: string; color: string; sub?: string }>>(() => ({
    activeCampaigns: { label: 'Active Campaigns', value: String(data?.activeCampaigns ?? 0), icon: '📋', color: 'text-slate-800' },
    activeTags: { label: 'Active Tags', value: String(data?.activeTags ?? 0), icon: '🏷️', color: 'text-slate-800' },
    creatives: { label: 'Creatives', value: String(data?.totalCreatives ?? 0), icon: '🧩', color: 'text-slate-800' },
    measurableRate: {
      label: 'Measurable Rate',
      value: fmtCtr(data?.measurableRate ?? 0),
      icon: '🧪',
      color: 'text-slate-800',
      sub: `${fmtNum(data?.totalUndeterminedImpressions ?? 0)} undetermined impressions`,
    },
    identities: {
      label: 'Identities',
      value: fmtNum(data?.totalIdentities ?? 0),
      icon: '🪪',
      color: 'text-slate-800',
      sub: `${(data?.avgIdentityFrequency ?? 0).toFixed(2)} avg impressions · ${(data?.avgIdentityClicks ?? 0).toFixed(2)} avg clicks`,
    },
  }), [data]);

  const buildIdentityAudienceQuery = (overrides?: Partial<SavedAudience>, exportFormat?: IdentityExportFormat) => {
    const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
    const canonicalType = overrides?.canonicalType ?? identityTypeFilter;
    const country = overrides?.country ?? identityCountryFilter.trim().toUpperCase();
    const segmentPreset = overrides?.segmentPreset ?? identitySegmentPreset;
    const audienceTemplate = overrides?.activationTemplate ?? identityExportFormat;
    const campaignId = overrides?.campaignId ?? globalCampaignFilter;
    const tagId = overrides?.tagId ?? globalTagFilter;
    const creativeId = overrides?.creativeId ?? identityCreativeFilter;
    const variantId = overrides?.variantId ?? identityVariantFilter;
    const siteDomain = overrides?.siteDomain ?? identitySiteDomainFilter;
    const region = overrides?.region ?? identityRegionFilter;
    const city = overrides?.city ?? identityCityFilter;
    const minImpressions = overrides?.minImpressions ?? Number(identityMinImpressions.trim() || '0');
    const minClicks = overrides?.minClicks ?? Number(identityMinClicks.trim() || '0');
    if (canonicalType) params.set('canonicalType', canonicalType);
    if (country) params.set('country', country);
    if (segmentPreset) params.set('segmentPreset', segmentPreset);
    if (campaignId) params.set('campaignId', campaignId);
    if (tagId) params.set('tagId', tagId);
    if (creativeId) params.set('creativeId', creativeId);
    if (variantId) params.set('variantId', variantId);
    if (siteDomain) params.set('siteDomain', siteDomain);
    if (region) params.set('region', region);
    if (city) params.set('city', city);
    params.set('minImpressions', String(Math.max(minImpressions, 0)));
    params.set('minClicks', String(Math.max(minClicks, 0)));
    params.set('format', exportFormat ?? audienceTemplate);
    return `?${params.toString()}`;
  };

  const load = () => {
    setLoading(true);
    setError('');

    Promise.all([
      fetch(`/v1/reporting/workspace${query}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load analytics');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/campaign-breakdown${query}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load campaign breakdown');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/tag-breakdown${query}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load tag breakdown');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/site-breakdown${query}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load site breakdown');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/country-breakdown${query}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load country breakdown');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/region-breakdown${query}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load region breakdown');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/city-breakdown${query}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load city breakdown');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/tracker-breakdown${query}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load tracker breakdown');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/engagement-breakdown${query}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load engagement breakdown');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/identity-breakdown${identityQuery}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load identity breakdown');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/identity-frequency-buckets${identityQuery}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load identity frequency');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/identity-segment-presets${identityQuery}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load identity segments');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/identity-key-breakdown${identityQuery}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load identity key breakdown');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/identity-attribution-windows${identityQuery}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load identity attribution windows');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/saved-audiences`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load saved audiences');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/creative-breakdown${query}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load creative breakdown');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/variant-breakdown${query}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load variant breakdown');
        return r.json();
      }),
    ])
      .then(([workspace, campaigns, tags, sites, countries, regions, cities, trackers, engagements, identities, identityFrequency, identitySegments, identityKeys, identityAttribution, savedAudiences, creatives, variants]) => {
        setData(normalizeWorkspaceAnalytics(workspace, campaigns, tags, sites, countries, regions, cities, trackers, engagements, identities, identityFrequency, identitySegments, identityKeys, identityAttribution, savedAudiences, creatives, variants));
      })
      .catch((loadError: any) => setError(loadError.message ?? 'Failed to load analytics'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (rangeMode === 'custom' && !customDatesValid) return;
    load();
  }, [query, identityQuery]);

  const handleExportIdentityCsv = async () => {
    try {
      const response = await fetch(`/v1/reporting/workspace/identity-export${identityQuery}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to export identity report');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `identity-report${identityTypeFilter ? `-${identityTypeFilter}` : ''}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      window.alert('Failed to export identity CSV.');
    }
  };

  const handleExportIdentityAudienceCsv = async (overrides?: Partial<SavedAudience>) => {
    try {
      const response = await fetch(`/v1/reporting/workspace/identity-audience-export${buildIdentityAudienceQuery(overrides)}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to export identity audience');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `identity-audience-${identityExportFormat}${identityTypeFilter ? `-${identityTypeFilter}` : ''}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      window.alert('Failed to export audience CSV.');
    }
  };

  const handleSaveAudience = async (
    suggestedNameOverride?: string,
    overrides?: Partial<{
      segmentPreset: IdentitySegmentPreset;
      canonicalType: IdentityTypeFilter;
      country: string;
      siteDomain: string;
      region: string;
      city: string;
      campaignId: string;
      tagId: string;
      creativeId: string;
      variantId: string;
      minImpressions: string;
      minClicks: string;
      activationTemplate: IdentityExportFormat;
    }>,
  ) => {
    const nextSegmentPreset = overrides?.segmentPreset ?? identitySegmentPreset;
    const suggestedName = suggestedNameOverride
      ?? (nextSegmentPreset
        ? IDENTITY_SEGMENT_PRESETS.find((option) => option.value === nextSegmentPreset)?.label ?? 'Saved audience'
        : `Audience ${(overrides?.country ?? identityCountryFilter).trim().toUpperCase() || overrides?.canonicalType || identityTypeFilter || 'all'}`);
    const name = window.prompt('Name this saved audience', suggestedName);
    if (!name || !name.trim()) return;

    setSavingAudience(true);
    try {
      const response = await fetch('/v1/reporting/workspace/saved-audiences', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          canonicalType: (overrides?.canonicalType ?? identityTypeFilter) || null,
          country: (overrides?.country ?? identityCountryFilter).trim().toUpperCase() || null,
          siteDomain: (overrides?.siteDomain ?? identitySiteDomainFilter) || null,
          region: (overrides?.region ?? identityRegionFilter) || null,
          city: (overrides?.city ?? identityCityFilter) || null,
          segmentPreset: nextSegmentPreset || null,
          activationTemplate: overrides?.activationTemplate ?? identityExportFormat,
          campaignId: (overrides?.campaignId ?? globalCampaignFilter) || null,
          tagId: (overrides?.tagId ?? globalTagFilter) || null,
          creativeId: (overrides?.creativeId ?? identityCreativeFilter) || null,
          variantId: (overrides?.variantId ?? identityVariantFilter) || null,
          minImpressions: (overrides?.minImpressions ?? identityMinImpressions.trim()) || '0',
          minClicks: (overrides?.minClicks ?? identityMinClicks.trim()) || '0',
        }),
      });
      if (!response.ok) throw new Error('Failed to save audience');
      load();
    } catch {
      window.alert('Failed to save audience.');
    } finally {
      setSavingAudience(false);
    }
  };

  const applySavedAudience = (audience: SavedAudience) => {
    setIdentityTypeFilter(audience.canonicalType);
    setIdentityCountryFilter(audience.country);
    setIdentitySiteDomainFilter(audience.siteDomain);
    setIdentityRegionFilter(audience.region);
    setIdentityCityFilter(audience.city);
    setIdentitySegmentPreset(audience.segmentPreset);
    setIdentityExportFormat(audience.activationTemplate);
    setGlobalCampaignFilter(audience.campaignId);
    setGlobalTagFilter(audience.tagId);
    setIdentityCreativeFilter(audience.creativeId);
    setIdentityVariantFilter(audience.variantId);
    setIdentityMinImpressions(String(audience.minImpressions));
    setIdentityMinClicks(String(audience.minClicks));
  };

  const handleDeleteSavedAudience = async (audience: SavedAudience) => {
    if (!window.confirm(`Delete saved audience "${audience.name}"?`)) return;
    try {
      const response = await fetch(`/v1/reporting/workspace/saved-audiences/${audience.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete saved audience');
      load();
    } catch {
      window.alert('Failed to delete saved audience.');
    }
  };

  const handleResetLayout = () => {
    setPrimaryKpiOrder(PRIMARY_KPI_ORDER_DEFAULT);
    setSecondaryKpiOrder(SECONDARY_KPI_ORDER_DEFAULT);
    setModuleOrder(REPORT_MODULE_ORDER_DEFAULT);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-medium">Error loading analytics</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={load} className="mt-3 text-sm text-red-600 underline">Retry</button>
      </div>
    );
  }

  const renderModule = (moduleId: ReportModuleId) => {
    switch (moduleId) {
      case 'primaryKpis':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
            {primaryKpiOrder.map((kpiId, index) => {
              const card = primaryKpis[kpiId];
              return (
                <div
                  key={kpiId}
                  draggable
                  onDragStart={() => setDraggedPrimaryKpi(kpiId)}
                  onDragEnd={() => setDraggedPrimaryKpi(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (!draggedPrimaryKpi || draggedPrimaryKpi === kpiId) return;
                    setPrimaryKpiOrder((current) => reorderByValue(current, draggedPrimaryKpi, kpiId));
                    setDraggedPrimaryKpi(null);
                  }}
                  className={`space-y-2 rounded-2xl ${draggedPrimaryKpi === kpiId ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <DragHandle label={`Drag ${card.label}`} />
                    <ReorderButtons
                      canMoveBackward={index > 0}
                      canMoveForward={index < primaryKpiOrder.length - 1}
                      onMoveBackward={() => setPrimaryKpiOrder((current) => moveItem(current, index, index - 1))}
                      onMoveForward={() => setPrimaryKpiOrder((current) => moveItem(current, index, index + 1))}
                      backwardLabel={`Move ${card.label} left`}
                      forwardLabel={`Move ${card.label} right`}
                    />
                  </div>
                  <KpiCard {...card} />
                </div>
              );
            })}
          </div>
        );
      case 'secondaryKpis':
        return (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            {secondaryKpiOrder.map((kpiId, index) => {
              const card = secondaryKpis[kpiId];
              return (
                <div
                  key={kpiId}
                  draggable
                  onDragStart={() => setDraggedSecondaryKpi(kpiId)}
                  onDragEnd={() => setDraggedSecondaryKpi(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (!draggedSecondaryKpi || draggedSecondaryKpi === kpiId) return;
                    setSecondaryKpiOrder((current) => reorderByValue(current, draggedSecondaryKpi, kpiId));
                    setDraggedSecondaryKpi(null);
                  }}
                  className={`space-y-2 rounded-2xl ${draggedSecondaryKpi === kpiId ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <DragHandle label={`Drag ${card.label}`} />
                    <ReorderButtons
                      canMoveBackward={index > 0}
                      canMoveForward={index < secondaryKpiOrder.length - 1}
                      onMoveBackward={() => setSecondaryKpiOrder((current) => moveItem(current, index, index - 1))}
                      onMoveForward={() => setSecondaryKpiOrder((current) => moveItem(current, index, index + 1))}
                      backwardLabel={`Move ${card.label} left`}
                      forwardLabel={`Move ${card.label} right`}
                    />
                  </div>
                  <KpiCard {...card} />
                </div>
              );
            })}
          </div>
        );
      case 'performanceTrend':
        return (
          <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Performance Trend</h2>
                <p className="mt-1 text-xs text-slate-500">
                  General chart by day, week, or month. Current metric: {selectedChartMetric.label}.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={chartMetric}
                  onChange={(event) => setChartMetric(event.target.value as ChartMetric)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700"
                >
                  {CHART_METRICS.map((metric) => (
                    <option key={metric.value} value={metric.value}>
                      {metric.label}
                    </option>
                  ))}
                </select>
                <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                  {CHART_GRAINS.map((grain) => (
                    <button
                      key={grain.value}
                      type="button"
                      onClick={() => setChartGrain(grain.value)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        chartGrain === grain.value
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:bg-white'
                      }`}
                    >
                      {grain.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <PerformanceChart points={chartPoints} metric={chartMetric} />
          </div>
        );
      case 'topInsights':
        return (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
            <RankedList title="Top Sites" emptyLabel="No site data available" items={data?.topSites ?? []} />
            <RankedList title="Top Countries" emptyLabel="No country data available" items={data?.topCountries ?? []} />
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Top Identities</h2>
                  <p className="text-xs text-slate-500 mt-1">Filter by canonical identity type and export the current reach/frequency cut.</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={identityTypeFilter}
                    onChange={(event) => setIdentityTypeFilter(event.target.value as IdentityTypeFilter)}
                    className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700"
                  >
                    {IDENTITY_FILTERS.map((option) => (
                      <option key={option.value || 'all'} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => void handleExportIdentityCsv()}
                    className="px-3 py-2 text-xs border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors"
                  >
                    Export CSV
                  </button>
                </div>
              </div>
              <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2 bg-slate-50/60">
                <input value={identityCountryFilter} onChange={(event) => setIdentityCountryFilter(event.target.value)} placeholder="Country (e.g. SV)" className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700" />
                <select value={identitySiteDomainFilter} onChange={(event) => setIdentitySiteDomainFilter(event.target.value)} className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700">
                  <option value="">All sites</option>
                  {siteOptions.map((item) => <option key={item.label} value={item.label}>{item.label}</option>)}
                </select>
                <select value={identityRegionFilter} onChange={(event) => setIdentityRegionFilter(event.target.value)} className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700">
                  <option value="">All regions</option>
                  {regionOptions.map((item) => <option key={item.label} value={item.label}>{item.label}</option>)}
                </select>
                <select value={identityCityFilter} onChange={(event) => setIdentityCityFilter(event.target.value)} className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700">
                  <option value="">All cities</option>
                  {cityOptions.map((item) => <option key={item.label} value={item.label}>{item.label}</option>)}
                </select>
                <select value={identitySegmentPreset} onChange={(event) => setIdentitySegmentPreset(event.target.value as IdentitySegmentPreset)} className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700">
                  {IDENTITY_SEGMENT_PRESETS.map((option) => <option key={option.value || 'custom'} value={option.value}>{option.label}</option>)}
                </select>
                <select value={globalCampaignFilter} onChange={(event) => setGlobalCampaignFilter(event.target.value)} className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700">
                  <option value="">All campaigns</option>
                  {campaignOptions.map((item) => <option key={item.id ?? item.label} value={item.id ?? ''}>{item.label}</option>)}
                </select>
                <select value={globalTagFilter} onChange={(event) => setGlobalTagFilter(event.target.value)} className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700">
                  <option value="">All tags</option>
                  {tagOptions.map((item) => <option key={item.id ?? item.label} value={item.id ?? ''}>{item.label}</option>)}
                </select>
                <select value={identityCreativeFilter} onChange={(event) => setIdentityCreativeFilter(event.target.value)} className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700">
                  <option value="">All creatives</option>
                  {creativeOptions.map((item) => <option key={item.id ?? item.label} value={item.id ?? ''}>{item.label}</option>)}
                </select>
                <select value={identityVariantFilter} onChange={(event) => setIdentityVariantFilter(event.target.value)} className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700">
                  <option value="">All variants</option>
                  {variantOptions.map((item) => <option key={item.id} value={item.id}>{item.creativeName} · {item.label}</option>)}
                </select>
                <input value={identityMinImpressions} onChange={(event) => setIdentityMinImpressions(event.target.value)} placeholder="Min impressions" inputMode="numeric" className="w-28 rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700" />
                <input value={identityMinClicks} onChange={(event) => setIdentityMinClicks(event.target.value)} placeholder="Min clicks" inputMode="numeric" className="w-24 rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700" />
                <select value={identityExportFormat} onChange={(event) => setIdentityExportFormat(event.target.value as IdentityExportFormat)} className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700">
                  {IDENTITY_EXPORT_FORMATS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <button onClick={() => void handleExportIdentityAudienceCsv()} className="px-3 py-2 text-xs border border-indigo-300 text-indigo-700 rounded-md hover:bg-indigo-50 transition-colors">Export Audience</button>
                <button onClick={() => void handleSaveAudience()} disabled={savingAudience} className="px-3 py-2 text-xs border border-emerald-300 text-emerald-700 rounded-md hover:bg-emerald-50 transition-colors disabled:opacity-60">
                  {savingAudience ? 'Saving...' : 'Save Audience'}
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {(data?.topIdentities ?? []).length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-slate-400">No identity data available</div>
                ) : (
                  (data?.topIdentities ?? []).map((item) => (
                    <div key={`identity-${item.label}`} className="flex items-center justify-between gap-4 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{item.label}</p>
                        {item.secondary ? <p className="mt-0.5 text-xs text-slate-500">{item.secondary}</p> : null}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-700">{fmtNum(item.value)}</p>
                        <p className="text-xs text-slate-400">impressions</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <RankedList title="Engagement Mix" emptyLabel="No engagement data available" items={data?.engagements ?? []} />
          </div>
        );
      case 'audienceLibrary':
        return (
          <div className="grid grid-cols-1 gap-6 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-800">Audience Library</h2>
                <p className="text-xs text-slate-500 mt-1">Saved audiences plus live presets derived from measured identity activity.</p>
              </div>
              {(data?.savedAudiences ?? []).length ? (
                <div className="divide-y divide-slate-100">
                  {(data?.savedAudiences ?? []).map((audience) => {
                    const summary = [
                      audience.canonicalType ? IDENTITY_FILTERS.find((option) => option.value === audience.canonicalType)?.label : null,
                      audience.country || null,
                      audience.siteDomain || null,
                      audience.region || null,
                      audience.city || null,
                      audience.segmentPreset ? IDENTITY_SEGMENT_PRESETS.find((option) => option.value === audience.segmentPreset)?.label : null,
                      IDENTITY_EXPORT_FORMATS.find((option) => option.value === audience.activationTemplate)?.label ?? 'Template',
                      audience.campaignId ? campaignOptions.find((item) => item.id === audience.campaignId)?.label ?? 'Campaign scoped' : null,
                      audience.tagId ? tagOptions.find((item) => item.id === audience.tagId)?.label ?? 'Tag scoped' : null,
                      audience.creativeId ? creativeOptions.find((item) => item.id === audience.creativeId)?.label ?? 'Creative scoped' : null,
                      audience.variantId ? variantOptions.find((item) => item.id === audience.variantId)?.label ?? 'Variant scoped' : null,
                      `Min ${audience.minImpressions} imps`,
                      `Min ${audience.minClicks} clicks`,
                    ].filter(Boolean).join(' · ');
                    return (
                      <div key={audience.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800">{audience.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{summary}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => applySavedAudience(audience)} className="px-3 py-2 text-xs border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors">Apply</button>
                          <button onClick={() => { void handleExportIdentityAudienceCsv(audience); }} className="px-3 py-2 text-xs border border-indigo-300 text-indigo-700 rounded-md hover:bg-indigo-50 transition-colors">Export</button>
                          <button onClick={() => void handleDeleteSavedAudience(audience)} className="px-3 py-2 text-xs border border-rose-300 text-rose-700 rounded-md hover:bg-rose-50 transition-colors">Delete</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : audiencePresets.length ? (
                <div className="divide-y divide-slate-100">
                  {audiencePresets.map((preset) => (
                    <div key={preset.presetValue} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">{preset.label}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{preset.secondary}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setIdentitySegmentPreset(preset.presetValue)} className="px-3 py-2 text-xs border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors">Apply</button>
                        <button onClick={() => void handleSaveAudience(preset.label, { segmentPreset: preset.presetValue })} className="px-3 py-2 text-xs border border-emerald-300 text-emerald-700 rounded-md hover:bg-emerald-50 transition-colors">Save</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-10 text-center text-sm text-slate-400">No saved audiences or live audience presets yet</div>
              )}
            </div>
          </div>
        );
      case 'regionalInsights':
        return <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6"><RankedList title="Top Regions" emptyLabel="No region data available" items={data?.topRegions ?? []} /><RankedList title="Top Cities" emptyLabel="No city data available" items={data?.topCities ?? []} /></div>;
      case 'trackerPerformance':
        return <div className="grid grid-cols-1 gap-6 mb-6"><RankedList title="Tracker Performance" emptyLabel="No tracker or delivery data available" items={data?.trackerPerformance ?? []} /></div>;
      case 'identityFrequency':
        return <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6"><RankedList title="Identity Frequency Buckets" emptyLabel="No identity frequency data available" items={data?.identityFrequency ?? []} /><RankedList title="Identity Segment Presets" emptyLabel="No identity segment data available" items={data?.identitySegments ?? []} /></div>;
      case 'identityAttribution':
        return <div className="grid grid-cols-1 gap-6 mb-6"><RankedList title="Identity Attribution Windows" emptyLabel="No identity attribution data available" items={data?.identityAttribution ?? []} /></div>;
      case 'identityKeys':
        return <div className="grid grid-cols-1 gap-6 mb-6"><RankedList title="Identity Keys by Event" emptyLabel="No identity key data available" items={data?.identityKeyBreakdown ?? []} /></div>;
      case 'campaignTagBreakdowns':
        return <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6"><BreakdownTable title="Campaign Performance" emptyLabel="No campaign data available" rows={data?.campaigns ?? []} secondaryLabel="Status" /><BreakdownTable title="Tag Performance" emptyLabel="No tag data available" rows={data?.tags ?? []} secondaryLabel="Format" /></div>;
      case 'creativeBreakdowns':
        return <div className="grid grid-cols-1 gap-6"><BreakdownTable title="Creative Performance" emptyLabel="No creative data available" rows={data?.creatives ?? []} secondaryLabel="Version" /><VariantTable rows={data?.variants ?? []} /></div>;
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reporting</h1>
          <p className="text-sm text-slate-500 mt-1">
            Workspace-level performance with site, country, tag, creative, variant, and rich media signals.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            {DATE_RANGES.map((range) => (
              <button
                key={range}
                onClick={() => {
                  setRangeMode('preset');
                  setDateRange(range);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  rangeMode === 'preset' && dateRange === range
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {formatRange(range)}
              </button>
            ))}
          </div>
          <div className={`flex items-center gap-2 rounded-lg border p-2 ${rangeMode === 'custom' ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
            <button
              onClick={() => setRangeMode('custom')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                rangeMode === 'custom' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Custom
            </button>
            <input
              type="date"
              value={customStartDate}
              onChange={(event) => {
                setRangeMode('custom');
                setCustomStartDate(event.target.value);
              }}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(event) => {
                setRangeMode('custom');
                setCustomEndDate(event.target.value);
              }}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700"
            />
          </div>
          <button
            onClick={load}
            disabled={rangeMode === 'custom' && !customDatesValid}
            className="px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handleResetLayout}
            className="px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Reset layout
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-800">Visible scope</p>
          <p className="mt-1 text-xs text-slate-500">
            Campaign: {campaignOptions.find((item) => item.id === globalCampaignFilter)?.label ?? 'All campaigns'} · Tag: {tagOptions.find((item) => item.id === globalTagFilter)?.label ?? 'All tags'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={globalCampaignFilter} onChange={(event) => setGlobalCampaignFilter(event.target.value)} className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700">
            <option value="">All campaigns</option>
            {campaignOptions.map((item) => <option key={item.id ?? item.label} value={item.id ?? ''}>{item.label}</option>)}
          </select>
          <select value={globalTagFilter} onChange={(event) => setGlobalTagFilter(event.target.value)} className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700">
            <option value="">All tags</option>
            {tagOptions.map((item) => <option key={item.id ?? item.label} value={item.id ?? ''}>{item.label}</option>)}
          </select>
        </div>
      </div>

      {rangeMode === 'custom' && !customDatesValid ? (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Choose a valid custom range. The start date needs to be before or equal to the end date.
        </div>
      ) : null}
      {moduleOrder.map((moduleId, index) => (
        <section
          key={moduleId}
          draggable
          onDragStart={() => setDraggedModule(moduleId)}
          onDragEnd={() => setDraggedModule(null)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (!draggedModule || draggedModule === moduleId) return;
            setModuleOrder((current) => reorderByValue(current, draggedModule, moduleId));
            setDraggedModule(null);
          }}
          className={draggedModule === moduleId ? 'opacity-60' : ''}
        >
          <ModuleControls
            title={moduleId === 'primaryKpis' ? 'Primary KPI Cards'
              : moduleId === 'secondaryKpis' ? 'Secondary KPI Cards'
              : moduleId === 'performanceTrend' ? 'Performance Trend'
              : moduleId === 'topInsights' ? 'Top Insights'
              : moduleId === 'audienceLibrary' ? 'Audience Library'
              : moduleId === 'regionalInsights' ? 'Regional Insights'
              : moduleId === 'trackerPerformance' ? 'Tracker Performance'
              : moduleId === 'identityFrequency' ? 'Identity Frequency'
              : moduleId === 'identityAttribution' ? 'Identity Attribution'
              : moduleId === 'identityKeys' ? 'Identity Keys'
              : moduleId === 'campaignTagBreakdowns' ? 'Campaign and Tag Breakdowns'
              : 'Creative Breakdowns'}
            canMoveUp={index > 0}
            canMoveDown={index < moduleOrder.length - 1}
            onMoveUp={() => setModuleOrder((current) => moveItem(current, index, index - 1))}
            onMoveDown={() => setModuleOrder((current) => moveItem(current, index, index + 1))}
          />
          {renderModule(moduleId)}
        </section>
      ))}
    </div>
  );
}
