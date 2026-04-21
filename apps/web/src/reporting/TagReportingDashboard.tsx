import React, { useEffect, useState, useCallback } from 'react';

interface Tag {
  id: string;
  name: string;
  format: string;
}

interface TagSummary {
  totalImpressions: number;
  totalClicks: number;
  ctr: number;
  impressionsLast7d: number;
}

interface DailyStat {
  date: string;
  impressions: number;
  clicks: number;
}

function BarChart({ data }: { data: DailyStat[] }) {
  const W = 600, H = 120;
  const PAD = { l: 40, r: 10, t: 10, b: 30 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const max = Math.max(...data.map(d => d.impressions), 1);
  const barW = data.length > 0 ? Math.max(2, (chartW / data.length) - 2) : 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* Y axis */}
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + chartH} stroke="#e2e8f0" strokeWidth="1"/>
      {/* X axis */}
      <line x1={PAD.l} y1={PAD.t + chartH} x2={PAD.l + chartW} y2={PAD.t + chartH} stroke="#e2e8f0" strokeWidth="1"/>

      {/* Y grid lines + labels */}
      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const y = PAD.t + chartH - frac * chartH;
        const val = Math.round(max * frac);
        return (
          <g key={frac}>
            <line x1={PAD.l} y1={y} x2={PAD.l + chartW} y2={y} stroke="#f1f5f9" strokeWidth="1"/>
            <text x={PAD.l - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
              {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const barH = max > 0 ? (d.impressions / max) * chartH : 0;
        const x = PAD.l + i * (chartW / data.length) + 1;
        const y = PAD.t + chartH - barH;
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barW} height={barH} fill="#6366f1" rx="2">
              <title>{d.date}: {d.impressions.toLocaleString()} impressions</title>
            </rect>
            {i % Math.ceil(data.length / 7) === 0 && (
              <text x={x + barW / 2} y={H - 4} textAnchor="middle" fontSize="8" fill="#94a3b8">
                {new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
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
    {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
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

export default function TagReportingDashboard() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [summary, setSummary] = useState<TagSummary | null>(null);
  const [stats, setStats] = useState<DailyStat[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState('');
  const [statsError, setStatsError] = useState('');
  const [dateRange, setDateRange] = useState(7);

  useEffect(() => {
    fetch('/v1/tags', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Failed to load tags'); return r.json(); })
      .then(d => {
        const list: Tag[] = d?.tags ?? d ?? [];
        setTags(list);
        if (list.length > 0) setSelectedTag(list[0]);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoadingTags(false));
  }, []);

  const loadTagData = useCallback((tag: Tag, days: number) => {
    setLoadingStats(true);
    setStatsError('');

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    const from = dateFrom.toISOString().slice(0, 10);

    Promise.all([
      fetch(`/v1/tags/${tag.id}/summary`, { credentials: 'include' }).then(r => r.json()),
      fetch(`/v1/tags/${tag.id}/stats?dateFrom=${from}`, { credentials: 'include' }).then(r => r.json()),
    ])
      .then(([sumData, statData]) => {
        setSummary(sumData);
        setStats(statData?.stats ?? statData ?? []);
      })
      .catch(() => setStatsError('Failed to load tag statistics.'))
      .finally(() => setLoadingStats(false));
  }, []);

  useEffect(() => {
    if (selectedTag) loadTagData(selectedTag, dateRange);
  }, [selectedTag, dateRange, loadTagData]);

  if (loadingTags) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
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
        <p className="text-sm text-slate-500 mt-1">Tag-level impression and click analytics</p>
      </div>

      <div className="flex gap-6">
        {/* Tag list */}
        <div className="w-56 flex-shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tags</p>
            </div>
            {tags.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">No tags found</p>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {tags.map(t => (
                  <li key={t.id}>
                    <button
                      onClick={() => setSelectedTag(t)}
                      className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                        selectedTag?.id === t.id
                          ? 'bg-indigo-50 text-indigo-700 font-medium'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {t.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Stats panel */}
        <div className="flex-1 min-w-0">
          {!selectedTag ? (
            <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
              <p className="text-slate-500">Select a tag to view statistics</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800">{selectedTag.name}</h2>
                <div className="flex gap-1">
                  {DATE_RANGES.map(r => (
                    <button
                      key={r.days}
                      onClick={() => setDateRange(r.days)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        dateRange === r.days
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {statsError && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {statsError}
                </div>
              )}

              {loadingStats ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                </div>
              ) : (
                <>
                  {/* KPI cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <KpiCard
                      label="Total Impressions"
                      value={summary ? fmtNum(summary.totalImpressions) : '—'}
                    />
                    <KpiCard
                      label="Total Clicks"
                      value={summary ? fmtNum(summary.totalClicks) : '—'}
                    />
                    <KpiCard
                      label="CTR"
                      value={summary ? `${summary.ctr.toFixed(2)}%` : '—'}
                    />
                    <KpiCard
                      label="Last 7d Imps"
                      value={summary ? fmtNum(summary.impressionsLast7d) : '—'}
                    />
                  </div>

                  {/* Chart */}
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

                  {/* Daily table */}
                  {stats.length > 0 && (
                    <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100">
                        <h3 className="text-sm font-semibold text-slate-700">Daily Breakdown</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                          <thead className="bg-slate-50">
                            <tr>
                              {['Date', 'Impressions', 'Clicks', 'CTR'].map(h => (
                                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                  {h}
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
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
