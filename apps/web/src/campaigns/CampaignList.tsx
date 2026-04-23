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
  impressionGoal: number | null;
  dailyBudget: number | null;
}

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
                  {['Name', 'DSP', 'Status', 'Start Date', 'End Date', 'Imp. Goal', 'Actions'].map(h => (
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
                    <td className="px-4 py-3 text-sm text-slate-600">{fmt(c.startDate)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{fmt(c.endDate)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{fmtNum(c.impressionGoal)}</td>
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
