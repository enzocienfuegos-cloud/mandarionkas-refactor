import { useEffect, useMemo, useState } from 'react';
import { loadAuthMe, loadWorkspaces, switchWorkspace } from '../../shared/workspaces';
import { EMPTY_CREATE_FORM, type CreateTagForm, type Tag } from './types';
import { hasSignalGap } from './utils';

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
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string; workspaceId?: string | null }>>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [filters, setFilters] = useState({
    selectedClientId: '',
    tagSearch: '',
    statusFilter: 'all' as 'all' | 'active' | 'paused' | 'draft' | 'archived' | 'qa',
    needsQaOnly: false,
    selectedTagIds: [] as string[],
  });
  const [requestState, setRequestState] = useState({
    loading: true,
    error: '',
    deletingId: null as string | null,
    bulkActionLoading: false,
  });
  const [createState, setCreateState] = useState({
    creating: false,
    createError: '',
    createForm: EMPTY_CREATE_FORM as CreateTagForm,
  });

  const load = () => {
    setRequestState((current) => ({ ...current, loading: true, error: '' }));
    Promise.allSettled([
      fetch('/v1/tags?scope=all', { credentials: 'include' }).then((response) => {
        if (!response.ok) throw new Error('Couldn’t load tags for this workspace.');
        return response.json();
      }),
      fetch('/v1/campaigns?scope=all', { credentials: 'include' }).then((response) => response.ok ? response.json() : { campaigns: [] }),
      loadWorkspaces('ad_server'),
      loadAuthMe(),
    ])
      .then(([tagsResult, campaignsResult, workspaceResult, authResult]) => {
        if (tagsResult.status !== 'fulfilled') {
          throw tagsResult.reason instanceof Error
            ? tagsResult.reason
            : new Error('Couldn’t load tags for this workspace.');
        }

        const payload = tagsResult.value;
        setTags(payload?.tags ?? payload ?? []);

        if (campaignsResult.status === 'fulfilled') {
          const campaignPayload = campaignsResult.value;
          setCampaigns((campaignPayload?.campaigns ?? campaignPayload ?? []).map((campaign: any) => ({
            id: String(campaign.id ?? ''),
            name: String(campaign.name ?? ''),
            workspaceId: campaign.workspaceId ?? campaign.workspace_id ?? null,
          })));
        } else {
          setCampaigns([]);
        }

        if (workspaceResult.status === 'fulfilled') {
          setClients(workspaceResult.value.map((workspace) => ({ id: workspace.id, name: workspace.name })));
        } else {
          setClients([]);
        }

        if (authResult.status === 'fulfilled') {
          setActiveWorkspaceId(authResult.value.workspace?.id ?? '');
        } else {
          setActiveWorkspaceId('');
        }
      })
      .catch((loadError: Error) => setRequestState((current) => ({ ...current, error: loadError.message })))
      .finally(() => setRequestState((current) => ({ ...current, loading: false })));
  };

  useEffect(load, []);

  useEffect(() => {
    if (openCreateFromQuery) {
      setCreateState((current) => ({ ...current, creating: true }));
    }
  }, [openCreateFromQuery]);

  useEffect(() => {
    if (!createState.creating) return;
    setCreateState((current) => ({
      ...current,
      createForm: {
        ...current.createForm,
        workspaceId: current.createForm.workspaceId || filters.selectedClientId || '',
      },
    }));
  }, [createState.creating, filters.selectedClientId]);

  useEffect(() => {
    const selectedWorkspaceId = createState.createForm.workspaceId;
    if (!selectedWorkspaceId || !createState.createForm.campaignId) return;
    const campaignStillMatches = campaigns.some((campaign) => campaign.id === createState.createForm.campaignId && (campaign.workspaceId ?? '') === selectedWorkspaceId);
    if (campaignStillMatches) return;
    setCreateState((current) => ({
      ...current,
      createForm: {
        ...current.createForm,
        campaignId: '',
      },
    }));
  }, [campaigns, createState.createForm.campaignId, createState.createForm.workspaceId]);

  const normalizedTagSearch = filters.tagSearch.trim().toLowerCase();
  const filteredTags = useMemo(() => tags.filter((tag) => {
    const matchesClient = !filters.selectedClientId || (tag.workspaceId ?? '') === filters.selectedClientId;
    if (!matchesClient) return false;

    if (filters.statusFilter === 'qa' && !hasSignalGap(tag)) {
      return false;
    }

    if (filters.statusFilter !== 'all' && filters.statusFilter !== 'qa' && tag.status !== filters.statusFilter) {
      return false;
    }

    if (filters.needsQaOnly && !hasSignalGap(tag)) {
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
  }), [filters.needsQaOnly, filters.selectedClientId, filters.statusFilter, normalizedTagSearch, tags]);

  const selectedCount = filters.selectedTagIds.length;
  const activeTags = filteredTags.filter((tag) => tag.status === 'active').length;
  const pausedTags = filteredTags.filter((tag) => tag.status === 'paused').length;
  const draftTags = filteredTags.filter((tag) => tag.status === 'draft').length;
  const archivedTags = filteredTags.filter((tag) => tag.status === 'archived').length;
  const totalTags = filteredTags.length;
  const signalGapTags = filteredTags.filter(hasSignalGap).length;
  const eligibleSignalTags = filteredTags.filter((tag) => tag.status === 'active' && (Number(tag.totalImpressions ?? 0) > 0 || hasSignalGap(tag))).length;
  const healthyRate = eligibleSignalTags ? Math.round(((eligibleSignalTags - signalGapTags) / eligibleSignalTags) * 100) : 100;
  const readyTags = filteredTags.filter((tag) => tag.status !== 'draft').length;
  const needsAttentionCount = signalGapTags;

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      selectedTagIds: current.selectedTagIds.filter((id) => filteredTags.some((tag) => tag.id === id)),
    }));
  }, [filteredTags]);

  const selectedKeySet = useMemo(() => new Set(filters.selectedTagIds), [filters.selectedTagIds]);

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
    setRequestState((current) => ({ ...current, deletingId: tag.id }));
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
      setRequestState((current) => ({ ...current, deletingId: null }));
    }
  };

  const handleBulkStatus = async (nextStatus: Extract<Tag['status'], 'active' | 'paused'>) => {
    if (!filters.selectedTagIds.length) return;
    setRequestState((current) => ({ ...current, bulkActionLoading: true }));
    try {
      const selectedTags = tags.filter((tag) => filters.selectedTagIds.includes(tag.id));
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
      setFilters((current) => ({ ...current, selectedTagIds: [] }));
    } catch (bulkError: any) {
      toast({ tone: 'critical', title: bulkError.message ?? 'Bulk update failed.' });
    } finally {
      setRequestState((current) => ({ ...current, bulkActionLoading: false }));
    }
  };

  const handleBulkDelete = async () => {
    if (!filters.selectedTagIds.length) return;
    const confirmed = await confirm({
      title: `Delete ${filters.selectedTagIds.length} selected tag${filters.selectedTagIds.length !== 1 ? 's' : ''}?`,
      description: 'This cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;

    setRequestState((current) => ({ ...current, bulkActionLoading: true }));
    try {
      const selectedTags = tags.filter((tag) => filters.selectedTagIds.includes(tag.id));
      for (const tag of selectedTags) {
        await withWorkspaceContext(tag);
        const response = await fetch(`/v1/tags/${tag.id}`, { method: 'DELETE', credentials: 'include' });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message ?? `Failed to delete "${tag.name}"`);
        }
      }
      setTags((current) => current.filter((tag) => !filters.selectedTagIds.includes(tag.id)));
      setFilters((current) => ({ ...current, selectedTagIds: [] }));
      toast({ tone: 'warning', title: `${selectedTags.length} tag${selectedTags.length === 1 ? '' : 's'} deleted` });
    } catch (bulkError: any) {
      toast({ tone: 'critical', title: bulkError.message ?? 'Bulk delete failed.' });
    } finally {
      setRequestState((current) => ({ ...current, bulkActionLoading: false }));
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
    setCreateState({
      creating: false,
      createError: '',
      createForm: EMPTY_CREATE_FORM,
    });
    if (openCreateFromQuery) {
      clearCreateQuery();
    }
  };

  const openCreate = () => {
    setCreateState((current) => ({ ...current, createError: '', creating: true }));
  };

  const handleCreate = async () => {
    if (!createState.createForm.workspaceId) {
      setCreateState((current) => ({ ...current, createError: 'Client is required.' }));
      return;
    }
    if (!createState.createForm.name.trim()) {
      setCreateState((current) => ({ ...current, createError: 'Tag name is required.' }));
      return;
    }
    if (createState.createForm.format === 'display' && (!createState.createForm.servingWidth || !createState.createForm.servingHeight)) {
      setCreateState((current) => ({ ...current, createError: 'Display tags require width and height.' }));
      return;
    }
    if (createState.createForm.format === 'tracker' && createState.createForm.trackerType === 'click' && !createState.createForm.clickUrl.trim()) {
      setCreateState((current) => ({ ...current, createError: 'Click trackers require a destination URL.' }));
      return;
    }

    setCreateState((current) => ({ ...current, createError: '' }));

    try {
      const response = await fetch('/v1/tags', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: createState.createForm.workspaceId,
          name: createState.createForm.name.trim(),
          campaignId: createState.createForm.campaignId || null,
          format: createState.createForm.format,
          status: createState.createForm.status,
          servingWidth: createState.createForm.format === 'display' ? Number(createState.createForm.servingWidth) || null : null,
          servingHeight: createState.createForm.format === 'display' ? Number(createState.createForm.servingHeight) || null : null,
          trackerType: createState.createForm.format === 'tracker' ? createState.createForm.trackerType : null,
          clickUrl: createState.createForm.format === 'tracker' && createState.createForm.trackerType === 'click' ? createState.createForm.clickUrl.trim() || null : null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'Failed to create tag');
      closeCreate();
      await load();
      const createdId = payload?.tag?.id ?? payload?.id;
      if (createdId) onCreatedTag?.(createdId);
    } catch (createErr: any) {
      setCreateState((current) => ({ ...current, createError: createErr.message ?? 'Failed to create tag' }));
    }
  };

  const setSelectedClientId = (value: string) => setFilters((current) => ({ ...current, selectedClientId: value }));
  const setTagSearch = (value: string) => setFilters((current) => ({ ...current, tagSearch: value }));
  const setStatusFilter = (value: 'all' | 'active' | 'paused' | 'draft' | 'archived' | 'qa') => setFilters((current) => ({
    ...current,
    statusFilter: value,
    needsQaOnly: value === 'qa' ? true : current.needsQaOnly && value === 'all' ? current.needsQaOnly : false,
  }));
  const setNeedsQaOnly = (value: boolean | ((current: boolean) => boolean)) => setFilters((current) => ({
    ...current,
    needsQaOnly: typeof value === 'function' ? value(current.needsQaOnly) : value,
    statusFilter: (typeof value === 'function' ? value(current.needsQaOnly) : value) ? 'qa' : current.statusFilter === 'qa' ? 'all' : current.statusFilter,
  }));
  const setSelectedTagIds = (value: string[] | ((current: string[]) => string[])) => setFilters((current) => ({
    ...current,
    selectedTagIds: typeof value === 'function' ? value(current.selectedTagIds) : value,
  }));
  const setCreateForm = (value: CreateTagForm | ((current: CreateTagForm) => CreateTagForm)) => setCreateState((current) => ({
    ...current,
    createForm: typeof value === 'function' ? value(current.createForm) : value,
  }));

  return {
    tags,
    clients,
    campaigns,
    activeWorkspaceId,
    selectedClientId: filters.selectedClientId,
    setSelectedClientId,
    tagSearch: filters.tagSearch,
    setTagSearch,
    statusFilter: filters.statusFilter,
    setStatusFilter,
    needsQaOnly: filters.needsQaOnly,
    setNeedsQaOnly,
    selectedTagIds: filters.selectedTagIds,
    setSelectedTagIds,
    loading: requestState.loading,
    error: requestState.error,
    deletingId: requestState.deletingId,
    bulkActionLoading: requestState.bulkActionLoading,
    creating: createState.creating,
    createError: createState.createError,
    createForm: createState.createForm,
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
