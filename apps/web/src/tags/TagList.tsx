import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loadAuthMe, loadWorkspaces, switchWorkspace } from '../shared/workspaces';

interface Tag {
  id: string;
  workspaceId?: string | null;
  workspaceName?: string | null;
  name: string;
  campaign: { id: string; name: string } | null;
  format: 'VAST' | 'display' | 'native' | 'tracker';
  status: 'active' | 'paused' | 'archived' | 'draft';
  sizeLabel?: string;
  trackerType?: 'click' | 'impression' | null;
  createdAt: string;
}

const DISPLAY_SIZE_PRESETS = [
  { label: '300x250', width: 300, height: 250 },
  { label: '320x50', width: 320, height: 50 },
  { label: '320x100', width: 320, height: 100 },
  { label: '336x280', width: 336, height: 280 },
  { label: '728x90', width: 728, height: 90 },
  { label: '970x250', width: 970, height: 250 },
  { label: '160x600', width: 160, height: 600 },
  { label: '300x600', width: 300, height: 600 },
];

const formatBadge = (format: Tag['format']) => {
  const cls: Record<Tag['format'], string> = {
    VAST: 'bg-purple-100 text-purple-800',
    display: 'bg-blue-100 text-blue-800',
    native: 'bg-orange-100 text-orange-800',
    tracker: 'bg-emerald-100 text-emerald-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls[format]}`}>
      {format}
    </span>
  );
};

const statusBadge = (status: Tag['status']) => {
  const cls: Record<Tag['status'], string> = {
    active: 'bg-green-100 text-green-800',
    paused: 'bg-yellow-100 text-yellow-800',
    archived: 'bg-slate-100 text-slate-600',
    draft: 'bg-blue-100 text-blue-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${cls[status]}`}>
      {status}
    </span>
  );
};

export default function TagList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tags, setTags] = useState<Tag[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm] = useState({
    workspaceId: '',
    name: '',
    campaignId: '',
    format: 'display' as Tag['format'],
    status: 'draft' as Tag['status'],
    servingWidth: '',
    servingHeight: '',
    trackerType: 'click' as 'click' | 'impression',
    clickUrl: '',
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch('/v1/tags?scope=all', { credentials: 'include' }).then(r => { if (!r.ok) throw new Error('Failed to load tags'); return r.json(); }),
      loadWorkspaces(),
      loadAuthMe(),
    ])
      .then(([d, workspaceList, authMe]) => {
        setTags(d?.tags ?? d ?? []);
        setClients(workspaceList.map(workspace => ({ id: workspace.id, name: workspace.name })));
        setActiveWorkspaceId(authMe.workspace?.id ?? '');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setCreating(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!creating) return;
    setCreateForm(current => ({
      ...current,
      workspaceId: current.workspaceId || selectedClientIds[0] || '',
    }));
  }, [creating, selectedClientIds]);

  const filteredTags = tags.filter(tag => !selectedClientIds.length || selectedClientIds.includes(tag.workspaceId ?? ''));

  const handleDelete = async (tag: Tag) => {
    if (!window.confirm(`Delete tag "${tag.name}"? This cannot be undone.`)) return;
    setDeletingId(tag.id);
    try {
      if (tag.workspaceId && tag.workspaceId !== activeWorkspaceId) {
        await switchWorkspace(tag.workspaceId);
        setActiveWorkspaceId(tag.workspaceId);
      }
      const res = await fetch(`/v1/tags/${tag.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message ?? 'Delete failed');
      }
      setTags(ts => ts.filter(t => t.id !== tag.id));
    } catch (error: any) {
      alert(error.message ?? 'Failed to delete tag.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportTagCsv = async (tag: Tag) => {
    try {
      const res = await fetch(`/v1/tags/${tag.id}/export`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${tag.name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase()}-tag.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export tag.');
    }
  };

  const closeCreate = () => {
    setCreating(false);
    setCreateError('');
    setCreateForm({
      workspaceId: '',
      name: '',
      campaignId: '',
      format: 'display',
      status: 'draft',
      servingWidth: '',
      servingHeight: '',
      trackerType: 'click',
      clickUrl: '',
    });
    if (searchParams.get('create') === '1') {
      setSearchParams({});
    }
  };

  const handleCreate = async () => {
    if (!createForm.workspaceId) {
      setCreateError('Client is required.');
      return;
    }
    if (!createForm.name.trim()) {
      setCreateError('Tag name is required.');
      return;
    }
    if (createForm.format === 'display') {
      if (!createForm.servingWidth || !createForm.servingHeight) {
        setCreateError('Display tags require width and height.');
        return;
      }
    }
    if (createForm.format === 'tracker' && createForm.trackerType === 'click' && !createForm.clickUrl.trim()) {
      setCreateError('Click trackers require a destination URL.');
      return;
    }
    setCreateError('');
    try {
      const res = await fetch('/v1/tags', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: createForm.workspaceId,
          name: createForm.name.trim(),
          campaignId: createForm.campaignId || null,
          format: createForm.format,
          status: createForm.status,
          servingWidth: createForm.format === 'display' ? Number(createForm.servingWidth) || null : null,
          servingHeight: createForm.format === 'display' ? Number(createForm.servingHeight) || null : null,
          trackerType: createForm.format === 'tracker' ? createForm.trackerType : null,
          clickUrl: createForm.format === 'tracker' && createForm.trackerType === 'click' ? createForm.clickUrl.trim() || null : null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message ?? 'Failed to create tag');
      closeCreate();
      await load();
      const createdId = payload?.tag?.id ?? payload?.id;
      if (createdId) navigate(`/tags/${createdId}`);
    } catch (createErr: any) {
      setCreateError(createErr.message ?? 'Failed to create tag');
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
        <p className="font-medium">Error loading tags</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={load} className="mt-3 text-sm text-red-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tags</h1>
          <p className="text-sm text-slate-500 mt-1">{filteredTags.length} tag{filteredTags.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/tags/bindings"
            className="inline-flex items-center gap-2 border border-slate-300 text-slate-700 font-medium px-4 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors"
          >
            🔗 Assignments
          </Link>
          <Link
            to="/tags/health"
            className="inline-flex items-center gap-2 border border-slate-300 text-slate-700 font-medium px-4 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors"
          >
            🩺 Health
          </Link>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            + New Tag
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Client</label>
        <select
          multiple
          value={selectedClientIds}
          onChange={event => setSelectedClientIds(Array.from(event.target.selectedOptions, option => option.value))}
          className="min-h-[110px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
        >
          {clients.map(client => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </select>
        <span className="text-xs text-slate-500">Leave empty to see all clients. Hold Cmd/Ctrl to select multiple.</span>
      </div>

      {filteredTags.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <p className="text-4xl mb-3">🏷️</p>
          <h3 className="text-lg font-medium text-slate-700">No tags yet</h3>
          <p className="text-sm text-slate-500 mt-1 mb-4">No tags match the current client filter.</p>
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 bg-indigo-600 text-white font-medium px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors">
            + New Tag
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Campaign', 'Format', 'Size', 'Status', 'Created At', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTags.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <div>{t.campaign?.name ?? '—'}</div>
                      <div className="text-xs text-slate-400">{t.workspaceName ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">{formatBadge(t.format)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{t.sizeLabel || '—'}</td>
                    <td className="px-4 py-3">{statusBadge(t.status)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/tags/bindings?tagId=${encodeURIComponent(t.id)}`)}
                          className="text-xs text-slate-600 hover:text-slate-700 font-medium px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                        >
                          Change assignments
                        </button>
                        <button
                          onClick={() => handleExportTagCsv(t)}
                          className="text-xs text-slate-600 hover:text-slate-700 font-medium px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                        >
                          Export CSV
                        </button>
                        <button
                          onClick={() => navigate(`/tags/${t.id}`)}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => navigate(`/tags/${t.id}/reporting`)}
                          className="text-xs text-sky-600 hover:text-sky-700 font-medium px-2 py-1 rounded hover:bg-sky-50 transition-colors"
                        >
                          Reporting
                        </button>
                        <button
                          onClick={() => handleDelete(t)}
                          disabled={deletingId === t.id}
                          className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {deletingId === t.id ? '...' : 'Delete'}
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

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-800">Create Tag</h2>
            <p className="mt-1 text-sm text-slate-500">Create the tag first, then configure snippet variants and assignments from the tag workspace.</p>
            {createError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>
            )}
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Client</label>
                <select
                  value={createForm.workspaceId}
                  onChange={event => setCreateForm(current => ({ ...current, workspaceId: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select a client</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Tag Name</label>
                <input
                  value={createForm.name}
                  onChange={event => setCreateForm(current => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Homepage 300x250 display"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Format</label>
                <div className="flex gap-2">
                  {(['VAST', 'display', 'native', 'tracker'] as Tag['format'][]).map(format => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => setCreateForm(current => ({
                        ...current,
                        format,
                        servingWidth: format === 'display' ? current.servingWidth : '',
                        servingHeight: format === 'display' ? current.servingHeight : '',
                        trackerType: format === 'tracker' ? current.trackerType : 'click',
                      }))}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                        createForm.format === format
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>
              {createForm.format === 'display' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Display Size</label>
                    <select
                      value={createForm.servingWidth && createForm.servingHeight ? `${createForm.servingWidth}x${createForm.servingHeight}` : ''}
                      onChange={event => {
                        const preset = DISPLAY_SIZE_PRESETS.find((entry) => entry.label === event.target.value);
                        setCreateForm(current => ({
                          ...current,
                          servingWidth: preset ? String(preset.width) : '',
                          servingHeight: preset ? String(preset.height) : '',
                        }));
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select a size</option>
                      {DISPLAY_SIZE_PRESETS.map((preset) => (
                        <option key={preset.label} value={preset.label}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              {createForm.format === 'tracker' && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Tracker Type</label>
                    <select
                      value={createForm.trackerType}
                      onChange={event => setCreateForm(current => ({ ...current, trackerType: event.target.value as 'click' | 'impression' }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="click">Click tracker</option>
                      <option value="impression">Impression tracker</option>
                    </select>
                  </div>
                  {createForm.trackerType === 'click' && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Destination URL</label>
                      <input
                        value={createForm.clickUrl}
                        onChange={event => setCreateForm(current => ({ ...current, clickUrl: event.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        placeholder="https://example.com/landing"
                      />
                    </div>
                  )}
                </>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                <select
                  value={createForm.status}
                  onChange={event => setCreateForm(current => ({ ...current, status: event.target.value as Tag['status'] }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={closeCreate} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={() => void handleCreate()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                Create Tag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
