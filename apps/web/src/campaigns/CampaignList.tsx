import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loadAuthMe, loadWorkspaces, switchWorkspace } from '../shared/workspaces';
import { Panel, SecondaryButton, SectionKicker, StatusBadge } from '../shared/dusk-ui';

interface Campaign {
  id: string;
  workspace_id?: string;
  workspace_name?: string;
  name: string;
  advertiser?: { id: string; name: string };
  metadata?: { dsp?: string | null };
  status: 'active' | 'paused' | 'archived' | 'draft';
  startDate: string | null;
  endDate: string | null;
  start_date?: string | null;
  end_date?: string | null;
  impressionGoal: number | null;
  impression_goal?: number | null;
  dailyBudget: number | null;
  impressions?: number | string | null;
  clicks?: number | string | null;
  ctr?: number | string | null;
  engagement_rate?: number | string | null;
  engagementRate?: number | string | null;
  viewability_rate?: number | string | null;
  viewabilityRate?: number | string | null;
  total_hover_duration_ms?: number | string | null;
  totalHoverDurationMs?: number | string | null;
  total_in_view_duration_ms?: number | string | null;
  totalInViewDurationMs?: number | string | null;
}

type MetricKey = 'impressions' | 'clicks' | 'ctr' | 'engagementRate' | 'viewability' | 'inViewTime' | 'attentionTime';

const METRIC_COLUMNS: Array<{ key: MetricKey; label: string }> = [
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'ctr', label: 'CTR' },
  { key: 'engagementRate', label: 'Eng. Rate' },
  { key: 'viewability', label: 'Viewability' },
  { key: 'inViewTime', label: 'In-View Time' },
  { key: 'attentionTime', label: 'Attention Time' },
];

const DEFAULT_VISIBLE_METRICS: Record<MetricKey, boolean> = {
  impressions: true,
  clicks: true,
  ctr: true,
  engagementRate: true,
  viewability: true,
  inViewTime: true,
  attentionTime: true,
};

const statusBadge = (status: Campaign['status']) => {
  const tones: Record<Campaign['status'], 'healthy' | 'warning' | 'neutral' | 'info'> = {
    active: 'healthy',
    paused: 'warning',
    archived: 'neutral',
    draft: 'info',
  };
  return <StatusBadge tone={tones[status]}>{status}</StatusBadge>;
};

const fmt = (val: string | null) => val ? new Date(val).toLocaleDateString() : '—';
const fmtNum = (val: number | null) => val != null ? val.toLocaleString() : '—';
const toNumber = (val: unknown) => {
  const number = Number(val ?? 0);
  return Number.isFinite(number) ? number : 0;
};
const fmtMetricNum = (val: unknown) => {
  const number = toNumber(val);
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(2)}M`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(1)}K`;
  return number.toLocaleString();
};
const fmtPct = (val: unknown) => `${toNumber(val).toFixed(2)}%`;
const fmtSecondsFromMs = (val: unknown) => {
  const seconds = toNumber(val) / 1000;
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(2)}h`;
  if (seconds >= 60) return `${(seconds / 60).toFixed(1)}m`;
  return `${seconds.toFixed(1)}s`;
};

function getCampaignMetric(campaign: Campaign, key: MetricKey) {
  switch (key) {
    case 'impressions':
      return fmtMetricNum(campaign.impressions);
    case 'clicks':
      return fmtMetricNum(campaign.clicks);
    case 'ctr':
      return fmtPct(campaign.ctr);
    case 'engagementRate':
      return fmtPct(campaign.engagementRate ?? campaign.engagement_rate);
    case 'viewability':
      return fmtPct(campaign.viewabilityRate ?? campaign.viewability_rate);
    case 'inViewTime':
      return fmtSecondsFromMs(campaign.totalInViewDurationMs ?? campaign.total_in_view_duration_ms);
    case 'attentionTime':
      return fmtSecondsFromMs(campaign.totalHoverDurationMs ?? campaign.total_hover_duration_ms);
    default:
      return '—';
  }
}

export default function CampaignList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQueryParam = searchParams.get('search') ?? '';
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<Campaign['status']>('active');
  const [search, setSearch] = useState(() => searchQueryParam);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [metricsCollapsed, setMetricsCollapsed] = useState(false);
  const [visibleMetrics, setVisibleMetrics] = useState<Record<MetricKey, boolean>>(DEFAULT_VISIBLE_METRICS);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch('/v1/campaigns?scope=all', { credentials: 'include' }).then(r => { if (!r.ok) throw new Error('Failed to load campaigns'); return r.json(); }),
      loadWorkspaces(),
      loadAuthMe(),
    ])
      .then(([campaignData, workspaceData, authMe]) => {
        setCampaigns(campaignData?.campaigns ?? campaignData ?? []);
        setClients(workspaceData ?? []);
        setActiveWorkspaceId(authMe.workspace?.id ?? '');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    setSearch(searchQueryParam);
  }, [searchQueryParam]);

  useEffect(() => {
    setSelectedCampaignIds(current => current.filter(id => campaigns.some(campaign => campaign.id === id)));
  }, [campaigns]);

  const filteredCampaigns = campaigns.filter(campaign => {
    const clientMatch = !selectedClientIds.length || selectedClientIds.includes(campaign.workspace_id ?? '');
    const searchMatch = !search.trim()
      || campaign.name.toLowerCase().includes(search.trim().toLowerCase())
      || (campaign.workspace_name ?? '').toLowerCase().includes(search.trim().toLowerCase())
      || (campaign.advertiser?.name ?? '').toLowerCase().includes(search.trim().toLowerCase());
    return clientMatch && searchMatch;
  });
  const visibleMetricColumns = metricsCollapsed
    ? []
    : METRIC_COLUMNS.filter(metric => visibleMetrics[metric.key]);
  const allVisibleSelected = filteredCampaigns.length > 0
    && filteredCampaigns.every(campaign => selectedCampaignIds.includes(campaign.id));
  const hasVisibleSelection = filteredCampaigns.some(campaign => selectedCampaignIds.includes(campaign.id));

  const toggleMetric = (key: MetricKey) => {
    setVisibleMetrics(current => ({ ...current, [key]: !current[key] }));
  };

  const toggleCampaignSelection = (campaignId: string) => {
    setSelectedCampaignIds(current => (
      current.includes(campaignId)
        ? current.filter(id => id !== campaignId)
        : [...current, campaignId]
    ));
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(filteredCampaigns.map(campaign => campaign.id));
      setSelectedCampaignIds(current => current.filter(id => !visibleIds.has(id)));
      return;
    }
    const merged = new Set(selectedCampaignIds);
    filteredCampaigns.forEach(campaign => merged.add(campaign.id));
    setSelectedCampaignIds(Array.from(merged));
  };

  const handleDelete = async (campaign: Campaign) => {
    if (!window.confirm(`Delete campaign "${campaign.name}"? This cannot be undone.`)) return;
    setDeletingId(campaign.id);
    try {
      if (campaign.workspace_id && campaign.workspace_id !== activeWorkspaceId) {
        await switchWorkspace(campaign.workspace_id);
        setActiveWorkspaceId(campaign.workspace_id);
      }
      const res = await fetch(`/v1/campaigns/${campaign.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message ?? 'Delete failed');
      }
      setCampaigns(cs => cs.filter(c => c.id !== campaign.id));
    } catch (error: any) {
      alert(error.message ?? 'Failed to delete campaign.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkStatusUpdate = async (nextStatus: Campaign['status']) => {
    const selectedCampaigns = campaigns.filter(campaign => selectedCampaignIds.includes(campaign.id));
    if (!selectedCampaigns.length) return;
    setBulkUpdating(true);
    try {
      for (const campaign of selectedCampaigns) {
        if (campaign.workspace_id && campaign.workspace_id !== activeWorkspaceId) {
          await switchWorkspace(campaign.workspace_id);
          setActiveWorkspaceId(campaign.workspace_id);
        }
        const res = await fetch(`/v1/campaigns/${campaign.id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.message ?? `Failed to update ${campaign.name}`);
        }
      }
      setCampaigns(current => current.map(campaign => (
        selectedCampaignIds.includes(campaign.id)
          ? { ...campaign, status: nextStatus }
          : campaign
      )));
      if (nextStatus === 'archived') {
        setSelectedCampaignIds([]);
      }
    } catch (error: any) {
      alert(error.message ?? 'Failed to update selected campaigns.');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    const selectedCampaigns = campaigns.filter(campaign => selectedCampaignIds.includes(campaign.id));
    if (!selectedCampaigns.length) return;
    if (!window.confirm(`Delete ${selectedCampaigns.length} selected campaign${selectedCampaigns.length === 1 ? '' : 's'}? This cannot be undone.`)) {
      return;
    }

    setBulkUpdating(true);
    try {
      for (const campaign of selectedCampaigns) {
        if (campaign.workspace_id && campaign.workspace_id !== activeWorkspaceId) {
          await switchWorkspace(campaign.workspace_id);
          setActiveWorkspaceId(campaign.workspace_id);
        }
        const res = await fetch(`/v1/campaigns/${campaign.id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.message ?? `Failed to delete ${campaign.name}`);
        }
      }
      setCampaigns(current => current.filter(campaign => !selectedCampaignIds.includes(campaign.id)));
      setSelectedCampaignIds([]);
    } catch (error: any) {
      alert(error.message ?? 'Failed to delete selected campaigns.');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleEdit = async (campaign: Campaign) => {
    try {
      if (campaign.workspace_id && campaign.workspace_id !== activeWorkspaceId) {
        await switchWorkspace(campaign.workspace_id);
        setActiveWorkspaceId(campaign.workspace_id);
      }
      navigate(`/campaigns/${campaign.id}`);
    } catch {
      alert('Failed to open campaign in its client workspace.');
    }
  };

  const handleExportTagsCsv = async (campaign: Campaign) => {
    try {
      const res = await fetch(`/v1/campaigns/${campaign.id}/tags-export`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${campaign.name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase()}-tags.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export campaign tags.');
    }
  };

  const handleExportEventsCsv = async (campaign: Campaign) => {
    try {
      const res = await fetch(`/v1/campaigns/${campaign.id}/events-export`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${campaign.name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase()}-events.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export campaign events.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-fuchsia-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Panel className="border-rose-200 bg-rose-50/70 p-4 text-rose-700 dark:border-rose-500/22 dark:bg-rose-500/10 dark:text-rose-300">
        <p className="font-medium">Error loading campaigns</p>
        <p className="mt-1 text-sm">{error}</p>
        <button onClick={load} className="mt-3 text-sm font-semibold text-rose-600 underline dark:text-rose-300">Retry</button>
      </Panel>
    );
  }

  return (
    <div className="dusk-page">
      <div className="dusk-page-header">
        <div>
          <SectionKicker>Operations</SectionKicker>
          <h1 className="dusk-title">Campaign operations without the noise</h1>
          <p className="dusk-copy">
            Manage active, limited, blocked, ready and draft campaigns from a single work queue.
            {' '}<span className="font-semibold text-slate-700 dark:text-white/74">{filteredCampaigns.length} campaign{filteredCampaigns.length !== 1 ? 's' : ''}</span> in the current view.
          </p>
        </div>
        <div className="dusk-toolbar-group">
          <Link
            to="/clients"
            className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-slate-200/80 bg-[rgba(252,251,255,0.82)] px-4 text-sm font-medium text-slate-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-white/86 dark:hover:border-fuchsia-500/22 dark:hover:bg-white/[0.045]"
          >
            Manage clients
          </Link>
          <Link
            to="/campaigns/new"
            className="inline-flex min-h-[46px] items-center rounded-xl bg-[linear-gradient(135deg,#F1008B,#c026d3)] px-5 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(241,0,139,0.28)] transition hover:-translate-y-[1px] hover:shadow-[0_18px_42px_rgba(241,0,139,0.34)]"
          >
            New campaign
          </Link>
        </div>
      </div>

      <Panel className="grid gap-4 p-4 md:grid-cols-[240px_minmax(0,1fr)]">
        <div>
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/42">Advertiser filter</label>
          <select
            multiple
            value={selectedClientIds}
            onChange={event => setSelectedClientIds(Array.from(event.target.selectedOptions, option => option.value))}
            className="dusk-select min-h-[110px] w-full px-3 py-2"
          >
            {clients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500 dark:text-white/42">Leave empty to see all clients. Hold Cmd/Ctrl to select multiple.</p>
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/42">Search</label>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Filter by campaign or client name"
            className="dusk-select min-h-[46px] w-full px-3 text-slate-800 placeholder:text-slate-400 focus:ring-4 focus:ring-fuchsia-500/10 dark:placeholder:text-white/30 dark:focus:border-fuchsia-500/30"
          />
        </div>
      </Panel>

      <Panel className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <SectionKicker>Metric strip</SectionKicker>
          <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">Campaign metrics</p>
          <p className="text-xs text-slate-500 dark:text-white/42">Impressions, clicks, CTR, engagement, viewability, and time-based signals.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SecondaryButton
            type="button"
            onClick={() => setMetricsCollapsed(value => !value)}
            className="min-h-[40px] px-3 text-xs"
          >
            {metricsCollapsed ? 'Show metrics' : 'Collapse metrics'}
          </SecondaryButton>
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-xl border border-slate-200/80 bg-[rgba(252,251,255,0.82)] px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-white/86 dark:hover:border-fuchsia-500/22 dark:hover:bg-white/[0.045]">
              Columns
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_18px_46px_rgba(28,18,41,0.12)] dark:border-white/[0.08] dark:bg-[#131925]">
              <div className="space-y-2">
                {METRIC_COLUMNS.map(metric => (
                  <label key={metric.key} className="flex items-center gap-2 text-xs text-slate-700 dark:text-white/72">
                    <input
                      type="checkbox"
                      checked={visibleMetrics[metric.key]}
                      onChange={() => toggleMetric(metric.key)}
                      className="h-4 w-4 rounded border-slate-300 text-fuchsia-600 focus:ring-fuchsia-500"
                    />
                    {metric.label}
                  </label>
                ))}
              </div>
            </div>
          </details>
        </div>
      </Panel>

      <Panel className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <SectionKicker>Bulk actions</SectionKicker>
          <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">Update workflow status at scale</p>
          <p className="text-xs text-slate-500 dark:text-white/42">
            {selectedCampaignIds.length
              ? `${selectedCampaignIds.length} campaign${selectedCampaignIds.length !== 1 ? 's' : ''} selected`
              : 'Select campaigns to change status or archive them'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={bulkStatus}
            onChange={event => setBulkStatus(event.target.value as Campaign['status'])}
            className="dusk-select min-h-[46px] px-3"
            disabled={!selectedCampaignIds.length || bulkUpdating}
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          <SecondaryButton
            type="button"
            onClick={() => void handleBulkStatusUpdate(bulkStatus)}
            disabled={!selectedCampaignIds.length || bulkUpdating}
          >
            {bulkUpdating ? 'Saving…' : 'Apply status'}
          </SecondaryButton>
          <button
            type="button"
            onClick={() => void handleBulkStatusUpdate('archived')}
            disabled={!selectedCampaignIds.length || bulkUpdating}
            className="inline-flex min-h-[46px] items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
          >
            {bulkUpdating ? 'Archiving…' : 'Archive selected'}
          </button>
          <button
            type="button"
            onClick={() => void handleBulkDelete()}
            disabled={!selectedCampaignIds.length || bulkUpdating}
            className="inline-flex min-h-[46px] items-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkUpdating ? 'Deleting…' : 'Delete selected'}
          </button>
        </div>
      </Panel>

      {filteredCampaigns.length === 0 ? (
        <Panel className="px-6 py-20 text-center">
          <SectionKicker>Empty view</SectionKicker>
          <h3 className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">No campaigns match this view</h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-white/42">Try another client filter or create a new campaign.</p>
          <Link
            to="/campaigns/new"
            className="mt-5 inline-flex min-h-[46px] items-center rounded-xl bg-[linear-gradient(135deg,#F1008B,#c026d3)] px-5 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(241,0,139,0.28)] transition hover:-translate-y-[1px] hover:shadow-[0_18px_42px_rgba(241,0,139,0.34)]"
          >
            New campaign
          </Link>
        </Panel>
      ) : (
        <Panel className="p-5">
          <div>
            <SectionKicker>Main operational table</SectionKicker>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Campaign work queue</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-white/42">Track status, pacing, spend and delivery context from one table.</p>
          </div>
          <div className="dusk-data-table">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/8">
              <thead className="dusk-table-head">
                <tr className="dusk-table-head-row">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      className="h-4 w-4 rounded border-slate-300 text-fuchsia-600 focus:ring-fuchsia-500"
                      aria-label={allVisibleSelected ? 'Deselect visible campaigns' : 'Select visible campaigns'}
                    />
                  </th>
                  {[
                    'Name',
                    'DSP',
                    'Status',
                    'Start Date',
                    'End Date',
                    'Imp. Goal',
                    ...visibleMetricColumns.map(metric => metric.label),
                    'Actions',
                  ].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/8">
                {filteredCampaigns.map(c => (
                <tr key={c.id} className="dusk-table-row">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedCampaignIds.includes(c.id)}
                        onChange={() => toggleCampaignSelection(c.id)}
                        className="h-4 w-4 rounded border-slate-300 text-fuchsia-600 focus:ring-fuchsia-500"
                        aria-label={`Select campaign ${c.name}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-sm font-semibold text-slate-950 dark:text-white">{c.name}</span>
                        <div className="mt-1 text-xs text-slate-500 dark:text-white/48">{c.workspace_name ?? 'Client unavailable'}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-white/62">{c.metadata?.dsp ?? c.advertiser?.name ?? '—'}</td>
                    <td className="px-4 py-3">{statusBadge(c.status)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-white/62">{fmt(c.startDate ?? c.start_date ?? null)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-white/62">{fmt(c.endDate ?? c.end_date ?? null)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-white/62">{fmtNum(c.impressionGoal ?? c.impression_goal ?? null)}</td>
                    {visibleMetricColumns.map(metric => (
                      <td key={metric.key} className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-slate-700 dark:text-white/72">
                        {getCampaignMetric(c, metric.key)}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void handleEdit(c)}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-fuchsia-600 transition hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:hover:bg-white/[0.05]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void handleExportTagsCsv(c)}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-white/72 dark:hover:bg-white/[0.05] dark:hover:text-white"
                        >
                          Export tags CSV
                        </button>
                        <button
                          onClick={() => void handleExportEventsCsv(c)}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-white/72 dark:hover:bg-white/[0.05] dark:hover:text-white"
                        >
                          Export events CSV
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          disabled={deletingId === c.id}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 dark:hover:bg-rose-500/10"
                        >
                          {deletingId === c.id ? '...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
