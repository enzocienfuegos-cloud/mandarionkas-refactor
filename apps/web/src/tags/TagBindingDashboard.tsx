import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loadTagBindings, loadTags, type TagBinding, type TagOption, updateTagBinding } from '../creatives/catalog';
import { Badge, Button, CenteredSpinner, DataTable, EmptyState, FormField, Input, Kicker, PageHeader, Panel, Select, useToast, type ColumnDef } from '../system';
import { Eye } from '../system/icons';
import { TagPreviewDrawer, type TagPreviewTarget } from '../system/preview/TagPreviewDrawer';

type BindingFilter = 'all' | 'active' | 'paused' | 'draft' | 'archived';

function statusBadge(status: TagBinding['status']) {
  const tone: Record<TagBinding['status'], 'success' | 'warning' | 'neutral' | 'info'> = {
    active: 'success',
    paused: 'warning',
    archived: 'neutral',
    draft: 'info',
  };
  return <Badge tone={tone[status]} className="capitalize">{status}</Badge>;
}

export default function TagBindingDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
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
  const [previewTag, setPreviewTag] = useState<TagPreviewTarget | null>(null);

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
        setError(loadError.message ?? 'Couldn’t load tags for assignment review. Check workspace scope or refresh the page.');
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
        setError(loadError.message ?? 'Couldn’t load creative assignments for this tag. Try another tag or refresh the delivery view.');
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
  const mapBindingToPreviewTag = (binding: TagBinding): TagPreviewTarget | null => {
    if (!selectedTag) return null;
    return {
      id: selectedTag.id,
      name: `${selectedTag.name} · ${binding.creativeName}`,
      format: selectedTag.format === 'VAST' ? 'VAST' : selectedTag.format,
      status: selectedTag.status,
      publicUrl: binding.publicUrl ?? null,
      clickUrl: binding.creativeClickUrl ?? null,
      width: binding.variantWidth ?? undefined,
      height: binding.variantHeight ?? undefined,
      updatedAt: binding.updatedAt,
      diagnosticStatus: binding.status === 'active' ? 'ok' : binding.status === 'paused' ? 'warning' : 'error',
      diagnosticMessage: binding.status === 'active'
        ? 'Binding is active and ready for serving preview.'
        : binding.status === 'paused'
          ? 'Binding is paused. Resume it before launch verification.'
          : 'Binding is not serving yet.',
      activeBindingsCount: bindings.filter((entry) => entry.status === 'active').length,
    };
  };

  const columns = useMemo<ColumnDef<TagBinding>[]>(() => [
    {
      id: 'creative',
      header: 'Creative',
      cell: (binding) => (
        <div>
          <div className="font-medium text-text-primary">{binding.creativeName}</div>
          <div className="mt-1 text-xs text-text-muted">{binding.creativeVersionId}</div>
        </div>
      ),
      sortAccessor: (binding) => binding.creativeName,
    },
    {
      id: 'source',
      header: 'Source',
      cell: (binding) => binding.sourceKind,
      sortAccessor: (binding) => binding.sourceKind,
    },
    {
      id: 'versionStatus',
      header: 'Version Status',
      cell: (binding) => binding.creativeVersionStatus,
      sortAccessor: (binding) => binding.creativeVersionStatus,
    },
    {
      id: 'variant',
      header: 'Variant',
      cell: (binding) => (
        binding.variantLabel
          ? `${binding.variantLabel}${binding.variantWidth && binding.variantHeight ? ` · ${binding.variantWidth}×${binding.variantHeight}` : ''}`
          : 'Version default'
      ),
      sortAccessor: (binding) => binding.variantLabel ?? '',
    },
    {
      id: 'assignmentStatus',
      header: 'Assignment Status',
      cell: (binding) => statusBadge(binding.status),
      sortAccessor: (binding) => binding.status,
    },
    {
      id: 'weight',
      header: 'Weight',
      cell: (binding) => (
        <Input
          type="number"
          min="1"
          step="1"
          value={bindingDrafts[binding.id]?.weight ?? String(binding.weight)}
          onChange={(event) => handleBindingDraftChange(binding.id, 'weight', event.target.value)}
          disabled={updatingBindingId === binding.id}
          className="w-24"
        />
      ),
      sortAccessor: (binding) => Number(bindingDrafts[binding.id]?.weight ?? binding.weight) || 0,
    },
    {
      id: 'preview',
      header: 'Preview',
      cell: (binding) => (
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<Eye />}
          onClick={() => setPreviewTag(mapBindingToPreviewTag(binding))}
          disabled={!binding.publicUrl}
        >
          Preview
        </Button>
      ),
      sortAccessor: (binding) => binding.publicUrl ?? '',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (binding) => (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => void handleSaveBinding(binding)}
            disabled={updatingBindingId === binding.id}
            size="sm"
            variant="secondary"
          >
            {updatingBindingId === binding.id ? 'Saving…' : 'Save'}
          </Button>
          {binding.status === 'active' ? (
            <Button
              onClick={() => void handleStatusChange(binding, 'paused')}
              disabled={updatingBindingId === binding.id}
              size="sm"
              variant="ghost"
            >
              Pause
            </Button>
          ) : (
            <Button
              onClick={() => void handleStatusChange(binding, 'active')}
              disabled={updatingBindingId === binding.id}
              size="sm"
              variant="secondary"
            >
              Activate
            </Button>
          )}
        </div>
      ),
    },
  ], [bindingDrafts, bindings, mapBindingToPreviewTag, selectedTag, updatingBindingId]);

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
    return <CenteredSpinner label="Loading tag assignments" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Assignments"
        title="Tag Assignments"
        meta="Operate versioned serving assignments by tag without going through the creative catalog."
        secondaryActions={(
          <Link to="/tags" className="inline-flex">
            <Button variant="secondary">Back to Tags</Button>
          </Link>
        )}
      />

      {error && (
        <Panel className="border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] p-4 text-[color:var(--dusk-status-critical-fg)]" role="alert">
          <p className="font-medium">Error loading assignments</p>
          <p className="mt-1 text-sm">{error}</p>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        <Panel className="p-4">
          <FormField label="Client">
            <Select
            value={clientFilter}
            onChange={event => setClientFilter(event.target.value)}
          >
            <option value="">All clients</option>
            {availableClients.map(client => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
            </Select>
          </FormField>

          <FormField label="Search Tag" className="mt-4">
            <Input
            value={tagSearch}
            onChange={event => setTagSearch(event.target.value)}
            placeholder="Search tag"
          />
          </FormField>

          <FormField label="Tag" className="mt-4">
            <Select
            value={selectedTagId}
            onChange={event => setSelectedTagId(event.target.value)}
          >
            {visibleTags.map(tag => (
              <option key={tag.id} value={tag.id}>
                {tag.name} · {tag.workspaceName ?? 'Client'} · {tag.format} · {tag.status}
              </option>
            ))}
            </Select>
          </FormField>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-text-secondary">Assignment Status</label>
            <div className="flex flex-wrap gap-2">
              {(['all', 'active', 'paused', 'draft', 'archived'] as BindingFilter[]).map(status => (
                <Button
                  key={status}
                  onClick={() => setBindingFilter(status)}
                  size="sm"
                  variant={bindingFilter === status ? 'secondary' : 'ghost'}
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>

          {selectedTag && (
            <div className="mt-4 rounded-lg border border-border-default bg-[color:var(--dusk-surface-muted)] p-3 text-sm">
              <div className="font-medium text-text-primary">{selectedTag.name}</div>
              <div className="mt-1 text-text-muted">
                {selectedTag.format} · {selectedTag.status}
              </div>
            </div>
          )}
        </Panel>

        <Panel padding="none">
          <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Assignments</h2>
              <p className="text-xs text-text-muted">
                {bindingsLoading ? 'Loading…' : `${filteredBindings.length} assignment${filteredBindings.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={filteredBindings}
            rowKey={(binding) => binding.id}
            bordered={false}
            loading={bindingsLoading}
            emptyState={(
              <EmptyState
                title="No assignments match this view"
                description="Try another tag, expand the status filter, or activate more creative versions."
              />
            )}
          />
        </Panel>
      </div>

      <TagPreviewDrawer
        open={Boolean(previewTag)}
        onClose={() => setPreviewTag(null)}
        tag={previewTag}
        onRefresh={selectedTagId ? () => void refreshBindings(selectedTagId) : undefined}
        onViewDiagnostics={selectedTagId ? () => navigate(`/tags/${selectedTagId}/tracking`) : undefined}
      />
    </div>
  );
}
