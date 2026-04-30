import React, { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type PacingStatus = 'on_track' | 'behind' | 'ahead' | 'completed' | 'not_started' | 'no_goal';

interface PacingCampaign {
  id: string;
  name: string;
  advertiser: string;
  status: PacingStatus;
  pacingPct: number;       // % of time elapsed
  deliveryPct: number;     // % of goal delivered
  impressionsServed: number;
  impressionGoal: number | null;
  remainingDays: number;
  startDate: string;
  endDate: string;
}

interface PacingAlert {
  campaignId: string;
  campaignName: string;
  status: PacingStatus;
  message: string;
  severity: 'warning' | 'critical';
}

interface PacingData {
  campaigns: PacingCampaign[];
  summary: {
    total: number;
    active: number;
    onTrack: number;
    behind: number;
    totalServed: number;
  };
}

interface BreakdownDay {
  date: string;
  impressions: number;
  expected: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<PacingStatus, { label: string; cls: string; dot: string }> = {
  on_track:    { label: 'On Track',    cls: 'bg-green-100 text-green-800',   dot: 'bg-green-500' },
  behind:      { label: 'Behind',      cls: 'bg-red-100 text-red-800',       dot: 'bg-red-500' },
  ahead:       { label: 'Ahead',       cls: 'bg-blue-100 text-blue-800',     dot: 'bg-blue-500' },
  completed:   { label: 'Completed',   cls: 'bg-slate-100 text-slate-600',   dot: 'bg-slate-400' },
  not_started: { label: 'Not Started', cls: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  no_goal:     { label: 'No Goal',     cls: 'bg-slate-100 text-slate-500',   dot: 'bg-slate-300' },
};

const BREAKDOWN_RANGES = [7, 14, 30, 60];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

type SortKey = 'name' | 'advertiser' | 'pacingPct' | 'deliveryPct' | 'remainingDays';

function normalizePacingCampaign(raw: any): PacingCampaign {
  const pacing = raw?.pacing ?? {};
  return {
    id: String(raw?.id ?? ''),
    name: String(raw?.name ?? 'Untitled campaign'),
    advertiser: String(raw?.advertiser ?? raw?.advertiserName ?? '—'),
    status: (raw?.status ?? pacing?.status ?? 'no_goal') as PacingStatus,
    pacingPct: Number(raw?.pacingPct ?? pacing?.pacingPct ?? 0) || 0,
    deliveryPct: Number(raw?.deliveryPct ?? pacing?.deliveryPct ?? 0) || 0,
    impressionsServed: Number(raw?.impressionsServed ?? raw?.servedTotal ?? pacing?.servedTotal ?? 0) || 0,
    impressionGoal: raw?.impressionGoal ?? pacing?.impressionGoal ?? null,
    remainingDays: Number(raw?.remainingDays ?? pacing?.remainingDays ?? 0) || 0,
    startDate: String(raw?.startDate ?? ''),
    endDate: String(raw?.endDate ?? ''),
  };
}

function normalizePacingAlert(raw: any): PacingAlert {
  const campaign = normalizePacingCampaign(raw);
  const severity = campaign.status === 'behind' ? 'critical' : 'warning';
  const message = raw?.message
    ?? (campaign.status === 'behind'
      ? `Delivery is behind expected pacing at ${campaign.pacingPct.toFixed(1)}%.`
      : `Campaign has ${campaign.remainingDays} day(s) left and ${campaign.deliveryPct.toFixed(1)}% delivered.`);
  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    status: campaign.status,
    message,
    severity,
  };
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PacingStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.no_goal;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function DeliveryBar({ deliveryPct, expectedPct }: { deliveryPct: number; expectedPct: number }) {
  const del = Math.min(deliveryPct, 100);
  const exp = Math.min(expectedPct, 100);
  const isAhead = del >= exp;

  return (
    <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-visible">
      {/* Delivery fill */}
      <div
        className={`absolute top-0 left-0 h-3 rounded-full transition-all ${isAhead ? 'bg-blue-500' : 'bg-indigo-500'}`}
        style={{ width: `${del}%` }}
      />
      {/* Expected marker */}
      <div
        className="absolute top-[-3px] h-[18px] w-0.5 bg-slate-600 rounded-full"
        style={{ left: `${exp}%` }}
        title={`Expected: ${exp.toFixed(1)}%`}
      />
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, colorClass = 'text-slate-800' }: {
  label: string; value: string | number; sub?: string; colorClass?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-sm text-slate-500 font-medium">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${colorClass}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Sparkline Modal ──────────────────────────────────────────────────────────

function SparklineModal({ campaign, onClose }: { campaign: PacingCampaign; onClose: () => void }) {
  const [days, setDays] = useState(14);
  const [breakdown, setBreakdown] = useState<BreakdownDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`/v1/pacing/${campaign.id}/breakdown?days=${days}`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Failed to load breakdown'); return r.json(); })
      .then(d => setBreakdown(d?.breakdown ?? d ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [campaign.id, days]);

  const maxVal = Math.max(...breakdown.map(d => Math.max(d.impressions, d.expected)), 1);
  const W = 560, H = 120, PAD = { l: 44, r: 10, t: 10, b: 28 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const barW = breakdown.length > 0 ? Math.max(2, (chartW / breakdown.length) - 2) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{campaign.name}</h2>
            <p className="text-sm text-slate-500">{campaign.advertiser} · Daily breakdown</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-4">
          {/* Day selector */}
          <div className="flex gap-1 mb-5">
            {BREAKDOWN_RANGES.map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  days === d
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
          ) : breakdown.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">No data for this period</div>
          ) : (
            <>
              {/* Chart */}
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full mb-1" style={{ height: H }}>
                {/* Axes */}
                <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + chartH} stroke="#e2e8f0" strokeWidth="1"/>
                <line x1={PAD.l} y1={PAD.t + chartH} x2={PAD.l + chartW} y2={PAD.t + chartH} stroke="#e2e8f0" strokeWidth="1"/>

                {/* Y labels */}
                {[0, 0.5, 1].map(frac => {
                  const y = PAD.t + chartH - frac * chartH;
                  const v = Math.round(maxVal * frac);
                  return (
                    <g key={frac}>
                      <line x1={PAD.l} y1={y} x2={PAD.l + chartW} y2={y} stroke="#f1f5f9" strokeWidth="1"/>
                      <text x={PAD.l - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
                        {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                      </text>
                    </g>
                  );
                })}

                {breakdown.map((d, i) => {
                  const slotW = chartW / breakdown.length;
                  const x = PAD.l + i * slotW;
                  const bH = (d.impressions / maxVal) * chartH;
                  const eH = (d.expected / maxVal) * chartH;
                  return (
                    <g key={d.date}>
                      {/* Expected bar (lighter) */}
                      <rect
                        x={x + slotW * 0.5}
                        y={PAD.t + chartH - eH}
                        width={barW * 0.45}
                        height={eH}
                        fill="#e0e7ff"
                        rx="1"
                      />
                      {/* Actual bar */}
                      <rect
                        x={x + 1}
                        y={PAD.t + chartH - bH}
                        width={barW * 0.45}
                        height={bH}
                        fill="#6366f1"
                        rx="1"
                      >
                        <title>{d.date}: {d.impressions.toLocaleString()} served / {d.expected.toLocaleString()} expected</title>
                      </rect>
                      {i % Math.ceil(breakdown.length / 7) === 0 && (
                        <text x={x + slotW / 2} y={H - 4} textAnchor="middle" fontSize="8" fill="#94a3b8">
                          {new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Legend */}
              <div className="flex gap-4 text-xs text-slate-500 mb-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block"/>Actual
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-indigo-200 inline-block"/>Expected
                </span>
              </div>
            </>
          )}

          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
            <div className="text-center">
              <p className="text-xs text-slate-500">Delivery</p>
              <p className="text-lg font-bold text-indigo-700">{campaign.deliveryPct.toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Served</p>
              <p className="text-lg font-bold text-slate-800">{fmtNum(campaign.impressionsServed)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Days Left</p>
              <p className="text-lg font-bold text-slate-800">{campaign.remainingDays}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PacingDashboard() {
  const [data, setData] = useState<PacingData | null>(null);
  const [alerts, setAlerts] = useState<PacingAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<PacingCampaign | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      fetch('/v1/pacing', { credentials: 'include' }).then(r => { if (!r.ok) throw new Error('Failed to load pacing data'); return r.json(); }),
      fetch('/v1/pacing/alerts', { credentials: 'include' }).then(r => r.json()).catch(() => []),
    ])
      .then(([pacingData, alertData]) => {
        const campaigns = (pacingData?.campaigns ?? []).map(normalizePacingCampaign);
        const summary = {
          total: campaigns.length,
          active: campaigns.filter((campaign: any) => ['on_track', 'behind', 'ahead'].includes(campaign.status)).length,
          onTrack: campaigns.filter((campaign: any) => campaign.status === 'on_track').length,
          behind: campaigns.filter((campaign: any) => campaign.status === 'behind').length,
          totalServed: campaigns.reduce((sum: number, campaign: any) => sum + Number(campaign.impressionsServed ?? 0), 0),
        };
        setData({ campaigns, summary });
        setAlerts((alertData?.alerts ?? alertData ?? []).map(normalizePacingAlert));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sorted = [...(data?.campaigns ?? [])].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortKey === 'advertiser') cmp = a.advertiser.localeCompare(b.advertiser);
    else if (sortKey === 'pacingPct') cmp = a.pacingPct - b.pacingPct;
    else if (sortKey === 'deliveryPct') cmp = a.deliveryPct - b.deliveryPct;
    else if (sortKey === 'remainingDays') cmp = a.remainingDays - b.remainingDays;
    return sortAsc ? cmp : -cmp;
  });

  const SortHeader = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
      onClick={() => handleSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}
        {sortKey === col ? (sortAsc ? ' ↑' : ' ↓') : <span className="text-slate-300"> ↕</span>}
      </span>
    </th>
  );

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
        <p className="font-medium">Error loading pacing data</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={load} className="mt-3 text-sm text-red-600 underline">Retry</button>
      </div>
    );
  }

  const s = data?.summary;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pacing Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Campaign delivery vs. expected pacing</p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <KpiCard label="Total Campaigns" value={s?.total ?? 0} />
        <KpiCard label="Active" value={s?.active ?? 0} colorClass="text-indigo-700" />
        <KpiCard label="On Track" value={s?.onTrack ?? 0} colorClass="text-green-700" />
        <KpiCard label="Behind" value={s?.behind ?? 0} colorClass="text-red-700" />
        <KpiCard label="Total Served" value={s ? fmtNum(s.totalServed) : '—'} colorClass="text-slate-700" />
      </div>

      {/* Alerts panel */}
      {alerts.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">⚠️ Alerts ({alerts.length})</h2>
          <div className="space-y-2">
            {alerts.map(a => (
              <div
                key={a.campaignId}
                className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-sm ${
                  a.severity === 'critical'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                }`}
              >
                <span>{a.severity === 'critical' ? '🔴' : '🟡'}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold">{a.campaignName}</span>
                  <span className="mx-2">·</span>
                  <span>{a.message}</span>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campaign table */}
      {sorted.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <p className="text-4xl mb-3">⏱️</p>
          <h3 className="text-lg font-medium text-slate-700">No campaigns with pacing data</h3>
          <p className="text-sm text-slate-500 mt-1">Campaigns with impression goals will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <SortHeader col="name" label="Campaign" />
                  <SortHeader col="advertiser" label="Advertiser" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-48">
                    Delivery
                  </th>
                  <SortHeader col="deliveryPct" label="Delivery %" />
                  <SortHeader col="pacingPct" label="Time %" />
                  <SortHeader col="remainingDays" label="Days Left" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Served</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map(c => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedCampaign(c)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 max-w-[180px] truncate">{c.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{c.advertiser}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 w-48">
                      <DeliveryBar deliveryPct={c.deliveryPct} expectedPct={c.pacingPct} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 font-medium">{c.deliveryPct.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{c.pacingPct.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{c.remainingDays}d</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{fmtNum(c.impressionsServed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedCampaign && (
        <SparklineModal
          campaign={selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
        />
      )}
    </div>
  );
}
