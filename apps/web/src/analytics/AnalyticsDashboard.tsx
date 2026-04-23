import React, { useEffect, useState } from 'react';

interface WorkspaceAnalytics {
  totalImpressions: number;
  totalClicks: number;
  avgCtr: number;
  activeCampaigns: number;
  topCampaigns?: Array<{
    id: string;
    name: string;
    impressions: number;
    clicks: number;
    ctr: number;
  }>;
  topTags?: Array<{
    id: string;
    name: string;
    impressions: number;
    clicks: number;
  }>;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

interface KpiCardProps {
  label: string;
  value: string;
  icon: string;
  color: string;
  sub?: string;
}

const KpiCard = ({ label, value, icon, color, sub }: KpiCardProps) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <div className="flex items-center justify-between mb-3">
      <p className="text-sm text-slate-500 font-medium">{label}</p>
      <span className={`text-2xl`}>{icon}</span>
    </div>
    <p className={`text-3xl font-bold ${color}`}>{value}</p>
    {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
  </div>
);

export default function AnalyticsDashboard() {
  const [data, setData] = useState<WorkspaceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    fetch('/v1/reporting/workspace', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Failed to load analytics'); return r.json(); })
      .then(d => setData(d?.stats ?? d ?? null))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Workspace-level performance overview</p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Total Impressions"
          value={data ? fmtNum(data.totalImpressions) : '—'}
          icon="👁️"
          color="text-slate-800"
        />
        <KpiCard
          label="Total Clicks"
          value={data ? fmtNum(data.totalClicks) : '—'}
          icon="🖱️"
          color="text-blue-700"
        />
        <KpiCard
          label="Avg CTR"
          value={data ? `${data.avgCtr.toFixed(2)}%` : '—'}
          icon="📈"
          color="text-indigo-700"
        />
        <KpiCard
          label="Active Campaigns"
          value={data ? String(data.activeCampaigns) : '—'}
          icon="📋"
          color="text-green-700"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Campaigns */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">Top Campaigns</h2>
          </div>
          {!data?.topCampaigns?.length ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">No campaign data available</div>
          ) : (
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Campaign', 'Impressions', 'Clicks', 'CTR'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.topCampaigns.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 max-w-[150px] truncate">{c.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{fmtNum(c.impressions)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{fmtNum(c.clicks)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{c.ctr.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Top Tags */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">Top Tags</h2>
          </div>
          {!data?.topTags?.length ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">No tag data available</div>
          ) : (
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Tag', 'Impressions', 'Clicks'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.topTags.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 max-w-[180px] truncate">{t.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{fmtNum(t.impressions)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{fmtNum(t.clicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
