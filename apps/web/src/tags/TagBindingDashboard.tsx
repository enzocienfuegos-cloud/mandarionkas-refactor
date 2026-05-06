import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { loadTagBindings, loadTags, type TagBinding, type TagOption, updateTagBinding } from '../creatives/catalog';
import { useToast } from '../system';

type BindingFilter = 'all' | 'active' | 'paused' | 'draft' | 'archived';

function statusBadge(status: TagBinding['status']) {
  const cls: Record<TagBinding['status'], string> = {
    active: 'bg-green-100 text-green-800',
    paused: 'bg-yellow-100 text-yellow-800',
    archived: 'bg-slate-100 text-slate-600',
    draft: 'bg-blue-100 text-blue-800',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls[status]}`}>
      {status}
    </span>
  );
}

export default function TagBindingDashboard() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [tags, setTags] = useState<TagOption[]>([]);
  const [selectedTagId, setSelectedTagId] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const [bindings, setBindings] = useState<TagBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [bindingsLoading, setBindingsLoading] = useState(false);
  const [error, setError] = useState('');
  const [bindingFilter, setBindingFilter] = useState<BindingFilter>('all');
  const [bindingDrafts, setBindingDrafts] = useState<Record<string, { weight: string; status: TagBinding['status'] }>>({});
  const [updatingBindingId, setUpdatingBindingId] = useState<string | null>(null);

  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      setError('');
      try {
        const loadedTags = await loadTags({ scope: 'all' });
        const requestedTagId = searchParams.get('tagId') ?? '';
        setTags(loadedTags);
        setSelectedTagId(current => current || (loadedTags.some(tag => tag.id === requestedTagId) ? requestedTagId : loadedTags[0]?.id || ''));
      } catch (loadError: any) {
        setError(loadError.message ?? 'Failed to load tag assignments');
      } finally {
        setLoading(false);
      }
    };
    void loadInitial();
  }, [searchParams]);

  useEffect(() => {
    if (!selectedTagId) {
      setBindings([]);
      return;
    }

    let cancelled = false;
    setBindingsLoading(true);
    setError('');
    void loadTagBindings(selectedTagId)
      .then(nextBindings => {
        if (cancelled) return;
        setBindings(nextBindings);
        setBindingsLoading(false);
      })
      .catch(loadError => {
        if (cancelled) return;
        setError(loadError.message ?? 'Failed to load assignments');
        setBindingsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTagId]);

  useEffect(() => {
    setBindingDrafts(
      Object.fromEntries(
        bindings.map(binding => [
          binding.id,
          {
            weight: String(Math.max(1, Number(binding.weight) || 1)),
            status: binding.status,
          },
        ]),
      ),
    );
  }, [bindings]);

  const filteredBindings = useMemo(() => {
    if (bindingFilter === 'all') return bindings;
    return bindings.filter(binding => binding.status === bindingFilter);
  }, [bindings, bindingFilter]);

  const availableClients = useMemo(() => {
    const seen = new Map<string, string>();
    tags.forEach(tag => {
      const workspaceId = String(tag.workspaceId ?? '').trim();
      if (!workspaceId) return;
      if (!seen.has(workspaceId)) {
        seen.set(workspaceId, tag.workspaceName ?? workspaceId);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [tags]);

  const normalizedTagSearch = tagSearch.trim().toLowerCase();
  const visibleTags = useMemo(() => (
    tags.filter(tag => {
      const matchesClient = !clientFilter || (tag.workspaceId ?? '') === clientFilter;
      if (!matchesClient) return false;
      if (!normalizedTagSearch) return true;
      return [
        tag.name,
        tag.workspaceName,
        tag.format,
        tag.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedTagSearch);
    })
  ), [clientFilter, normalizedTagSearch, tags]);

  useEffect(() => {
    if (!visibleTags.length) {
      setSelectedTagId('');
      return;
    }
    if (visibleTags.some(tag => tag.id === selectedTagId)) return;
    setSelectedTagId(visibleTags[0]?.id ?? '');
  }, [selectedTagId, visibleTags]);

  const selectedTag = tags.find(tag => tag.id === selectedTagId) ?? null;

  const handleBindingDraftChange = (
    bindingId: string,
    field: 'weight' | 'status',
    value: string,
  ) => {
    setBindingDrafts(current => ({
      ...current,
      [bindingId]: {
        weight: current[bindingId]?.weight ?? '1',
        status: current[bindingId]?.status ?? 'active',
        [field]: value,
      } as { weight: string; status: TagBinding['status'] },
    }));
  };

  const refreshBindings = async (tagId: string) => {
    const nextBindings = await loadTagBindings(tagId);
    setBindings(nextBindings);
  };

  const handleSaveBinding = async (binding: TagBinding) => {
    setUpdatingBindingId(binding.id);
    try {
      const draft = bindingDrafts[binding.id] ?? {
        weight: String(Math.max(1, Number(binding.weight) || 1)),
        status: binding.status,
      };
      await updateTagBinding({
        tagId: binding.tagId,
        bindingId: binding.id,
        status: draft.status,
        weight: Math.max(1, Number.parseInt(draft.weight, 10) || 1),
      });
      await refreshBindings(binding.tagId);
      toast({ tone: 'success', title: 'Assignment updated' });
    } catch {
      toast({ tone: 'critical', title: 'Failed to update assignment status.' });
    } finally {
      setUpdatingBindingId(null);
    }
  };

  const handleStatusChange = async (binding: TagBinding, nextStatus: 'active' | 'paused') => {
    handleBindingDraftChange(binding.id, 'status', nextStatus);
    setUpdatingBindingId(binding.id);
    try {
      await updateTagBinding({
        tagId: binding.tagId,
        bindingId: binding.id,
        status: nextStatus,
        weight: Math.max(1, Number(bindingDrafts[binding.id]?.weight ?? binding.weight) || 1),
      });
      await refreshBindings(binding.tagId);
      toast({ tone: 'success', title: `Assignment ${nextStatus === 'active' ? 'activated' : 'paused'}` });
    } catch {
      toast({ tone: 'critical', title: 'Failed to update assignment status.' });
    } finally {
      setUpdatingBindingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tag Assignments</h1>
          <p className="mt-1 text-sm text-slate-500">
            Operate versioned serving assignments by tag without going through the creative catalog.
          </p>
        </div>
        <Link
          to="/tags"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to Tags
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p className="font-medium">Error loading assignments</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <label className="mb-2 block text-sm font-medium text-slate-700">Client</label>
          <select
            value={clientFilter}
            onChange={event => setClientFilter(event.target.value)}
            className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All clients</option>
            {availableClients.map(client => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>

          <label className="mb-2 block text-sm font-medium text-slate-700">Search Tag</label>
          <input
            value={tagSearch}
            onChange={event => setTagSearch(event.target.value)}
            placeholder="Search tag"
            className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <label className="mb-2 block text-sm font-medium text-slate-700">Tag</label>
          <select
            value={selectedTagId}
            onChange={event => setSelectedTagId(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {visibleTags.map(tag => (
              <option key={tag.id} value={tag.id}>
                {tag.name} · {tag.workspaceName ?? 'Client'} · {tag.format} · {tag.status}
              </option>
            ))}
          </select>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-slate-700">Assignment Status</label>
            <div className="flex flex-wrap gap-2">
              {(['all', 'active', 'paused', 'draft', 'archived'] as BindingFilter[]).map(status => (
                <button
                  key={status}
                  onClick={() => setBindingFilter(status)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    bindingFilter === status
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {selectedTag && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="font-medium text-slate-800">{selectedTag.name}</div>
              <div className="mt-1 text-slate-500">
                {selectedTag.format} · {selectedTag.status}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Assignments</h2>
              <p className="text-xs text-slate-500">
                {bindingsLoading ? 'Loading…' : `${filteredBindings.length} assignment${filteredBindings.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Creative</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Version Status</th>
                  <th className="px-4 py-3">Variant</th>
                  <th className="px-4 py-3">Assignment Status</th>
                  <th className="px-4 py-3">Weight</th>
                  <th className="px-4 py-3">Preview</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBindings.map(binding => (
                  <tr key={binding.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{binding.creativeName}</div>
                      <div className="mt-1 text-xs text-slate-500">{binding.creativeVersionId}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{binding.sourceKind}</td>
                    <td className="px-4 py-3 text-slate-600">{binding.creativeVersionStatus}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {binding.variantLabel
                        ? `${binding.variantLabel}${binding.variantWidth && binding.variantHeight ? ` · ${binding.variantWidth}×${binding.variantHeight}` : ''}`
                        : 'Version default'}
                    </td>
                    <td className="px-4 py-3">{statusBadge(binding.status)}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={bindingDrafts[binding.id]?.weight ?? String(binding.weight)}
                        onChange={(event) => handleBindingDraftChange(binding.id, 'weight', event.target.value)}
                        disabled={updatingBindingId === binding.id}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {binding.publicUrl ? (
                        <a
                          href={binding.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-700"
                        >
                          Open
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => void handleSaveBinding(binding)}
                          disabled={updatingBindingId === binding.id}
                          className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                        >
                          {updatingBindingId === binding.id ? 'Saving…' : 'Save'}
                        </button>
                        {binding.status === 'active' ? (
                          <button
                            onClick={() => void handleStatusChange(binding, 'paused')}
                            disabled={updatingBindingId === binding.id}
                            className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                          >
                            Pause
                          </button>
                        ) : (
                          <button
                            onClick={() => void handleStatusChange(binding, 'active')}
                            disabled={updatingBindingId === binding.id}
                            className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!bindingsLoading && filteredBindings.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                No assignments match this view yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
