import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

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
  impressionsLast7d: number;
  videoStarts: number;
  videoCompletions: number;
  videoCompletionRate: number;
}

interface DailyStat {
  date: string;
  impressions: number;
  clicks: number;
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
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</p>
    <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
    {sub ? <p className="text-xs text-slate-400 mt-0.5">{sub}</p> : null}
  </div>
);

const DATE_RANGES = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
];

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTagSummary(source: any): TagSummary | null {
  if (!source || typeof source !== 'object') return null;
  return {
    totalImpressions: toNumber(source.totalImpressions ?? source.total_impressions),
    totalClicks: toNumber(source.totalClicks ?? source.total_clicks),
    ctr: toNumber(source.ctr ?? source.overall_ctr),
    impressionsLast7d: toNumber(source.impressionsLast7d ?? source.impressions_7d),
    videoStarts: toNumber(source.videoStarts ?? source.video_starts),
    videoCompletions: toNumber(source.videoCompletions ?? source.video_completions),
    videoCompletionRate: toNumber(source.videoCompletionRate ?? source.video_completion_rate),
  };
}

function normalizeDailyStats(source: any): DailyStat[] {
  if (!Array.isArray(source)) return [];
  return source.map(item => ({
    date: String(item?.date ?? ''),
    impressions: toNumber(item?.impressions),
    clicks: toNumber(item?.clicks),
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

  useEffect(() => {
    fetch('/v1/tags', { credentials: 'include' })
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
        { Metric: 'Last 7d Impressions', Value: summary.impressionsLast7d },
        { Metric: 'Play Starts', Value: summary.videoStarts },
        { Metric: 'Plays Completed', Value: summary.videoCompletions },
        { Metric: 'Completion Rate (%)', Value: Number(summary.videoCompletionRate.toFixed(2)) },
      ];
      const breakdownRows = [...stats]
        .reverse()
        .map(row => ({
          Date: row.date,
          Impressions: row.impressions,
          Clicks: row.clicks,
          'CTR (%)': row.impressions > 0 ? Number((((row.clicks / row.impressions) * 100)).toFixed(2)) : 0,
        }));

      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(filterSummary), 'Filters');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
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
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-medium">Error loading tags</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Tag Reporting</h1>
        <p className="text-sm text-slate-500 mt-1">Tag-level impression, click, and video analytics</p>
      </div>

      <div className="flex gap-6">
        <div className="w-72 flex-shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tags</p>
              <input
                type="search"
                value={tagSearch}
                onChange={event => setTagSearch(event.target.value)}
                placeholder="Filter by tag name"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            {filteredTags.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">No matching tags</p>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {filteredTags.map(tag => (
                  <li key={tag.id}>
                    <button
                      onClick={() => setSelectedTag(tag)}
                      className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                        selectedTag?.id === tag.id
                          ? 'bg-indigo-50 text-indigo-700 font-medium'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div>{tag.name}</div>
                      <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">{tag.format}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {!selectedTag ? (
            <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
              <p className="text-slate-500">Select a tag to view statistics</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 mb-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">{selectedTag.name}</h2>
                  <p className="text-sm text-slate-500 mt-1">Filter by assigned creative and exported size variant.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {DATE_RANGES.map(range => (
                    <button
                      key={range.days}
                      onClick={() => setDateRange(range.days)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        dateRange === range.days
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                  <button
                    onClick={() => void handleExport()}
                    disabled={exporting || loadingStats || !summary}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  >
                    {exporting ? 'Exporting…' : 'Download Excel'}
                  </button>
                </div>
              </div>

              <div className="mb-6 grid gap-3 md:grid-cols-3">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Assigned Creative
                  </label>
                  <select
                    value={selectedCreativeId}
                    onChange={event => setSelectedCreativeId(event.target.value)}
                    disabled={loadingBindings}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                  >
                    <option value="">All creatives</option>
                    {creativeOptions.map(option => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Creative Size
                  </label>
                  <select
                    value={selectedVariantId}
                    onChange={event => setSelectedVariantId(event.target.value)}
                    disabled={loadingBindings}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                  >
                    <option value="">All sizes</option>
                    {variantOptions.map(option => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Filter Summary
                  </label>
                  <div className="text-sm text-slate-600 space-y-1">
                    <div>{loadingBindings ? 'Loading bindings…' : `${bindings.length} binding${bindings.length === 1 ? '' : 's'} available`}</div>
                    <div>{selectedCreativeId ? 'Creative filter active' : 'No creative filter'}</div>
                    <div>{selectedVariantId ? 'Size filter active' : 'No size filter'}</div>
                  </div>
                </div>
              </div>

              {statsError ? (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {statsError}
                </div>
              ) : null}

              {loadingStats ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
                    <KpiCard label="Total Impressions" value={summary ? fmtNum(summary.totalImpressions) : '—'} />
                    <KpiCard label="Total Clicks" value={summary ? fmtNum(summary.totalClicks) : '—'} />
                    <KpiCard label="CTR" value={summary ? `${summary.ctr.toFixed(2)}%` : '—'} />
                    <KpiCard label="Last 7d Imps" value={summary ? fmtNum(summary.impressionsLast7d) : '—'} />
                    <KpiCard label="Play Starts" value={summary ? fmtNum(summary.videoStarts) : '—'} />
                    <KpiCard label="Plays Completed" value={summary ? fmtNum(summary.videoCompletions) : '—'} />
                    <KpiCard label="Completion Rate" value={summary ? `${summary.videoCompletionRate.toFixed(2)}%` : '—'} />
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5">
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
                  </div>

                  {stats.length > 0 ? (
                    <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-700">Daily Breakdown</h3>
                        <p className="text-xs text-slate-400">Export uses the same filtered rows</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                          <thead className="bg-slate-50">
                            <tr>
                              {['Date', 'Impressions', 'Clicks', 'CTR'].map(header => (
                                <th key={header} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {[...stats].reverse().map(row => {
                              const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
                              return (
                                <tr key={row.date} className="hover:bg-slate-50">
                                  <td className="px-4 py-2.5 text-sm text-slate-600">{row.date}</td>
                                  <td className="px-4 py-2.5 text-sm font-medium text-slate-800">{row.impressions.toLocaleString()}</td>
                                  <td className="px-4 py-2.5 text-sm text-slate-700">{row.clicks.toLocaleString()}</td>
                                  <td className="px-4 py-2.5 text-sm text-slate-700">{ctr.toFixed(2)}%</td>
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
