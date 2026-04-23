import React, { useEffect, useState } from 'react';

interface RankedMetric {
  label: string;
  value: number;
  secondary?: string;
}

interface WorkspaceAnalytics {
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  totalViewableImpressions: number;
  viewabilityRate: number;
  avgCtr: number;
  totalEngagements: number;
  totalHoverDurationMs: number;
  activeCampaigns: number;
  activeTags: number;
  totalCreatives: number;
  topCampaigns: Array<{
    id: string;
    name: string;
    status: string;
    impressions: number;
    clicks: number;
    ctr: number;
  }>;
  topTags: Array<{
    id: string;
    name: string;
    format: string;
    impressions: number;
    clicks: number;
    ctr: number;
  }>;
  topSites: RankedMetric[];
  topCountries: RankedMetric[];
  engagements: RankedMetric[];
}

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

function normalizeRankedMetricList(items: any[], labelKey: string, secondary?: (item: any) => string | undefined): RankedMetric[] {
  return (Array.isArray(items) ? items : []).map((item) => ({
    label: String(item?.[labelKey] ?? 'Unknown'),
    value: toNumber(item?.impressions ?? item?.event_count ?? item?.clicks),
    secondary: secondary ? secondary(item) : undefined,
  }));
}

function normalizeWorkspaceAnalytics(payload: any, sitePayload: any, countryPayload: any, engagementPayload: any): WorkspaceAnalytics {
  const source = payload?.stats ?? payload ?? {};
  const topCampaigns = Array.isArray(source?.topCampaigns ?? source?.top_campaigns)
    ? (source.topCampaigns ?? source.top_campaigns)
    : [];
  const topTags = Array.isArray(source?.topTags ?? source?.top_tags)
    ? (source.topTags ?? source.top_tags)
    : [];
  const topSites = normalizeRankedMetricList(sitePayload?.breakdown ?? [], 'site_domain', (item) => fmtCtr(toNumber(item?.ctr)));
  const topCountries = normalizeRankedMetricList(countryPayload?.breakdown ?? [], 'country', (item) => fmtCtr(toNumber(item?.ctr)));
  const engagements = normalizeRankedMetricList(engagementPayload?.breakdown ?? [], 'event_type', (item) => {
    const duration = toNumber(item?.total_duration_ms);
    return duration > 0 ? `${fmtNum(duration)} ms` : undefined;
  });

  return {
    totalImpressions: toNumber(source?.totalImpressions ?? source?.total_impressions),
    totalClicks: toNumber(source?.totalClicks ?? source?.total_clicks),
    totalSpend: toNumber(source?.totalSpend ?? source?.total_spend),
    totalViewableImpressions: toNumber(source?.totalViewableImpressions ?? source?.total_viewable_impressions),
    viewabilityRate: toNumber(source?.viewabilityRate ?? source?.viewability_rate),
    avgCtr: toNumber(source?.avgCtr ?? source?.avg_ctr),
    totalEngagements: toNumber(source?.totalEngagements ?? source?.total_engagements),
    totalHoverDurationMs: toNumber(source?.totalHoverDurationMs ?? source?.total_hover_duration_ms),
    activeCampaigns: toNumber(source?.activeCampaigns ?? source?.active_campaigns),
    activeTags: toNumber(source?.activeTags ?? source?.active_tags),
    totalCreatives: toNumber(source?.totalCreatives ?? source?.total_creatives),
    topCampaigns: topCampaigns.map((campaign: any) => ({
      id: String(campaign?.id ?? ''),
      name: String(campaign?.name ?? 'Untitled campaign'),
      status: String(campaign?.status ?? 'unknown'),
      impressions: toNumber(campaign?.impressions),
      clicks: toNumber(campaign?.clicks),
      ctr: toNumber(campaign?.ctr),
    })),
    topTags: topTags.map((tag: any) => ({
      id: String(tag?.id ?? ''),
      name: String(tag?.name ?? 'Untitled tag'),
      format: String(tag?.format ?? 'unknown'),
      impressions: toNumber(tag?.impressions),
      clicks: toNumber(tag?.clicks),
      ctr: toNumber(tag?.ctr),
    })),
    topSites,
    topCountries,
    engagements,
  };
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

export default function AnalyticsDashboard() {
  const [data, setData] = useState<WorkspaceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      fetch('/v1/reporting/workspace', { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load analytics');
        return r.json();
      }),
      fetch('/v1/reporting/workspace/site-breakdown', { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load site breakdown');
        return r.json();
      }),
      fetch('/v1/reporting/workspace/country-breakdown', { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load country breakdown');
        return r.json();
      }),
      fetch('/v1/reporting/workspace/engagement-breakdown', { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load engagement breakdown');
        return r.json();
      }),
    ])
      .then(([workspace, sites, countries, engagements]) => {
        setData(normalizeWorkspaceAnalytics(workspace, sites, countries, engagements));
      })
      .catch((loadError: any) => setError(loadError.message ?? 'Failed to load analytics'))
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
          <p className="text-sm text-slate-500 mt-1">Workspace-level performance overview with site, country, and engagement signals.</p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        <KpiCard label="Impressions" value={fmtNum(data?.totalImpressions ?? 0)} icon="👁️" color="text-slate-800" />
        <KpiCard label="Clicks" value={fmtNum(data?.totalClicks ?? 0)} icon="🖱️" color="text-blue-700" />
        <KpiCard label="Spend" value={fmtCurrency(data?.totalSpend ?? 0)} icon="💸" color="text-emerald-700" />
        <KpiCard label="CTR" value={fmtCtr(data?.avgCtr ?? 0)} icon="📈" color="text-indigo-700" />
        <KpiCard label="Viewability" value={fmtCtr(data?.viewabilityRate ?? 0)} icon="🎯" color="text-fuchsia-700" sub={`${fmtNum(data?.totalViewableImpressions ?? 0)} viewable imps`} />
        <KpiCard label="Engagements" value={fmtNum(data?.totalEngagements ?? 0)} icon="✨" color="text-amber-700" sub={`${fmtNum(data?.totalHoverDurationMs ?? 0)} ms hover time`} />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Active Campaigns" value={String(data?.activeCampaigns ?? 0)} icon="📋" color="text-slate-800" />
        <KpiCard label="Active Tags" value={String(data?.activeTags ?? 0)} icon="🏷️" color="text-slate-800" />
        <KpiCard label="Creatives" value={String(data?.totalCreatives ?? 0)} icon="🧩" color="text-slate-800" />
        <KpiCard label="Avg Hover Time" value={`${Math.round(((data?.totalHoverDurationMs ?? 0) / Math.max(data?.totalEngagements ?? 1, 1))).toLocaleString()} ms`} icon="🖐️" color="text-slate-800" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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
                  {['Campaign', 'Status', 'Impressions', 'CTR'].map((heading) => (
                    <th key={heading} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.topCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 max-w-[180px] truncate">{campaign.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 capitalize">{campaign.status}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{fmtNum(campaign.impressions)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{fmtCtr(campaign.ctr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

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
                  {['Tag', 'Format', 'Impressions', 'CTR'].map((heading) => (
                    <th key={heading} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.topTags.map((tag) => (
                  <tr key={tag.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 max-w-[180px] truncate">{tag.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{tag.format}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{fmtNum(tag.impressions)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{fmtCtr(tag.ctr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <RankedList title="Top Sites" emptyLabel="No site data available" items={data?.topSites ?? []} />
        <RankedList title="Top Countries" emptyLabel="No country data available" items={data?.topCountries ?? []} />
        <RankedList title="Engagement Mix" emptyLabel="No engagement data available" items={data?.engagements ?? []} />
      </div>
    </div>
  );
}
