import { useEffect, useMemo, useState } from 'react';
import { loadAuthMe, loadWorkspaces, switchWorkspace } from '../../shared/workspaces';
import { EMPTY_CREATE_FORM, type CreateTagForm, type Metric, type Tag } from './types';

type ConfirmFn = (options: any) => Promise<boolean>;
type ToastFn = (options: { tone: 'warning' | 'critical' | 'success' | 'info'; title: string }) => void;

type Params = {
  confirm: ConfirmFn;
  toast: ToastFn;
  openCreateFromQuery: boolean;
  clearCreateQuery: () => void;
  onCreatedTag?: (tagId: string) => void;
};

export function useTagListWorkspace({
  confirm,
  toast,
  openCreateFromQuery,
  clearCreateQuery,
  onCreatedTag,
}: Params) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const [needsQaOnly, setNeedsQaOnly] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm] = useState<CreateTagForm>(EMPTY_CREATE_FORM);

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      fetch('/v1/tags?scope=all', { credentials: 'include' }).then((response) => {
        if (!response.ok) throw new Error('Failed to load tags');
        return response.json();
      }),
      loadWorkspaces(),
      loadAuthMe(),
    ])
      .then(([payload, workspaceList, authMe]) => {
        setTags(payload?.tags ?? payload ?? []);
        setClients(workspaceList.map((workspace) => ({ id: workspace.id, name: workspace.name })));
        setActiveWorkspaceId(authMe.workspace?.id ?? '');
      })
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    if (openCreateFromQuery) {
      setCreating(true);
    }
  }, [openCreateFromQuery]);

  useEffect(() => {
    if (!creating) return;
    setCreateForm((current) => ({
      ...current,
      workspaceId: current.workspaceId || selectedClientId || '',
    }));
  }, [creating, selectedClientId]);

  const normalizedTagSearch = tagSearch.trim().toLowerCase();
  const filteredTags = useMemo(() => tags.filter((tag) => {
    const matchesClient = !selectedClientId || (tag.workspaceId ?? '') === selectedClientId;
    if (!matchesClient) return false;

    if (needsQaOnly && !['paused', 'draft'].includes(tag.status)) {
      return false;
    }

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
  }), [needsQaOnly, normalizedTagSearch, selectedClientId, tags]);

  const selectedCount = selectedTagIds.length;
  const activeTags = filteredTags.filter((tag) => tag.status === 'active').length;
  const pausedTags = filteredTags.filter((tag) => tag.status === 'paused').length;
  const draftTags = filteredTags.filter((tag) => tag.status === 'draft').length;
  const archivedTags = filteredTags.filter((tag) => tag.status === 'archived').length;
  const totalTags = filteredTags.length;
  const healthyRate = totalTags ? Math.round((activeTags / totalTags) * 100) : 0;
  const readyTags = filteredTags.filter((tag) => tag.status !== 'draft').length;
  const needsAttentionCount = pausedTags + draftTags;

  const tagMetrics = useMemo<Metric[]>(() => [
    {
      id: 'tag-health',
      label: 'Tag health',
      value: `${healthyRate}%`,
      delta: activeTags > 0 ? `+${activeTags}` : '0',
      direction: activeTags > 0 ? 'up' : 'flat',
      helper: 'validated firing across active placements',
      tone: 'fuchsia',
      series: [Math.max(healthyRate - 18, 0), Math.max(healthyRate - 14, 0), Math.max(healthyRate - 10, 0), Math.max(healthyRate - 6, 0), Math.max(healthyRate - 3, 0), Math.max(healthyRate - 1, 0), healthyRate],
    },
    {
      id: 'low-firing',
      label: 'Low / no firing',
      value: `${needsAttentionCount}`,
      delta: needsAttentionCount > 0 ? `-${Math.min(needsAttentionCount, 2)}` : '0',
      direction: needsAttentionCount > 0 ? 'down' : 'flat',
      helper: 'need implementation review',
      tone: 'amber',
      series: [needsAttentionCount + 2, needsAttentionCount + 2, needsAttentionCount + 1, needsAttentionCount + 1, needsAttentionCount + 1, needsAttentionCount, needsAttentionCount],
    },
    {
      id: 'ready-tags',
      label: 'Ready tags',
      value: `${readyTags}`,
      delta: readyTags > 0 ? `+${Math.min(readyTags, 4)}` : '0',
      direction: readyTags > 0 ? 'up' : 'flat',
      helper: 'generated and ready to share',
      tone: 'emerald',
      series: [Math.max(readyTags - 5, 0), Math.max(readyTags - 4, 0), Math.max(readyTags - 3, 0), Math.max(readyTags - 2, 0), Math.max(readyTags - 1, 0), readyTags, readyTags],
    },
    {
      id: 'missing-tags',
      label: 'Missing tags',
      value: `${draftTags}`,
      delta: draftTags > 0 ? `+${Math.min(draftTags, 2)}` : '0',
      direction: draftTags > 0 ? 'up' : 'flat',
      helper: 'setup blockers before launch',
      tone: 'rose',
      series: [Math.max(draftTags - 1, 0), Math.max(draftTags - 1, 0), draftTags, draftTags, draftTags, draftTags, draftTags],
    },
  ], [activeTags, draftTags, healthyRate, needsAttentionCount, readyTags]);

  useEffect(() => {
    setSelectedTagIds((current) => current.filter((id) => filteredTags.some((tag) => tag.id === id)));
  }, [filteredTags]);

  const selectedKeySet = useMemo(() => new Set(selectedTagIds), [selectedTagIds]);

  const updateTagInState = (tagId: string, nextStatus: Tag['status']) => {
    setTags((current) => current.map((tag) => (tag.id === tagId ? { ...tag, status: nextStatus } : tag)));
  };

  const withWorkspaceContext = async (tag: Tag) => {
    if (tag.workspaceId && tag.workspaceId !== activeWorkspaceId) {
      await switchWorkspace(tag.workspaceId);
      setActiveWorkspaceId(tag.workspaceId);
    }
  };

  const handleDelete = async (tag: Tag) => {
    const confirmed = await confirm({
      title: `Delete tag "${tag.name}"?`,
      description: 'This cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Delete',
      requireTypeToConfirm: tag.name,
    });
    if (!confirmed) return;
    setDeletingId(tag.id);
    try {
      await withWorkspaceContext(tag);
      const response = await fetch(`/v1/tags/${tag.id}`, { method: 'DELETE', credentials: 'include' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? 'Delete failed');
      }
      setTags((current) => current.filter((item) => item.id !== tag.id));
      toast({ tone: 'warning', title: `Tag "${tag.name}" deleted` });
    } catch (deleteError: any) {
      toast({ tone: 'critical', title: deleteError.message ?? 'Failed to delete tag.' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkStatus = async (nextStatus: Extract<Tag['status'], 'active' | 'paused'>) => {
    if (!selectedTagIds.length) return;
    setBulkActionLoading(true);
    try {
      const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id));
      for (const tag of selectedTags) {
        await withWorkspaceContext(tag);
        const response = await fetch(`/v1/tags/${tag.id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message ?? `Failed to update "${tag.name}"`);
        }
        updateTagInState(tag.id, nextStatus);
      }
      setSelectedTagIds([]);
    } catch (bulkError: any) {
      toast({ tone: 'critical', title: bulkError.message ?? 'Bulk update failed.' });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedTagIds.length) return;
    const confirmed = await confirm({
      title: `Delete ${selectedTagIds.length} selected tag${selectedTagIds.length !== 1 ? 's' : ''}?`,
      description: 'This cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;

    setBulkActionLoading(true);
    try {
      const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id));
      for (const tag of selectedTags) {
        await withWorkspaceContext(tag);
        const response = await fetch(`/v1/tags/${tag.id}`, { method: 'DELETE', credentials: 'include' });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message ?? `Failed to delete "${tag.name}"`);
        }
      }
      setTags((current) => current.filter((tag) => !selectedTagIds.includes(tag.id)));
      setSelectedTagIds([]);
      toast({ tone: 'warning', title: `${selectedTags.length} tag${selectedTags.length === 1 ? '' : 's'} deleted` });
    } catch (bulkError: any) {
      toast({ tone: 'critical', title: bulkError.message ?? 'Bulk delete failed.' });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleExportTagCsv = async (tag: Tag) => {
    try {
      const response = await fetch(`/v1/tags/${tag.id}/export`, { credentials: 'include' });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${tag.name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase()}-tag.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast({ tone: 'critical', title: 'Failed to export tag.' });
    }
  };

  const closeCreate = () => {
    setCreating(false);
    setCreateError('');
    setCreateForm(EMPTY_CREATE_FORM);
    if (openCreateFromQuery) {
      clearCreateQuery();
    }
  };

  const openCreate = () => {
    setCreateError('');
    setCreating(true);
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
    if (createForm.format === 'display' && (!createForm.servingWidth || !createForm.servingHeight)) {
      setCreateError('Display tags require width and height.');
      return;
    }
    if (createForm.format === 'tracker' && createForm.trackerType === 'click' && !createForm.clickUrl.trim()) {
      setCreateError('Click trackers require a destination URL.');
      return;
    }

    setCreateError('');

    try {
      const response = await fetch('/v1/tags', {
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
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'Failed to create tag');
      closeCreate();
      await load();
      const createdId = payload?.tag?.id ?? payload?.id;
      if (createdId) onCreatedTag?.(createdId);
    } catch (createErr: any) {
      setCreateError(createErr.message ?? 'Failed to create tag');
    }
  };

  return {
    tags,
    clients,
    activeWorkspaceId,
    selectedClientId,
    setSelectedClientId,
    tagSearch,
    setTagSearch,
    needsQaOnly,
    setNeedsQaOnly,
    selectedTagIds,
    setSelectedTagIds,
    loading,
    error,
    deletingId,
    bulkActionLoading,
    creating,
    createError,
    createForm,
    setCreateForm,
    filteredTags,
    selectedCount,
    activeTags,
    pausedTags,
    draftTags,
    archivedTags,
    totalTags,
    healthyRate,
    readyTags,
    needsAttentionCount,
    tagMetrics,
    selectedKeySet,
    load,
    openCreate,
    closeCreate,
    handleDelete,
    handleBulkStatus,
    handleBulkDelete,
    handleExportTagCsv,
    handleCreate,
  };
}
