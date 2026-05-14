import type { ReportingDataViewModel } from './hooks/useReportingData';
import type { CampaignPerformanceRow, ReportingKpi, ReportingMode, SpendView } from './reporting.types';

type RawExportRow = {
  exported_at: string;
  report_mode: string;
  advertiser: string;
  date_range: string;
  time_scope: string;
  status_filter: string;
  spend_view: string;
  search: string;
  section: string;
  entity_type: string;
  entity_id?: string;
  name?: string;
  status?: string;
  metric?: string;
  value?: string | number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  spend?: number;
  viewability?: number;
  completion_rate?: number;
  identity_reach?: number;
  share?: string;
  format?: string;
  kind?: string;
  date?: string;
  display?: number;
  video?: number;
  identity?: number;
  total?: number;
  detail?: string;
};

const RAW_EXPORT_COLUMNS: Array<keyof RawExportRow> = [
  'exported_at',
  'report_mode',
  'advertiser',
  'date_range',
  'time_scope',
  'status_filter',
  'spend_view',
  'search',
  'section',
  'entity_type',
  'entity_id',
  'name',
  'status',
  'metric',
  'value',
  'impressions',
  'clicks',
  'ctr',
  'spend',
  'viewability',
  'completion_rate',
  'identity_reach',
  'share',
  'format',
  'kind',
  'date',
  'display',
  'video',
  'identity',
  'total',
  'detail',
];

function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function toPercentNumber(value: string) {
  const parsed = Number(value.replace('%', ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function buildReportingCsv({
  mode,
  advertiserLabel,
  dateRangeLabel,
  timeScopeLabel,
  statusFilter,
  spendView,
  search,
  kpis,
  data,
}: {
  mode: ReportingMode;
  advertiserLabel: string;
  dateRangeLabel: string;
  timeScopeLabel: string;
  statusFilter: string;
  spendView: SpendView;
  search: string;
  kpis: ReportingKpi[];
  data: ReportingDataViewModel;
}) {
  const exportedAt = new Date().toISOString();
  const base = {
    exported_at: exportedAt,
    report_mode: mode,
    advertiser: advertiserLabel,
    date_range: dateRangeLabel,
    time_scope: timeScopeLabel,
    status_filter: statusFilter,
    spend_view: spendView === 'with_margin' ? 'with_margin' : 'without_margin',
    search: search.trim(),
  };
  const rows: RawExportRow[] = [];
  const push = (row: Omit<RawExportRow, keyof typeof base>) => rows.push({ ...base, ...row });

  kpis.forEach((item) => push({
    section: 'kpi',
    entity_type: 'metric',
    name: item.label,
    metric: item.id,
    value: item.rawValue ?? item.value,
    detail: item.helper ?? item.delta ?? '',
  }));

  data.trend.forEach((series) => {
    series.points.forEach((point) => push({
      section: 'trend',
      entity_type: 'time_bucket',
      name: series.label,
      metric: series.id,
      date: point.date,
      value: point.value,
      display: point.display,
      video: point.video,
      identity: point.identity,
      total: point.total,
    }));
  });

  const performanceGroups: Array<{
    section: string;
    entityType: string;
    rows: CampaignPerformanceRow[];
  }> = [
    { section: 'campaign_performance', entityType: 'campaign', rows: data.campaignRows },
    { section: 'tag_performance', entityType: 'tag', rows: data.tagRows },
    { section: 'creative_performance', entityType: 'creative', rows: data.creativeRows },
    { section: 'variant_performance', entityType: 'variant', rows: data.variantRows },
  ];

  performanceGroups.forEach(({ section, entityType, rows: sourceRows }) => {
    sourceRows.forEach((row) => push({
      section,
      entity_type: entityType,
      entity_id: row.id,
      name: row.name,
      status: row.status,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: row.ctr,
      spend: row.spend,
      viewability: row.viewability,
      completion_rate: row.completionRate,
      identity_reach: row.identityReach,
      detail: row.secondaryLabel ?? row.spendHelper ?? '',
    }));
  });

  data.topRegions.forEach((row) => push({
    section: 'top_regions',
    entity_type: 'region',
    name: row.name,
    metric: row.metricLabel ?? 'metric',
    value: toPercentNumber(row.metric) ?? row.metric,
    impressions: row.impressions,
    share: row.share,
  }));

  data.rawInventorySourceRows.forEach((row) => push({
    section: row.kind === 'App' ? 'apps' : 'sites',
    entity_type: row.kind.toLowerCase(),
    name: row.name,
    kind: row.kind,
    impressions: row.impressions,
    clicks: row.clicks,
    ctr: toPercentNumber(row.metric),
    share: row.share,
    detail: row.detail ?? '',
  }));

  data.topCreatives.forEach((row) => push({
    section: 'top_creatives',
    entity_type: 'creative',
    name: row.name,
    format: row.format,
    impressions: row.impressions,
    clicks: row.clicks,
    ctr: row.ctr,
    metric: row.metric,
    detail: row.helper,
  }));

  data.deviceRows.forEach((row) => push({
    section: 'device',
    entity_type: 'device_signal',
    name: row.name,
    kind: row.kind,
    impressions: row.impressions,
    value: row.metric,
    share: row.share,
  }));

  data.connectionRows.forEach((row) => push({
    section: 'connection',
    entity_type: 'connection_signal',
    name: row.name,
    kind: row.kind,
    impressions: row.impressions,
    value: row.metric,
    share: row.share,
  }));

  data.videoFunnel.forEach((row) => push({
    section: 'video_funnel',
    entity_type: 'video_step',
    entity_id: row.id,
    name: row.label,
    value: row.value,
    completion_rate: row.rate,
  }));

  data.videoFormatRows.forEach((row) => push({
    section: 'video_formats',
    entity_type: 'video_format',
    entity_id: row.id,
    name: row.label,
    value: row.starts,
    share: `${row.percentage}%`,
  }));

  data.identitySegments.forEach((row) => push({
    section: 'identity_segments',
    entity_type: 'identity_key',
    name: row.key,
    value: row.value,
    share: `${row.percentage}%`,
  }));

  data.identityFrequencyRows.forEach((row) => push({
    section: 'identity_frequency',
    entity_type: 'frequency_bucket',
    name: row.bucket,
    impressions: row.impressions,
    clicks: row.clicks,
    value: row.identities,
    ctr: toPercentNumber(row.ctr),
  }));

  data.identityKeyRows.forEach((row) => push({
    section: 'identity_keys',
    entity_type: 'identity_key',
    name: row.label,
    value: row.value,
    detail: row.helper,
  }));

  data.attributionWindowRows.forEach((row) => push({
    section: 'attribution_windows',
    entity_type: 'attribution_window',
    name: row.label,
    value: row.value,
    detail: row.helper,
  }));

  data.audienceExportRows.forEach((row) => push({
    section: 'audience_exports',
    entity_type: 'audience_segment',
    name: row.label,
    value: row.value,
    detail: row.helper,
  }));

  const lines = [
    RAW_EXPORT_COLUMNS.map(csvCell).join(','),
    ...rows.map((row) => RAW_EXPORT_COLUMNS.map((column) => csvCell(row[column])).join(',')),
  ];

  return `${lines.join('\n')}\n`;
}

export function downloadReportingCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
