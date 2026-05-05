import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loadAuthMe, loadWorkspaces, switchWorkspace } from '../shared/workspaces';
import { Panel, PrimaryButton, SecondaryButton, SectionKicker, StatusBadge } from '../shared/dusk-ui';

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
  assignedCount?: number;
  assignedNames?: string;
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
  const tone: Record<Tag['format'], 'info' | 'neutral' | 'warning' | 'healthy'> = {
    VAST: 'info',
    display: 'neutral',
    native: 'warning',
    tracker: 'healthy',
  };
  return (
    <StatusBadge tone={tone[format]}>{format}</StatusBadge>
  );
};

const statusBadge = (status: Tag['status']) => {
  const tone: Record<Tag['status'], 'healthy' | 'warning' | 'neutral' | 'info'> = {
    active: 'healthy',
    paused: 'warning',
    archived: 'neutral',
    draft: 'info',
  };
  return (
    <StatusBadge tone={tone[status]} className="capitalize">{status}</StatusBadge>
  );
};

export default function TagList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tags, setTags] = useState<Tag[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
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
      workspaceId: current.workspaceId || selectedClientId || '',
    }));
  }, [creating, selectedClientId]);

  const normalizedClientSearch = clientSearch.trim().toLowerCase();
  const visibleClients = clients.filter(client => (
    !normalizedClientSearch || client.name.toLowerCase().includes(normalizedClientSearch)
  ));
  const normalizedTagSearch = tagSearch.trim().toLowerCase();
  const filteredTags = tags.filter(tag => {
    const matchesClient = !selectedClientId || (tag.workspaceId ?? '') === selectedClientId;
    if (!matchesClient) return false;
    if (!normalizedTagSearch) return true;
    const haystack = [
      tag.name,
      tag.workspaceName,
      tag.campaign?.name,
      tag.assignedNames,
      tag.format,
      tag.status,
      tag.sizeLabel,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedTagSearch);
  });
  const selectedCount = selectedTagIds.length;
  const allVisibleSelected = filteredTags.length > 0 && filteredTags.every(tag => selectedTagIds.includes(tag.id));
  const someVisibleSelected = filteredTags.some(tag => selectedTagIds.includes(tag.id));
  const liveTags = filteredTags.filter((tag) => tag.status === 'active').length;
  const lowFiringTags = filteredTags.filter((tag) => tag.status === 'paused').length;
  const notInstalledTags = filteredTags.filter((tag) => tag.status === 'draft').length;
  const seenTodayTags = filteredTags.filter((tag) => {
    const created = new Date(tag.createdAt);
    const now = new Date();
    return created.toDateString() === now.toDateString();
  }).length;
  const recentlyUpdated = [...filteredTags]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  useEffect(() => {
    setSelectedTagIds(current => current.filter(id => filteredTags.some(tag => tag.id === id)));
  }, [filteredTags]);

  const updateTagInState = (tagId: string, nextStatus: Tag['status']) => {
    setTags(current => current.map(tag => (
      tag.id === tagId ? { ...tag, status: nextStatus } : tag
    )));
  };

  const withWorkspaceContext = async (tag: Tag) => {
    if (tag.workspaceId && tag.workspaceId !== activeWorkspaceId) {
      await switchWorkspace(tag.workspaceId);
      setActiveWorkspaceId(tag.workspaceId);
    }
  };

  const handleDelete = async (tag: Tag) => {
    if (!window.confirm(`Delete tag "${tag.name}"? This cannot be undone.`)) return;
    setDeletingId(tag.id);
    try {
      await withWorkspaceContext(tag);
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

  const toggleTagSelection = (tagId: string) => {
    setSelectedTagIds(current => (
      current.includes(tagId)
        ? current.filter(id => id !== tagId)
        : [...current, tagId]
    ));
  };

  const toggleSelectAllVisible = () => {
    setSelectedTagIds(current => {
      if (allVisibleSelected) {
        return current.filter(id => !filteredTags.some(tag => tag.id === id));
      }
      const next = new Set(current);
      filteredTags.forEach(tag => next.add(tag.id));
      return Array.from(next);
    });
  };

  const handleBulkStatus = async (nextStatus: Extract<Tag['status'], 'active' | 'paused'>) => {
    if (!selectedTagIds.length) return;
    setBulkActionLoading(true);
    try {
      const selectedTags = tags.filter(tag => selectedTagIds.includes(tag.id));
      for (const tag of selectedTags) {
        await withWorkspaceContext(tag);
        const res = await fetch(`/v1/tags/${tag.id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.message ?? `Failed to ${nextStatus === 'active' ? 'activate' : 'deactivate'} "${tag.name}"`);
        }
        updateTagInState(tag.id, nextStatus);
      }
      setSelectedTagIds([]);
    } catch (bulkError: any) {
      alert(bulkError.message ?? 'Bulk update failed.');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedTagIds.length) return;
    if (!window.confirm(`Delete ${selectedTagIds.length} selected tag${selectedTagIds.length !== 1 ? 's' : ''}? This cannot be undone.`)) {
      return;
    }
    setBulkActionLoading(true);
    try {
      const selectedTags = tags.filter(tag => selectedTagIds.includes(tag.id));
      for (const tag of selectedTags) {
        await withWorkspaceContext(tag);
        const res = await fetch(`/v1/tags/${tag.id}`, { method: 'DELETE', credentials: 'include' });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.message ?? `Failed to delete "${tag.name}"`);
        }
      }
      setTags(current => current.filter(tag => !selectedTagIds.includes(tag.id)));
      setSelectedTagIds([]);
    } catch (bulkError: any) {
      alert(bulkError.message ?? 'Bulk delete failed.');
    } finally {
      setBulkActionLoading(false);
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
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-fuchsia-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Panel className="border-rose-200 bg-rose-50/90 p-4 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
        <p className="font-medium">Error loading tags</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={load} className="mt-3 text-sm text-red-600 underline">Retry</button>
      </Panel>
    );
  }

  return (
    <div className="dusk-page">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedClientId}
            onChange={event => setSelectedClientId(event.target.value)}
            className="dusk-select min-h-[46px] min-w-[180px] px-4"
          >
            <option value="">All advertisers</option>
            {visibleClients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
          <button type="button" className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-slate-200/80 bg-[rgba(252,251,255,0.82)] px-4 text-sm font-medium text-slate-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-white/86 dark:hover:border-fuchsia-500/22 dark:hover:bg-white/[0.045]">
            Active + firing
          </button>
          <input
            value={clientSearch}
            onChange={event => setClientSearch(event.target.value)}
            placeholder="Search campaign, placement, client"
            className="min-h-[46px] min-w-[320px] rounded-xl border border-slate-200/80 bg-[rgba(252,251,255,0.82)] px-4 text-sm text-slate-800 outline-none placeholder:text-slate-400 transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-500/10 dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-white dark:placeholder:text-white/30 dark:focus:border-fuchsia-500/30"
          />
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex min-h-[46px] items-center rounded-xl bg-[linear-gradient(135deg,#F1008B,#c026d3)] px-5 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(241,0,139,0.28)] transition hover:-translate-y-[1px] hover:shadow-[0_18px_42px_rgba(241,0,139,0.34)]"
        >
          Generate tag
        </button>
      </div>

      <header className="grid gap-6 xl:grid-cols-[1.4fr_1fr] xl:items-end">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-700 dark:border-fuchsia-500/15 dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
            Tags
            <span className="h-1 w-1 rounded-full bg-current opacity-60" />
            Pixels & firing
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-white md:text-5xl">Tag firing and implementation health</h1>
          <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600 dark:text-white/62">Validate generation, implementation and firing health from one operational queue instead of bouncing between utilities.</p>
        </div>
        <Panel className="p-5">
          <SectionKicker>Recommended focus</SectionKicker>
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/18 dark:bg-amber-500/10">
            <div className="mt-0.5 h-2.5 w-2.5 rounded-full bg-amber-500" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-100">{lowFiringTags + notInstalledTags} tags need attention</p>
              <p className="mt-1 text-sm text-amber-700/72 dark:text-amber-100/62">Review low-firing tags, missing installs, and recently changed placements before publishing new trafficking.</p>
            </div>
          </div>
        </Panel>
      </header>

      <div className="grid gap-5 xl:grid-cols-4">
        <Panel className="p-5"><SectionKicker>Tags firing</SectionKicker><div className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{liveTags}</div><p className="mt-2 text-sm text-slate-500 dark:text-white/56">healthy tags live in the current view</p></Panel>
        <Panel className="p-5"><SectionKicker>Low firing</SectionKicker><div className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{lowFiringTags}</div><p className="mt-2 text-sm text-slate-500 dark:text-white/56">paused or degraded placements</p></Panel>
        <Panel className="p-5"><SectionKicker>Not installed</SectionKicker><div className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{notInstalledTags}</div><p className="mt-2 text-sm text-slate-500 dark:text-white/56">draft tags still missing implementation</p></Panel>
        <Panel className="p-5"><SectionKicker>Last seen today</SectionKicker><div className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{seenTodayTags}</div><p className="mt-2 text-sm text-slate-500 dark:text-white/56">tags updated or seen in today&apos;s window</p></Panel>
      </div>

      {selectedCount > 0 && (
        <Panel className="border-fuchsia-200 bg-fuchsia-50/80 px-4 py-3 dark:border-fuchsia-500/20 dark:bg-fuchsia-500/10">
          <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-fuchsia-900 dark:text-fuchsia-200">
            {selectedCount} tag{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={() => void handleBulkStatus('active')}
            disabled={bulkActionLoading}
            className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-500/20 dark:bg-white/[0.04] dark:text-emerald-300 dark:hover:bg-white/[0.07]"
          >
            Activate
          </button>
          <button
            onClick={() => void handleBulkStatus('paused')}
            disabled={bulkActionLoading}
            className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-500/20 dark:bg-white/[0.04] dark:text-amber-300 dark:hover:bg-white/[0.07]"
          >
            Deactivate
          </button>
          <button
            onClick={() => void handleBulkDelete()}
            disabled={bulkActionLoading}
            className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/20 dark:bg-white/[0.04] dark:text-rose-300 dark:hover:bg-white/[0.07]"
          >
            Delete
          </button>
          {bulkActionLoading && <span className="text-xs text-slate-500 dark:text-white/52">Applying changes...</span>}
          </div>
        </Panel>
      )}

      {filteredTags.length === 0 ? (
        <Panel className="px-6 py-20 text-center">
          <SectionKicker>No matches</SectionKicker>
          <h3 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">No tags yet</h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-white/56">No tags match the current client or tag filter.</p>
          <div className="mt-5 flex justify-center">
            <PrimaryButton onClick={() => setCreating(true)}>New Tag</PrimaryButton>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
          <Panel className="overflow-hidden p-6">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-white/8 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <SectionKicker>Main operational table</SectionKicker>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Tag inventory</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-white/56">Track placement health, campaign assignment, and implementation state from one table.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link to="/tags/bindings" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:border-white/8 dark:bg-white/[0.03] dark:text-white/72 dark:hover:border-fuchsia-500/28 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-200">Assignments</Link>
                <Link to="/tags/health" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:border-white/8 dark:bg-white/[0.03] dark:text-white/72 dark:hover:border-fuchsia-500/28 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-200">Health</Link>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 dark:border-white/8 dark:bg-white/[0.025]"><p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Total</p><p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{filteredTags.length}</p><p className="mt-1 text-sm text-slate-500 dark:text-white/52">tags in current view</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 dark:border-white/8 dark:bg-white/[0.025]"><p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Firing</p><p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{liveTags}</p><p className="mt-1 text-sm text-slate-500 dark:text-white/52">healthy placements</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 dark:border-white/8 dark:bg-white/[0.025]"><p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Low firing</p><p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{lowFiringTags}</p><p className="mt-1 text-sm text-slate-500 dark:text-white/52">require investigation</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 dark:border-white/8 dark:bg-white/[0.025]"><p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Not installed</p><p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{notInstalledTags}</p><p className="mt-1 text-sm text-slate-500 dark:text-white/52">still in setup</p></div>
            </div>
            <div className="app-scrollbar mt-6 overflow-x-auto">
            <table className="dusk-data-table min-w-full">
              <thead className="dusk-table-head">
                <tr className="dusk-table-head-row">
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={element => {
                        if (element) {
                          element.indeterminate = !allVisibleSelected && someVisibleSelected;
                        }
                      }}
                      onChange={toggleSelectAllVisible}
                      className="h-4 w-4 rounded border-slate-300 text-fuchsia-600 focus:ring-fuchsia-500"
                      aria-label="Select all visible tags"
                    />
                  </th>
                  {['Tag', 'Client / Campaign', 'Assigned', 'Format', 'Size', 'Status', 'Created At', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTags.map(t => (
                  <tr key={t.id} className="dusk-table-row">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedTagIds.includes(t.id)}
                        onChange={() => toggleTagSelection(t.id)}
                        className="h-4 w-4 rounded border-slate-300 text-fuchsia-600 focus:ring-fuchsia-500"
                        aria-label={`Select tag ${t.name}`}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-white/72">
                      <div className="font-medium text-slate-800 dark:text-white">{t.name}</div>
                      <div className="text-xs text-slate-400 dark:text-white/36">{t.id}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-white/72">
                      <div>{t.workspaceName ?? '—'}</div>
                      <div className="text-xs text-slate-400 dark:text-white/36">{t.campaign?.name ?? 'No campaign'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-white/72">
                      <div>{t.assignedCount ? `${t.assignedCount} assigned` : 'No assignments'}</div>
                      <div className="text-xs text-slate-400 dark:text-white/36">
                        {t.assignedNames?.trim() ? t.assignedNames : 'No creatives assigned'}
                      </div>
                    </td>
                    <td className="px-4 py-3">{formatBadge(t.format)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-white/72">{t.sizeLabel || '—'}</td>
                    <td className="px-4 py-3">{statusBadge(t.status)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-white/72">
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
                          className="rounded-lg px-2 py-1 text-xs font-medium text-fuchsia-600 transition-colors hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:hover:bg-white/[0.05]"
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
                          onClick={() => navigate(`/tags/${t.id}/tracking`)}
                          className="text-xs text-violet-600 hover:text-violet-700 font-medium px-2 py-1 rounded hover:bg-violet-50 transition-colors"
                        >
                          Tracking
                        </button>
                        <button
                          onClick={() => navigate(`/tags/${t.id}/pixels`)}
                          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium px-2 py-1 rounded hover:bg-emerald-50 transition-colors"
                        >
                          Pixels
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
          </Panel>
          <Panel className="p-6">
            <div className="space-y-8">
              <section>
                <SectionKicker>Low firing</SectionKicker>
                <div className="mt-4 space-y-3">
                  {filteredTags.filter((tag) => tag.status === 'paused').slice(0, 3).map((tag) => (
                    <div key={tag.id} className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.025]">
                      <p className="font-semibold text-slate-950 dark:text-white">{tag.name}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-white/56">{tag.workspaceName ?? 'Workspace'} · {tag.campaign?.name ?? 'No campaign'}</p>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <SectionKicker>Missing cachebuster</SectionKicker>
                <div className="mt-4 space-y-3">
                  {filteredTags.filter((tag) => tag.format === 'display' && !tag.sizeLabel).slice(0, 3).map((tag) => (
                    <div key={tag.id} className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.025]">
                      <p className="font-semibold text-slate-950 dark:text-white">{tag.name}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-white/56">Display placement needs implementation review.</p>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <SectionKicker>Recently updated</SectionKicker>
                <div className="mt-4 grid gap-3">
                  {recentlyUpdated.map((tag) => (
                    <Link key={tag.id} to={`/tags/${tag.id}`} className="dusk-card-link p-4">
                      <p className="font-semibold text-slate-950 dark:text-white">{tag.name}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-white/56">{new Date(tag.createdAt).toLocaleDateString()} · {tag.workspaceName ?? 'Workspace'}</p>
                    </Link>
                  ))}
                </div>
              </section>
              <section>
                <SectionKicker>Quick ops</SectionKicker>
                <div className="mt-4 grid gap-3">
                  <Link to="/tags/health" className="dusk-card-link p-4"><p className="font-semibold text-slate-950 dark:text-white">Health dashboard</p><p className="mt-1 text-sm text-slate-500 dark:text-white/56">Review low firing placements and stale inventory.</p></Link>
                  <Link to="/tags/bindings" className="dusk-card-link p-4"><p className="font-semibold text-slate-950 dark:text-white">Assignments</p><p className="mt-1 text-sm text-slate-500 dark:text-white/56">Inspect campaign and creative bindings.</p></Link>
                </div>
              </section>
            </div>
          </Panel>
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
