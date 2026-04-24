import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadAuthMe, switchWorkspace } from '../shared/workspaces';

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
  const classes: Record<Campaign['status'], string> = {
    active: 'bg-green-100 text-green-800',
    paused: 'bg-yellow-100 text-yellow-800',
    archived: 'bg-slate-100 text-slate-600',
    draft: 'bg-blue-100 text-blue-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${classes[status]}`}>
      {status}
    </span>
  );
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
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [metricsCollapsed, setMetricsCollapsed] = useState(false);
  const [visibleMetrics, setVisibleMetrics] = useState<Record<MetricKey, boolean>>(DEFAULT_VISIBLE_METRICS);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch('/v1/campaigns?scope=all', { credentials: 'include' }).then(r => { if (!r.ok) throw new Error('Failed to load campaigns'); return r.json(); }),
      fetch('/v1/auth/workspaces', { credentials: 'include' }).then(r => { if (!r.ok) throw new Error('Failed to load clients'); return r.json(); }),
      loadAuthMe(),
    ])
      .then(([campaignData, workspaceData, authMe]) => {
        setCampaigns(campaignData?.campaigns ?? campaignData ?? []);
        setClients(workspaceData?.workspaces ?? []);
        setActiveWorkspaceId(authMe.workspace?.id ?? '');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filteredCampaigns = campaigns.filter(campaign => {
    const clientMatch = !selectedClientId || campaign.workspace_id === selectedClientId;
    const searchMatch = !search.trim()
      || campaign.name.toLowerCase().includes(search.trim().toLowerCase())
      || (campaign.workspace_name ?? '').toLowerCase().includes(search.trim().toLowerCase());
    return clientMatch && searchMatch;
  });
  const visibleMetricColumns = metricsCollapsed
    ? []
    : METRIC_COLUMNS.filter(metric => visibleMetrics[metric.key]);

  const toggleMetric = (key: MetricKey) => {
    setVisibleMetrics(current => ({ ...current, [key]: !current[key] }));
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
      if (!res.ok) throw new Error('Delete failed');
      setCampaigns(cs => cs.filter(c => c.id !== campaign.id));
    } catch {
      alert('Failed to delete campaign.');
    } finally {
      setDeletingId(null);
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-medium">Error loading campaigns</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={load} className="mt-3 text-sm text-red-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Campaigns</h1>
          <p className="text-sm text-slate-500 mt-1">{filteredCampaigns.length} campaign{filteredCampaigns.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/clients"
            className="inline-flex items-center gap-2 border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            + Add Client
          </Link>
          <Link
            to="/campaigns/new"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            + New Campaign
          </Link>
        </div>
      </div>

      <div className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[240px_minmax(0,1fr)]">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Client</label>
          <select
            value={selectedClientId}
            onChange={event => setSelectedClientId(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All clients</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Campaign name</label>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Filter by campaign or client name"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">Campaign metrics</p>
          <p className="text-xs text-slate-500">Impressions, clicks, CTR, engagement, viewability, and time-based signals.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMetricsCollapsed(value => !value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            {metricsCollapsed ? 'Show metrics' : 'Collapse metrics'}
          </button>
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50">
              Columns
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
              <div className="space-y-2">
                {METRIC_COLUMNS.map(metric => (
                  <label key={metric.key} className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={visibleMetrics[metric.key]}
                      onChange={() => toggleMetric(metric.key)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {metric.label}
                  </label>
                ))}
              </div>
            </div>
          </details>
        </div>
      </div>

      {filteredCampaigns.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <p className="text-4xl mb-3">📋</p>
          <h3 className="text-lg font-medium text-slate-700">No campaigns match this view</h3>
          <p className="text-sm text-slate-500 mt-1 mb-4">Try another client filter or create a new campaign.</p>
          <Link to="/campaigns/new" className="inline-flex items-center gap-2 bg-indigo-600 text-white font-medium px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors">
            + New Campaign
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
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
              <tbody className="divide-y divide-slate-100">
                {filteredCampaigns.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-sm font-medium text-slate-800">{c.name}</span>
                        <div className="mt-1 text-xs text-slate-500">{c.workspace_name ?? 'Client unavailable'}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{c.metadata?.dsp ?? c.advertiser?.name ?? '—'}</td>
                    <td className="px-4 py-3">{statusBadge(c.status)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{fmt(c.startDate ?? c.start_date ?? null)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{fmt(c.endDate ?? c.end_date ?? null)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{fmtNum(c.impressionGoal ?? c.impression_goal ?? null)}</td>
                    {visibleMetricColumns.map(metric => (
                      <td key={metric.key} className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-700">
                        {getCampaignMetric(c, metric.key)}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void handleEdit(c)}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void handleExportTagsCsv(c)}
                          className="text-xs text-slate-700 hover:text-slate-900 font-medium px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                        >
                          Export tags CSV
                        </button>
                        <button
                          onClick={() => void handleExportEventsCsv(c)}
                          className="text-xs text-slate-700 hover:text-slate-900 font-medium px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                        >
                          Export events CSV
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          disabled={deletingId === c.id}
                          className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
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
        </div>
      )}
    </div>
  );
}
