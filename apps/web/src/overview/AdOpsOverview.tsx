import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadWorkspaces, type WorkspaceOption } from '../shared/workspaces';

interface CampaignRecord {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'archived' | 'draft';
  metadata?: { dsp?: string | null };
}

interface TagRecord {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'archived' | 'draft';
  format: 'VAST' | 'display' | 'native';
}

interface CreativeRecord {
  id: string;
  name: string;
  approvalStatus?: string;
}

interface AdOpsSnapshot {
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  totalViewableImpressions: number;
  totalMeasuredImpressions: number;
  totalUndeterminedImpressions: number;
  viewabilityRate: number;
  avgCtr: number;
  engagements: number;
  activeCampaigns: number;
  activeTags: number;
  creatives: number;
  recentCampaigns: CampaignRecord[];
  topTags: TagRecord[];
  clients: WorkspaceOption[];
}

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getReportingStats(payload: any) {
  const stats = payload?.stats ?? payload ?? {};
  return {
    totalImpressions: toNumber(stats?.totalImpressions ?? stats?.total_impressions),
    totalClicks: toNumber(stats?.totalClicks ?? stats?.total_clicks),
    totalSpend: toNumber(stats?.totalSpend ?? stats?.total_spend),
    totalViewableImpressions: toNumber(stats?.totalViewableImpressions ?? stats?.total_viewable_impressions),
    totalMeasuredImpressions: toNumber(stats?.totalMeasuredImpressions ?? stats?.total_measured_impressions),
    totalUndeterminedImpressions: toNumber(stats?.totalUndeterminedImpressions ?? stats?.total_undetermined_impressions),
    viewabilityRate: toNumber(stats?.viewabilityRate ?? stats?.viewability_rate),
    avgCtr: toNumber(stats?.avgCtr ?? stats?.avg_ctr),
    totalEngagements: toNumber(stats?.totalEngagements ?? stats?.total_engagements),
    activeCampaigns: toNumber(stats?.activeCampaigns ?? stats?.active_campaigns),
    activeTags: toNumber(stats?.activeTags ?? stats?.active_tags),
    totalCreatives: toNumber(stats?.totalCreatives ?? stats?.total_creatives),
  };
}

function fmtCompact(value: number, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(undefined, {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1000 ? 1 : 0,
    ...opts,
  }).format(value);
}

function fmtCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function KpiCard({ label, value, tone, helper }: { label: string; value: string; tone: string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-3 text-3xl font-semibold ${tone}`}>{value}</p>
      {helper ? <p className="mt-2 text-xs text-slate-400">{helper}</p> : null}
    </div>
  );
}

export default function AdOpsOverview() {
  const [snapshot, setSnapshot] = useState<AdOpsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [workspaces, reportingRes, campaignsRes, tagsRes, creativesRes] = await Promise.all([
        loadWorkspaces(),
        fetch('/v1/reporting/workspace', { credentials: 'include' }).then(r => {
          if (!r.ok) throw new Error('Failed to load reporting overview');
          return r.json();
        }),
        fetch('/v1/campaigns', { credentials: 'include' }).then(r => {
          if (!r.ok) throw new Error('Failed to load campaigns');
          return r.json();
        }),
        fetch('/v1/tags', { credentials: 'include' }).then(r => {
          if (!r.ok) throw new Error('Failed to load tags');
          return r.json();
        }),
        fetch('/v1/creatives', { credentials: 'include' }).then(r => {
          if (!r.ok) throw new Error('Failed to load creatives');
          return r.json();
        }),
      ]);

      const campaigns: CampaignRecord[] = campaignsRes?.campaigns ?? campaignsRes ?? [];
      const tags: TagRecord[] = tagsRes?.tags ?? tagsRes ?? [];
      const creatives: CreativeRecord[] = creativesRes?.creatives ?? creativesRes ?? [];
      const reportingStats = getReportingStats(reportingRes);

      setSnapshot({
        totalImpressions: reportingStats.totalImpressions,
        totalClicks: reportingStats.totalClicks,
        totalSpend: reportingStats.totalSpend,
        totalViewableImpressions: reportingStats.totalViewableImpressions,
        totalMeasuredImpressions: reportingStats.totalMeasuredImpressions,
        totalUndeterminedImpressions: reportingStats.totalUndeterminedImpressions,
        viewabilityRate: reportingStats.viewabilityRate,
        avgCtr: reportingStats.avgCtr,
        engagements: reportingStats.totalEngagements,
        activeCampaigns: reportingStats.activeCampaigns || campaigns.filter(c => c.status === 'active').length,
        activeTags: reportingStats.activeTags || tags.filter(t => t.status === 'active').length,
        creatives: reportingStats.totalCreatives || creatives.length,
        recentCampaigns: campaigns.slice(0, 5),
        topTags: tags.slice(0, 5),
        clients: workspaces,
      });
    } catch (loadError: any) {
      setError(loadError.message ?? 'Failed to load Ad Ops overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-medium">Error loading overview</p>
        <p className="mt-1 text-sm">{error}</p>
        <button onClick={() => void load()} className="mt-3 text-sm text-red-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#312e81_100%)] p-8 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-200">Ad Ops Overview</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">Start from the control room, not a client subpage.</h1>
            <p className="mt-4 text-sm leading-6 text-slate-200">
              Use this as the first stop for active campaigns, delivery signals, spend, CTR, and quick links into tags, creatives, and trafficking work.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/campaigns/new" className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 backdrop-blur hover:bg-white/15">
              New campaign
            </Link>
            <Link to="/tags/new" className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 backdrop-blur hover:bg-white/15">
              New tag
            </Link>
            <Link to="/creatives/upload" className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100">
              Upload creative
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Active Campaigns" value={String(snapshot?.activeCampaigns ?? 0)} tone="text-slate-900" />
        <KpiCard label="Impressions" value={fmtCompact(snapshot?.totalImpressions ?? 0)} tone="text-slate-900" />
        <KpiCard label="Spend" value={fmtCurrency(snapshot?.totalSpend ?? 0)} tone="text-emerald-700" />
        <KpiCard label="Clicks" value={fmtCompact(snapshot?.totalClicks ?? 0)} tone="text-indigo-700" />
        <KpiCard label="CTR" value={`${(snapshot?.avgCtr ?? 0).toFixed(2)}%`} tone="text-fuchsia-700" />
        <KpiCard
          label="Engagements"
          value={fmtCompact(snapshot?.engagements ?? 0)}
          tone="text-amber-700"
          helper="Click-based until richer event tracking lands."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-1">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Quick health snapshot</h2>
              <p className="mt-1 text-sm text-slate-500">Fast read on delivery and inventory in the active client.</p>
            </div>
            <Link to="/analytics" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
              Open analytics
            </Link>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tags Live</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{snapshot?.activeTags ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Creatives</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{snapshot?.creatives ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Viewable Imps</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{fmtCompact(snapshot?.totalViewableImpressions ?? 0)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {(snapshot?.viewabilityRate ?? 0).toFixed(2)}% of {fmtCompact(snapshot?.totalMeasuredImpressions ?? 0)} measured
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <Link to="/campaigns" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Go to campaigns
            </Link>
            <Link to="/tags" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Go to tags
            </Link>
            <Link to="/creatives" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Go to creatives
            </Link>
            <Link to="/reporting" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Go to reporting
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Recent campaigns</h2>
              <p className="mt-1 text-sm text-slate-500">The latest campaigns in the active client.</p>
            </div>
            <Link to="/campaigns" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">View all</Link>
          </div>
          <div className="mt-4 space-y-3">
            {snapshot?.recentCampaigns.length ? snapshot.recentCampaigns.map(campaign => (
              <div key={campaign.id} className="rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{campaign.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{campaign.metadata?.dsp ?? 'DSP pending'}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-600">
                    {campaign.status}
                  </span>
                </div>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                No campaigns yet in this client.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Tag inventory</h2>
              <p className="mt-1 text-sm text-slate-500">Quick pulse on available tags before you assign creatives.</p>
            </div>
            <Link to="/tags" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">View all</Link>
          </div>
          <div className="mt-4 space-y-3">
            {snapshot?.topTags.length ? snapshot.topTags.map(tag => (
              <div key={tag.id} className="rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{tag.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{tag.format}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-600">
                    {tag.status}
                  </span>
                </div>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                No tags yet in this client.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
