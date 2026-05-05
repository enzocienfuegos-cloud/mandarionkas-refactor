import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Panel, PrimaryButton, SectionKicker, StatusBadge } from '../shared/dusk-ui';

interface Tag {
  id: string;
  name: string;
  format: string;
}

interface TagBindingOption {
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

interface TagSummary {
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

interface TagContextSnapshot {
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

type ReportingTab = 'display' | 'video' | 'identity';

interface DailyStat {
  date: string;
  impressions: number;
  clicks: number;
  videoStarts: number;
  videoCompletions: number;
}

function BarChart({ data }: { data: DailyStat[] }) {
  const W = 600;
  const H = 120;
  const PAD = { l: 40, r: 10, t: 10, b: 30 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const max = Math.max(...data.map(d => d.impressions), 1);
  const barW = data.length > 0 ? Math.max(2, (chartW / data.length) - 2) : 0;
  const labelStep = Math.max(1, Math.ceil(data.length / 7));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + chartH} stroke="#e2e8f0" strokeWidth="1" />
      <line x1={PAD.l} y1={PAD.t + chartH} x2={PAD.l + chartW} y2={PAD.t + chartH} stroke="#e2e8f0" strokeWidth="1" />

      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const y = PAD.t + chartH - frac * chartH;
        const val = Math.round(max * frac);
        return (
          <g key={frac}>
            <line x1={PAD.l} y1={y} x2={PAD.l + chartW} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PAD.l - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
              {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const barH = max > 0 ? (d.impressions / max) * chartH : 0;
        const x = PAD.l + i * (chartW / data.length) + 1;
        const y = PAD.t + chartH - barH;
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barW} height={barH} fill="#6366f1" rx="2">
              <title>{d.date}: {d.impressions.toLocaleString()} impressions</title>
            </rect>
            {i % labelStep === 0 && (
              <text x={x + barW / 2} y={H - 4} textAnchor="middle" fontSize="8" fill="#94a3b8">
                {new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const KpiCard = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <Panel className="p-5">
    <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-white/42">{label}</p>
    <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
    {sub ? <p className="mt-0.5 text-xs text-slate-400 dark:text-white/36">{sub}</p> : null}
  </Panel>
);

const DATE_RANGES = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
];

const REPORTING_TABS: Array<{ id: ReportingTab; label: string }> = [
  { id: 'display', label: 'Display' },
  { id: 'video', label: 'Video' },
  { id: 'identity', label: 'Identity' },
];

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDurationFromMs(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function deriveInventoryEnvironment(context: TagContextSnapshot | null): string {
  if (!context) return 'Unknown';
  if (context.appId || context.appBundle || context.appName || context.appStoreName) {
    return context.deviceType === 'tv' ? 'CTV App' : 'App';
  }
  if (context.deviceType === 'tv') return 'CTV';
  if (context.siteDomain || context.pageUrl) return 'Site';
  return 'Unknown';
}

function deriveIdentitySource(context: TagContextSnapshot | null): string {
  if (!context) return 'Unavailable';
  if (context.appId || context.appBundle || context.appName) return 'Reported by DSP/App';
  if (context.siteDomain || context.pageUrl) return 'Inferred from request';
  return 'Limited signal';
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 last:border-b-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-sm text-slate-700 text-right break-all">{value || 'n/a'}</span>
    </div>
  );
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeContextSnapshot(source: any): TagContextSnapshot | null {
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

function normalizeTagSummary(source: any): TagSummary | null {
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

function normalizeDailyStats(source: any): DailyStat[] {
  if (!Array.isArray(source)) return [];
  return source.map(item => ({
    date: String(item?.date ?? ''),
    impressions: toNumber(item?.impressions),
    clicks: toNumber(item?.clicks),
    videoStarts: toNumber(item?.videoStarts ?? item?.video_starts),
    videoCompletions: toNumber(item?.videoCompletions ?? item?.video_completions),
  })).filter(item => item.date);
}

function normalizeBindings(source: any): TagBindingOption[] {
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

function formatVariantName(binding: TagBindingOption) {
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

function slugify(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'tag-report';
}

export default function TagReportingDashboard() {
  const { id: routeTagId = '' } = useParams();
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [summary, setSummary] = useState<TagSummary | null>(null);
  const [stats, setStats] = useState<DailyStat[]>([]);
  const [bindings, setBindings] = useState<TagBindingOption[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [loadingBindings, setLoadingBindings] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [statsError, setStatsError] = useState('');
  const [dateRange, setDateRange] = useState(7);
  const [tagSearch, setTagSearch] = useState('');
  const [selectedCreativeId, setSelectedCreativeId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [activeTab, setActiveTab] = useState<ReportingTab>('display');

  useEffect(() => {
    fetch('/v1/tags?scope=all&limit=500', { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('Failed to load tags');
        return r.json();
      })
      .then(d => {
        const list: Tag[] = d?.tags ?? d ?? [];
        setTags(list);
        if (!list.length) return;
        const initial = routeTagId
          ? list.find(tag => tag.id === routeTagId) ?? list[0]
          : list[0];
        setSelectedTag(initial);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoadingTags(false));
  }, [routeTagId]);

  useEffect(() => {
    if (!routeTagId) return;
    fetch(`/v1/tags/${routeTagId}`, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('Failed to load selected tag');
        return r.json();
      })
      .then(data => {
        const rawTag = data?.tag ?? data;
        if (!rawTag?.id) return;
        const normalizedTag: Tag = {
          id: String(rawTag.id),
          name: String(rawTag.name ?? ''),
          format: String(rawTag.format ?? ''),
        };
        setTags(prev => prev.some(tag => tag.id === normalizedTag.id) ? prev : [normalizedTag, ...prev]);
        setSelectedTag(normalizedTag);
      })
      .catch(() => {
        // Leave the list-selected fallback in place if the direct fetch fails.
      });
  }, [routeTagId]);

  useEffect(() => {
    if (!selectedTag) {
      setBindings([]);
      return;
    }

    setLoadingBindings(true);
    fetch(`/v1/tags/${selectedTag.id}/bindings`, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('Failed to load tag bindings');
        return r.json();
      })
      .then(data => {
        setBindings(normalizeBindings(data?.bindings ?? data ?? []));
      })
      .catch(() => setBindings([]))
      .finally(() => setLoadingBindings(false));
  }, [selectedTag]);

  useEffect(() => {
    setSelectedCreativeId('');
    setSelectedVariantId('');
  }, [selectedTag?.id]);

  const creativeOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    bindings.forEach(binding => {
      if (!binding.creativeId || map.has(binding.creativeId)) return;
      map.set(binding.creativeId, { id: binding.creativeId, name: binding.creativeName || binding.creativeId });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [bindings]);

  const variantOptions = useMemo(() => {
    const base = selectedCreativeId
      ? bindings.filter(binding => binding.creativeId === selectedCreativeId)
      : bindings;
    const map = new Map<string, { id: string; name: string }>();
    base.forEach(binding => {
      if (!binding.creativeSizeVariantId || map.has(binding.creativeSizeVariantId)) return;
      map.set(binding.creativeSizeVariantId, {
        id: binding.creativeSizeVariantId,
        name: formatVariantName(binding),
      });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [bindings, selectedCreativeId]);

  useEffect(() => {
    if (selectedVariantId && !variantOptions.some(option => option.id === selectedVariantId)) {
      setSelectedVariantId('');
    }
  }, [selectedVariantId, variantOptions]);

  const filteredTags = useMemo(() => {
    const needle = tagSearch.trim().toLowerCase();
    if (!needle) return tags;
    return tags.filter(tag => tag.name.toLowerCase().includes(needle));
  }, [tags, tagSearch]);

  const inventoryEnvironment = useMemo(
    () => deriveInventoryEnvironment(summary?.latestContext ?? null),
    [summary?.latestContext],
  );

  const identitySource = useMemo(
    () => deriveIdentitySource(summary?.latestContext ?? null),
    [summary?.latestContext],
  );

  const loadTagData = useCallback((tag: Tag, days: number, filters: { creativeId: string; creativeSizeVariantId: string }) => {
    setLoadingStats(true);
    setStatsError('');

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    const from = dateFrom.toISOString().slice(0, 10);
    const params = new URLSearchParams({ dateFrom: from });
    if (filters.creativeId) params.set('creativeId', filters.creativeId);
    if (filters.creativeSizeVariantId) params.set('creativeSizeVariantId', filters.creativeSizeVariantId);

    Promise.all([
      fetch(`/v1/tags/${tag.id}/summary?${params.toString()}`, { credentials: 'include' }).then(r => {
        if (!r.ok) throw new Error('Failed to load summary');
        return r.json();
      }),
      fetch(`/v1/tags/${tag.id}/stats?${params.toString()}`, { credentials: 'include' }).then(r => {
        if (!r.ok) throw new Error('Failed to load stats');
        return r.json();
      }),
    ])
      .then(([sumData, statData]) => {
        setSummary(normalizeTagSummary(sumData?.summary ?? sumData ?? null));
        setStats(normalizeDailyStats(statData?.stats ?? statData ?? []));
      })
      .catch(() => setStatsError('Failed to load tag statistics.'))
      .finally(() => setLoadingStats(false));
  }, []);

  useEffect(() => {
    if (selectedTag) {
      loadTagData(selectedTag, dateRange, {
        creativeId: selectedCreativeId,
        creativeSizeVariantId: selectedVariantId,
      });
    }
  }, [selectedTag, dateRange, selectedCreativeId, selectedVariantId, loadTagData]);

  const handleExport = useCallback(async () => {
    if (!selectedTag || !summary) return;
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();

      const filterSummary = [
        { Filter: 'Tag', Value: selectedTag.name },
        { Filter: 'Date Range', Value: `Last ${dateRange} days` },
        { Filter: 'Assigned Creative', Value: creativeOptions.find(option => option.id === selectedCreativeId)?.name ?? 'All' },
        { Filter: 'Creative Size', Value: variantOptions.find(option => option.id === selectedVariantId)?.name ?? 'All' },
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
        .map(row => {
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
      XLSX.writeFile(workbook, `${slugify(selectedTag.name)}-report.xlsx`);
    } catch (exportError) {
      setStatsError(exportError instanceof Error ? exportError.message : 'Failed to export Excel file.');
    } finally {
      setExporting(false);
    }
  }, [creativeOptions, dateRange, selectedCreativeId, selectedTag, selectedVariantId, stats, summary, variantOptions]);

  if (loadingTags) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-fuchsia-500" />
      </div>
    );
  }

  if (error) {
    return (
      <Panel className="border-rose-200 bg-rose-50/90 p-4 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
        <p className="font-medium">Error loading tags</p>
        <p className="text-sm mt-1">{error}</p>
      </Panel>
    );
  }

  return (
    <div className="dusk-page">
      <div className="dusk-page-header">
        <div>
          <SectionKicker>Reporting</SectionKicker>
          <h1 className="dusk-title mt-3">Tag Reporting</h1>
          <p className="dusk-copy mt-2">Tag-level impression, click, identity, and video analytics in one operational view.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="basis-[18rem] flex-shrink-0">
          <Panel className="overflow-hidden">
            <div className="space-y-2 border-b border-slate-100 bg-slate-50/80 px-3 py-3 dark:border-white/[0.07] dark:bg-white/[0.03]">
              <SectionKicker>Tags</SectionKicker>
              <input
                type="search"
                value={tagSearch}
                onChange={event => setTagSearch(event.target.value)}
                placeholder="Filter by tag name"
                className="dusk-select w-full px-3 py-2"
              />
            </div>
            {filteredTags.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400 dark:text-white/36">No matching tags</p>
            ) : (
              <ul className="app-scrollbar max-h-[600px] divide-y divide-slate-100 overflow-y-auto dark:divide-white/[0.07]">
                {filteredTags.map(tag => (
                  <li key={tag.id}>
                    <button
                      onClick={() => setSelectedTag(tag)}
                      className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                        selectedTag?.id === tag.id
                          ? 'bg-fuchsia-50 text-fuchsia-700 font-medium dark:bg-fuchsia-500/10 dark:text-fuchsia-200'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-white/76 dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      <div>{tag.name}</div>
                      <div className="mt-1 text-xs uppercase tracking-wide text-slate-400 dark:text-white/36">{tag.format}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex-1 min-w-0">
          {!selectedTag ? (
            <Panel className="py-20 text-center">
              <SectionKicker>Awaiting selection</SectionKicker>
              <p className="mt-3 text-slate-500 dark:text-white/56">Select a tag to view statistics</p>
            </Panel>
          ) : (
            <>
              <div className="flex flex-col gap-4 mb-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <SectionKicker>Selected tag</SectionKicker>
                  <h2 className="mt-2 text-lg font-semibold text-slate-800 dark:text-white">{selectedTag.name}</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-white/56">Filter by assigned creative and exported size variant.</p>
                </div>
                <div className="dusk-toolbar-group">
                  {DATE_RANGES.map(range => (
                    <button
                      key={range.days}
                      onClick={() => setDateRange(range.days)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        dateRange === range.days
                          ? 'bg-[linear-gradient(135deg,#F1008B,#c026d3)] text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/[0.07] dark:bg-white/[0.025] dark:text-white/70 dark:hover:bg-white/[0.05]'
                      }`}
                    >
                        {range.label}
                      </button>
                    ))}
                  <PrimaryButton
                    onClick={() => void handleExport()}
                    disabled={exporting || loadingStats || !summary}
                    className="min-h-[36px] px-3 py-1.5 text-xs disabled:cursor-not-allowed"
                  >
                    {exporting ? 'Exporting…' : 'Download Excel'}
                  </PrimaryButton>
                </div>
              </div>

              <div className="mb-6 grid gap-3 md:grid-cols-3">
                <Panel className="p-4">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-white/42">
                    Assigned Creative
                  </label>
                  <select
                    value={selectedCreativeId}
                    onChange={event => setSelectedCreativeId(event.target.value)}
                    disabled={loadingBindings}
                    className="dusk-select w-full px-3 py-2 disabled:bg-slate-50 dark:disabled:bg-white/[0.03]"
                  >
                    <option value="">All creatives</option>
                    {creativeOptions.map(option => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </Panel>
                <Panel className="p-4">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-white/42">
                    Creative Size
                  </label>
                  <select
                    value={selectedVariantId}
                    onChange={event => setSelectedVariantId(event.target.value)}
                    disabled={loadingBindings}
                    className="dusk-select w-full px-3 py-2 disabled:bg-slate-50 dark:disabled:bg-white/[0.03]"
                  >
                    <option value="">All sizes</option>
                    {variantOptions.map(option => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </Panel>
                <Panel className="p-4">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-white/42">
                    Filter Summary
                  </label>
                  <div className="space-y-1 text-sm text-slate-600 dark:text-white/62">
                    <div>{loadingBindings ? 'Loading bindings…' : `${bindings.length} binding${bindings.length === 1 ? '' : 's'} available`}</div>
                    <div>{selectedCreativeId ? 'Creative filter active' : 'No creative filter'}</div>
                    <div>{selectedVariantId ? 'Size filter active' : 'No size filter'}</div>
                  </div>
                </Panel>
              </div>

              {statsError ? (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {statsError}
                </div>
              ) : null}

              {loadingStats ? (
                <div className="flex items-center justify-center h-48">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-fuchsia-500" />
                </div>
              ) : (
                <>
                <div className="dusk-toolbar-group mb-6">
                    {REPORTING_TABS.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          activeTab === tab.id
                            ? 'bg-[linear-gradient(135deg,#F1008B,#c026d3)] text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/[0.07] dark:bg-white/[0.025] dark:text-white/70 dark:hover:bg-white/[0.05]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {activeTab === 'display' ? (
                    <>
                      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8 gap-4 mb-6">
                        <KpiCard label="Total Impressions" value={summary ? fmtNum(summary.totalImpressions) : '—'} />
                        <KpiCard label="Total Clicks" value={summary ? fmtNum(summary.totalClicks) : '—'} />
                        <KpiCard label="CTR" value={summary ? `${summary.ctr.toFixed(2)}%` : '—'} />
                        <KpiCard label="Viewability" value={summary ? `${summary.viewabilityRate.toFixed(2)}%` : '—'} sub="MRC: 50% visible ≥1s" />
                        <KpiCard label="Engagement Rate" value={summary ? `${summary.engagementRate.toFixed(2)}%` : '—'} sub="Hover interactions / imps" />
                        <KpiCard label="In-View Time" value={summary ? fmtDurationFromMs(summary.totalInViewDurationMs) : '—'} />
                        <KpiCard label="Attention Time" value={summary ? fmtDurationFromMs(summary.totalAttentionDurationMs) : '—'} />
                        <KpiCard label="Country" value={summary?.latestContext?.country || 'Unknown'} sub={summary?.latestContext?.region || 'Region unknown'} />
                      </div>

                      <Panel className="p-5">
                        <h3 className="text-sm font-semibold text-slate-700 mb-4">
                          Daily Impressions — Last {dateRange} days
                        </h3>
                        {stats.length === 0 ? (
                          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
                            No data for this period
                          </div>
                        ) : (
                          <BarChart data={stats} />
                        )}
                      </Panel>
                    </>
                  ) : null}

                  {activeTab === 'video' ? (
                    <>
                      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
                        <KpiCard label="Last 7d Imps" value={summary ? fmtNum(summary.impressionsLast7d) : '—'} />
                        <KpiCard label="Video Starts" value={summary ? fmtNum(summary.videoStarts) : '—'} />
                        <KpiCard label="Start Rate" value={summary ? `${summary.videoStartRate.toFixed(2)}%` : '—'} />
                        <KpiCard label="Plays Completed" value={summary ? fmtNum(summary.videoCompletions) : '—'} />
                        <KpiCard label="Completion Rate" value={summary ? `${summary.videoCompletionRate.toFixed(2)}%` : '—'} />
                        <KpiCard label="Country" value={summary?.latestContext?.country || 'Unknown'} sub={summary?.latestContext?.region || 'Region unknown'} />
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-slate-700">Daily Video Breakdown</h3>
                          <p className="text-xs text-slate-400">Starts and completions for the active filters</p>
                        </div>
                        {stats.length === 0 ? (
                          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
                            No video data for this period
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100">
                              <thead className="bg-slate-50">
                                <tr>
                                  {['Date', 'Impressions', 'Play Starts', 'Plays Completed', 'Start Rate', 'Completion Rate'].map(header => (
                                    <th key={header} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                      {header}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {[...stats].reverse().map(row => {
                                  const startRate = row.impressions > 0 ? (row.videoStarts / row.impressions) * 100 : 0;
                                  const completionRate = row.videoStarts > 0 ? (row.videoCompletions / row.videoStarts) * 100 : 0;
                                  return (
                                    <tr key={row.date} className="hover:bg-slate-50">
                                      <td className="px-4 py-2.5 text-sm text-slate-600">{row.date}</td>
                                      <td className="px-4 py-2.5 text-sm font-medium text-slate-800">{row.impressions.toLocaleString()}</td>
                                      <td className="px-4 py-2.5 text-sm text-slate-700">{row.videoStarts.toLocaleString()}</td>
                                      <td className="px-4 py-2.5 text-sm text-slate-700">{row.videoCompletions.toLocaleString()}</td>
                                      <td className="px-4 py-2.5 text-sm text-slate-700">{startRate.toFixed(2)}%</td>
                                      <td className="px-4 py-2.5 text-sm text-slate-700">{completionRate.toFixed(2)}%</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  ) : null}

                  {activeTab === 'identity' ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                        <KpiCard label="Inventory Environment" value={inventoryEnvironment} sub={identitySource} />
                        <KpiCard label="Country" value={summary?.latestContext?.country || 'Unknown'} sub={summary?.latestContext?.region || 'Region unknown'} />
                        <KpiCard label="Device Type" value={summary?.latestContext?.deviceType ? titleCase(summary.latestContext.deviceType) : 'Unknown'} sub="Inferred from request" />
                        <KpiCard label="Device Model" value={summary?.latestContext?.deviceModel || 'Unknown'} sub="User-agent or DSP reported" />
                        <KpiCard label="Unique Devices" value={summary ? fmtNum(summary.uniqueIdentities) : '—'} sub="From tracker identity cookie" />
                        <KpiCard label="Avg Frequency" value={summary ? summary.avgFrequency.toFixed(2) : '—'} sub="Impressions per identity" />
                        <KpiCard label="Site / App Type" value={summary?.latestContext?.appId || summary?.latestContext?.appBundle || summary?.latestContext?.appName ? 'App' : summary?.latestContext?.siteDomain || summary?.latestContext?.pageUrl ? 'Web Site' : 'Unknown'} />
                      </div>

                      {summary?.latestContext ? (
                        <div className="bg-white rounded-xl border border-slate-200 p-5">
                          <h3 className="text-sm font-semibold text-slate-700 mb-4">Latest Delivery Identity & Context</h3>
                          <div className="grid gap-6 lg:grid-cols-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Identity</p>
                              <DetailRow label="Inventory Environment" value={inventoryEnvironment} />
                              <DetailRow label="Country" value={summary.latestContext.country || 'Unknown'} />
                              <DetailRow label="Region" value={summary.latestContext.region || 'Unknown'} />
                              <DetailRow label="City" value={summary.latestContext.city || 'Unknown'} />
                              <DetailRow label="Device Type" value={titleCase(summary.latestContext.deviceType || 'Unknown')} />
                              <DetailRow label="Device Model" value={summary.latestContext.deviceModel || 'Unknown'} />
                              <DetailRow label="Browser" value={summary.latestContext.browser || 'Unknown'} />
                              <DetailRow label="OS" value={summary.latestContext.os || 'Unknown'} />
                              <DetailRow label="Carrier" value={summary.latestContext.carrier || 'n/a'} />
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Site / App</p>
                              <DetailRow label="Site Domain" value={summary.latestContext.siteDomain || 'n/a'} />
                              <DetailRow label="Page URL" value={summary.latestContext.pageUrl || 'n/a'} />
                              <DetailRow label="App Name" value={summary.latestContext.appName || 'n/a'} />
                              <DetailRow label="App ID" value={summary.latestContext.appId || 'n/a'} />
                              <DetailRow label="App Bundle" value={summary.latestContext.appBundle || 'n/a'} />
                              <DetailRow label="Page Position" value={summary.latestContext.pagePosition || 'n/a'} />
                              <DetailRow label="App Store" value={summary.latestContext.appStoreName || 'n/a'} />
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Supply & Context</p>
                              <DetailRow label="Network ID" value={summary.latestContext.networkId || 'n/a'} />
                              <DetailRow label="Source Publisher ID" value={summary.latestContext.sourcePublisherId || 'n/a'} />
                              <DetailRow label="Exchange ID" value={summary.latestContext.exchangeId || 'n/a'} />
                              <DetailRow label="Exchange Publisher ID" value={summary.latestContext.exchangePublisherId || 'n/a'} />
                              <DetailRow label="Exchange Site/Domain" value={summary.latestContext.exchangeSiteIdOrDomain || 'n/a'} />
                              <DetailRow label="Site ID" value={summary.latestContext.siteId || 'n/a'} />
                              <DetailRow label="Contextual IDs" value={summary.latestContext.contextualIds || 'n/a'} />
                              <DetailRow label="Content Genre" value={summary.latestContext.contentGenre || 'n/a'} />
                              <DetailRow label="Content Title" value={summary.latestContext.contentTitle || 'n/a'} />
                              <DetailRow label="Content Series" value={summary.latestContext.contentSeries || 'n/a'} />
                              <DetailRow label="Content Language" value={summary.latestContext.contentLanguage || 'n/a'} />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-500">
                          No identity context has been captured yet for the current filters. This tab fills from new traffic and can use inferred request data even when DSP macros are absent.
                        </div>
                      )}
                    </div>
                  ) : null}

                  {activeTab === 'display' && stats.length > 0 ? (
                    <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-700">Daily Breakdown</h3>
                        <p className="text-xs text-slate-400">Export uses the same filtered rows</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                          <thead className="bg-slate-50">
                            <tr>
                              {['Date', 'Impressions', 'Clicks', 'Play Starts', 'Plays Completed', 'CTR', 'Start Rate', 'Completion Rate'].map(header => (
                                <th key={header} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {[...stats].reverse().map(row => {
                              const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
                              const startRate = row.impressions > 0 ? (row.videoStarts / row.impressions) * 100 : 0;
                              const completionRate = row.videoStarts > 0 ? (row.videoCompletions / row.videoStarts) * 100 : 0;
                              return (
                                <tr key={row.date} className="hover:bg-slate-50">
                                  <td className="px-4 py-2.5 text-sm text-slate-600">{row.date}</td>
                                  <td className="px-4 py-2.5 text-sm font-medium text-slate-800">{row.impressions.toLocaleString()}</td>
                                  <td className="px-4 py-2.5 text-sm text-slate-700">{row.clicks.toLocaleString()}</td>
                                  <td className="px-4 py-2.5 text-sm text-slate-700">{row.videoStarts.toLocaleString()}</td>
                                  <td className="px-4 py-2.5 text-sm text-slate-700">{row.videoCompletions.toLocaleString()}</td>
                                  <td className="px-4 py-2.5 text-sm text-slate-700">{ctr.toFixed(2)}%</td>
                                  <td className="px-4 py-2.5 text-sm text-slate-700">{startRate.toFixed(2)}%</td>
                                  <td className="px-4 py-2.5 text-sm text-slate-700">{completionRate.toFixed(2)}%</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
