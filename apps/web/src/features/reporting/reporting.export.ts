import type { ReportingDataViewModel } from './hooks/useReportingData';
import type { ReportingKpi, ReportingMode, SpendView } from './reporting.types';

function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function csvSection(title: string, headers: string[], rows: Array<Array<unknown>>) {
  if (!rows.length) return [];
  return [
    [title],
    headers,
    ...rows,
    [],
  ].map((row) => row.map(csvCell).join(','));
}

function money(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '';
}

function percent(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(2)}%` : '';
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
  const lines = [
    ...csvSection('Report metadata', ['Field', 'Value'], [
      ['Generated at', new Date().toISOString()],
      ['Mode', mode],
      ['Advertiser', advertiserLabel],
      ['Date range', dateRangeLabel],
      ['Time scope', timeScopeLabel],
      ['Status filter', statusFilter],
      ['Spend view', spendView === 'with_margin' ? 'With margin' : 'Without margin'],
      ['Search', search.trim() || ''],
    ]),
    ...csvSection('KPIs', ['Metric', 'Value', 'Delta', 'Description'], kpis.map((item) => [
      item.label,
      item.value,
      item.delta ?? '',
      item.helper ?? '',
    ])),
    ...csvSection('Trend', ['Series', 'Date', 'Value', 'Display', 'Video', 'Identity', 'Total'], data.trend.flatMap((series) => (
      series.points.map((point) => [
        series.label,
        point.date,
        point.value ?? '',
        point.display ?? '',
        point.video ?? '',
        point.identity ?? '',
        point.total ?? '',
      ])
    ))),
    ...csvSection('Campaign performance', ['Name', 'Status', 'Impressions', 'Clicks', 'CTR', 'Spend', 'Viewability', 'Detail'], data.campaignRows.map((row) => [
      row.name, row.status, row.impressions, row.clicks, percent(row.ctr), money(row.spend), percent(row.viewability), row.secondaryLabel ?? '',
    ])),
    ...csvSection('Tag performance', ['Name', 'Status', 'Impressions', 'Clicks', 'CTR', 'Spend', 'Viewability', 'Detail'], data.tagRows.map((row) => [
      row.name, row.status, row.impressions, row.clicks, percent(row.ctr), money(row.spend), percent(row.viewability), row.secondaryLabel ?? '',
    ])),
    ...csvSection('Creative performance', ['Name', 'Status', 'Impressions', 'Clicks', 'CTR', 'Spend', 'Viewability', 'Detail'], data.creativeRows.map((row) => [
      row.name, row.status, row.impressions, row.clicks, percent(row.ctr), money(row.spend), percent(row.viewability), row.secondaryLabel ?? '',
    ])),
    ...csvSection('Variant performance', ['Name', 'Status', 'Impressions', 'Clicks', 'CTR', 'Spend', 'Viewability', 'Detail'], data.variantRows.map((row) => [
      row.name, row.status, row.impressions, row.clicks, percent(row.ctr), money(row.spend), percent(row.viewability), row.secondaryLabel ?? '',
    ])),
    ...csvSection('Top regions', ['Region / state', 'Impressions', 'Metric', 'Metric label', 'Share'], data.topRegions.map((row) => [
      row.name, row.impressions, row.metric, row.metricLabel ?? '', row.share,
    ])),
    ...csvSection('Sites and apps', ['Name', 'Kind', 'Impressions', 'Clicks', 'Metric', 'Share', 'Detail'], data.inventorySourceRows.map((row) => [
      row.name, row.kind, row.impressions, row.clicks ?? '', row.metric, row.share, row.detail ?? '',
    ])),
    ...csvSection('Top creatives', ['Name', 'Format', 'Impressions', 'Clicks', 'CTR', 'Metric', 'Detail'], data.topCreatives.map((row) => [
      row.name, row.format, row.impressions ?? '', row.clicks ?? '', percent(row.ctr), row.metric, row.helper,
    ])),
    ...csvSection('Device', ['Name', 'Kind', 'Impressions', 'Metric', 'Share'], data.deviceRows.map((row) => [
      row.name, row.kind, row.impressions, row.metric, row.share,
    ])),
    ...csvSection('Connection', ['Name', 'Kind', 'Impressions', 'Metric', 'Share'], data.connectionRows.map((row) => [
      row.name, row.kind, row.impressions, row.metric, row.share,
    ])),
    ...csvSection('Video funnel', ['Step', 'Value', 'Rate'], data.videoFunnel.map((row) => [
      row.label, row.value, percent(row.rate),
    ])),
    ...csvSection('Video formats', ['Format', 'Starts', 'Percentage'], data.videoFormatRows.map((row) => [
      row.label, row.starts, percent(row.percentage),
    ])),
    ...csvSection('Identity segments', ['Key', 'Value', 'Percentage'], data.identitySegments.map((row) => [
      row.key, row.value, percent(row.percentage),
    ])),
    ...csvSection('Identity frequency', ['Bucket', 'Identities', 'Impressions', 'Clicks', 'CTR'], data.identityFrequencyRows.map((row) => [
      row.bucket, row.identities, row.impressions, row.clicks, row.ctr,
    ])),
    ...csvSection('Identity keys', ['Label', 'Value', 'Detail'], data.identityKeyRows.map((row) => [
      row.label, row.value, row.helper,
    ])),
    ...csvSection('Attribution windows', ['Label', 'Value', 'Detail'], data.attributionWindowRows.map((row) => [
      row.label, row.value, row.helper,
    ])),
    ...csvSection('Audience exports', ['Label', 'Value', 'Detail'], data.audienceExportRows.map((row) => [
      row.label, row.value, row.helper,
    ])),
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
