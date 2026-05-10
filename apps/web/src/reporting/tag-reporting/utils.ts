import type {
  DailyStat,
  ReportingExportParams,
  ReportingTab,
  TagBindingOption,
  TagContextSnapshot,
  TagSummary,
} from './types';

export const DATE_RANGES = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
];

export const REPORTING_TABS: Array<{ id: ReportingTab; label: string }> = [
  { id: 'display', label: 'Display' },
  { id: 'video', label: 'Video' },
  { id: 'identity', label: 'Identity' },
];

export const DATE_RANGE_OPTIONS = DATE_RANGES.map((range) => ({
  value: String(range.days),
  label: range.label,
}));

export const REPORTING_TAB_OPTIONS = REPORTING_TABS.map((tab) => ({
  value: tab.id,
  label: tab.label,
}));

export function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function fmtDurationFromMs(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

export function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function deriveInventoryEnvironment(context: TagContextSnapshot | null): string {
  if (!context) return 'Unknown';
  if (context.appId || context.appBundle || context.appName || context.appStoreName) {
    return context.deviceType === 'tv' ? 'CTV App' : 'App';
  }
  if (context.deviceType === 'tv') return 'CTV';
  if (context.siteDomain || context.pageUrl) return 'Site';
  return 'Unknown';
}

export function deriveIdentitySource(context: TagContextSnapshot | null): string {
  if (!context) return 'Unavailable';
  if (context.appId || context.appBundle || context.appName) return 'Reported by DSP/App';
  if (context.siteDomain || context.pageUrl) return 'Inferred from request';
  return 'Limited signal';
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toText(value: unknown): string {
  return String(value ?? '').trim();
}

export function normalizeContextSnapshot(source: any): TagContextSnapshot | null {
  if (!source || typeof source !== 'object') return null;
  const snapshot: TagContextSnapshot = {
    siteDomain: toText(source.siteDomain ?? source.site_domain),
    pageUrl: toText(source.pageUrl ?? source.page_url),
    country: toText(source.country),
    region: toText(source.region),
    city: toText(source.city),
    deviceType: toText(source.deviceType ?? source.device_type),
    deviceModel: toText(source.deviceModel ?? source.device_model),
    browser: toText(source.browser),
    os: toText(source.os),
    contextualIds: toText(source.contextualIds ?? source.contextual_ids),
    networkId: toText(source.networkId ?? source.network_id),
    sourcePublisherId: toText(source.sourcePublisherId ?? source.source_publisher_id),
    appId: toText(source.appId ?? source.app_id),
    siteId: toText(source.siteId ?? source.site_id),
    exchangeId: toText(source.exchangeId ?? source.exchange_id),
    exchangePublisherId: toText(source.exchangePublisherId ?? source.exchange_publisher_id),
    exchangeSiteIdOrDomain: toText(source.exchangeSiteIdOrDomain ?? source.exchange_site_id_or_domain),
    appBundle: toText(source.appBundle ?? source.app_bundle),
    appName: toText(source.appName ?? source.app_name),
    pagePosition: toText(source.pagePosition ?? source.page_position),
    contentLanguage: toText(source.contentLanguage ?? source.content_language),
    contentTitle: toText(source.contentTitle ?? source.content_title),
    contentSeries: toText(source.contentSeries ?? source.content_series),
    carrier: toText(source.carrier),
    appStoreName: toText(source.appStoreName ?? source.app_store_name),
    contentGenre: toText(source.contentGenre ?? source.content_genre),
  };
  return Object.values(snapshot).some(Boolean) ? snapshot : null;
}

export function normalizeTagSummary(source: any): TagSummary | null {
  if (!source || typeof source !== 'object') return null;
  return {
    totalImpressions: toNumber(source.totalImpressions ?? source.total_impressions),
    totalClicks: toNumber(source.totalClicks ?? source.total_clicks),
    ctr: toNumber(source.ctr ?? source.overall_ctr),
    viewabilityRate: toNumber(source.viewabilityRate ?? source.viewability_rate ?? source.overallViewability ?? source.overall_viewability),
    engagementRate: toNumber(source.engagementRate ?? source.engagement_rate),
    totalInViewDurationMs: toNumber(source.totalInViewDurationMs ?? source.total_in_view_duration_ms),
    totalAttentionDurationMs: toNumber(source.totalAttentionDurationMs ?? source.total_attention_duration_ms ?? source.totalHoverDurationMs ?? source.total_hover_duration_ms),
    impressionsLast7d: toNumber(source.impressionsLast7d ?? source.impressions_7d),
    uniqueIdentities: toNumber(source.uniqueIdentities ?? source.unique_identities),
    avgFrequency: toNumber(source.avgFrequency ?? source.avg_frequency),
    videoStarts: toNumber(source.videoStarts ?? source.video_starts),
    videoStartRate: toNumber(source.videoStartRate ?? source.video_start_rate),
    videoCompletions: toNumber(source.videoCompletions ?? source.video_completions),
    videoCompletionRate: toNumber(source.videoCompletionRate ?? source.video_completion_rate),
    latestContext: normalizeContextSnapshot(source.latestContext ?? source.latest_context),
  };
}

export function normalizeDailyStats(source: any): DailyStat[] {
  if (!Array.isArray(source)) return [];
  return source.map(item => ({
    date: String(item?.date ?? ''),
    impressions: toNumber(item?.impressions),
    clicks: toNumber(item?.clicks),
    videoStarts: toNumber(item?.videoStarts ?? item?.video_starts),
    videoCompletions: toNumber(item?.videoCompletions ?? item?.video_completions),
  })).filter(item => item.date);
}

export function normalizeBindings(source: any): TagBindingOption[] {
  if (!Array.isArray(source)) return [];
  return source.map(item => ({
    id: String(item?.id ?? ''),
    creativeId: String(item?.creativeId ?? item?.creative_id ?? ''),
    creativeVersionId: String(item?.creativeVersionId ?? item?.creative_version_id ?? ''),
    creativeSizeVariantId: String(item?.creativeSizeVariantId ?? item?.creative_size_variant_id ?? ''),
    creativeName: String(item?.creativeName ?? item?.creative_name ?? ''),
    variantLabel: String(item?.variantLabel ?? item?.variant_label ?? ''),
    variantWidth: item?.variantWidth ?? item?.variant_width ?? null,
    variantHeight: item?.variantHeight ?? item?.variant_height ?? null,
    status: String(item?.status ?? ''),
  })).filter(item => item.id);
}

export function formatVariantName(binding: TagBindingOption) {
  const explicit = binding.variantLabel.trim();
  if (explicit) {
    if (binding.variantWidth && binding.variantHeight) {
      return `${explicit} · ${binding.variantWidth}×${binding.variantHeight}`;
    }
    return explicit;
  }
  if (binding.variantWidth && binding.variantHeight) {
    return `${binding.variantWidth}×${binding.variantHeight}`;
  }
  return 'Default size';
}

export function slugify(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'tag-report';
}

export async function exportTagReportingWorkbook({
  tagName,
  dateRange,
  selectedCreativeName,
  selectedVariantName,
  summary,
  stats,
}: ReportingExportParams) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();

  const filterSummary = [
    { Filter: 'Tag', Value: tagName },
    { Filter: 'Date Range', Value: `Last ${dateRange} days` },
    { Filter: 'Assigned Creative', Value: selectedCreativeName || 'All' },
    { Filter: 'Creative Size', Value: selectedVariantName || 'All' },
  ];

  const summaryRows = [
    { Metric: 'Total Impressions', Value: summary.totalImpressions },
    { Metric: 'Total Clicks', Value: summary.totalClicks },
    { Metric: 'CTR (%)', Value: Number(summary.ctr.toFixed(2)) },
    { Metric: 'Viewability (%)', Value: Number(summary.viewabilityRate.toFixed(2)) },
    { Metric: 'In-View Time (ms)', Value: summary.totalInViewDurationMs },
    { Metric: 'Attention Time (ms)', Value: summary.totalAttentionDurationMs },
    { Metric: 'Last 7d Impressions', Value: summary.impressionsLast7d },
    { Metric: 'Video Starts', Value: summary.videoStarts },
    { Metric: 'Start Rate (%)', Value: Number(summary.videoStartRate.toFixed(2)) },
    { Metric: 'Plays Completed', Value: summary.videoCompletions },
    { Metric: 'Completion Rate (%)', Value: Number(summary.videoCompletionRate.toFixed(2)) },
  ];

  const contextRows = summary.latestContext
    ? [
        { Field: 'Site Domain', Value: summary.latestContext.siteDomain || 'n/a' },
        { Field: 'Page URL', Value: summary.latestContext.pageUrl || 'n/a' },
        { Field: 'Country', Value: summary.latestContext.country || 'n/a' },
        { Field: 'Region', Value: summary.latestContext.region || 'n/a' },
        { Field: 'City', Value: summary.latestContext.city || 'n/a' },
        { Field: 'Device Type', Value: summary.latestContext.deviceType || 'n/a' },
        { Field: 'Device Model', Value: summary.latestContext.deviceModel || 'n/a' },
        { Field: 'Browser', Value: summary.latestContext.browser || 'n/a' },
        { Field: 'OS', Value: summary.latestContext.os || 'n/a' },
        { Field: 'Contextual IDs', Value: summary.latestContext.contextualIds || 'n/a' },
        { Field: 'Network ID', Value: summary.latestContext.networkId || 'n/a' },
        { Field: 'Source Publisher ID', Value: summary.latestContext.sourcePublisherId || 'n/a' },
        { Field: 'App ID', Value: summary.latestContext.appId || 'n/a' },
        { Field: 'Site ID', Value: summary.latestContext.siteId || 'n/a' },
        { Field: 'Exchange ID', Value: summary.latestContext.exchangeId || 'n/a' },
        { Field: 'Exchange Publisher ID', Value: summary.latestContext.exchangePublisherId || 'n/a' },
        { Field: 'Exchange Site/Domain', Value: summary.latestContext.exchangeSiteIdOrDomain || 'n/a' },
        { Field: 'App Bundle', Value: summary.latestContext.appBundle || 'n/a' },
        { Field: 'App Name', Value: summary.latestContext.appName || 'n/a' },
        { Field: 'Page Position', Value: summary.latestContext.pagePosition || 'n/a' },
        { Field: 'Content Language', Value: summary.latestContext.contentLanguage || 'n/a' },
        { Field: 'Content Title', Value: summary.latestContext.contentTitle || 'n/a' },
        { Field: 'Content Series', Value: summary.latestContext.contentSeries || 'n/a' },
        { Field: 'Carrier', Value: summary.latestContext.carrier || 'n/a' },
        { Field: 'App Store Name', Value: summary.latestContext.appStoreName || 'n/a' },
        { Field: 'Content Genre', Value: summary.latestContext.contentGenre || 'n/a' },
      ]
    : [];

  const breakdownRows = [...stats]
    .reverse()
    .map((row) => {
      const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
      const startRate = row.impressions > 0 ? (row.videoStarts / row.impressions) * 100 : 0;
      const completionRate = row.videoStarts > 0 ? (row.videoCompletions / row.videoStarts) * 100 : 0;
      return {
        Date: row.date,
        Impressions: row.impressions,
        Clicks: row.clicks,
        'Play Starts': row.videoStarts,
        'Plays Completed': row.videoCompletions,
        'CTR (%)': Number(ctr.toFixed(2)),
        'Start Rate (%)': Number(startRate.toFixed(2)),
        'Completion Rate (%)': Number(completionRate.toFixed(2)),
      };
    });

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(filterSummary), 'Filters');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
  if (contextRows.length) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(contextRows), 'Latest Context');
  }
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(breakdownRows), 'Daily Breakdown');
  XLSX.writeFile(workbook, `${slugify(tagName)}-report.xlsx`);
}
