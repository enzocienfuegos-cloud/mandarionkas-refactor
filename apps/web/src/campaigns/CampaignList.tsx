import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getSavedView } from '../shared/saved-views';
import { switchWorkspace } from '../shared/workspaces';
import {
  Button,
  CenteredSpinner,
  ConfigurableMetricStrip,
  EmptyState,
  FilterBar,
  PageHeader,
  Panel,
  SavedViewsMenu,
  useConfirm,
  useToast,
} from '../system';
import { AlertTriangleIcon, CampaignsTable } from './campaign-list/components';
import type { CampaignRow } from './campaign-list/types';
import { campaignMetricScope } from './campaign.metrics';
import {
  useCampaignData,
  useCampaignFilters,
  useCampaignViewModel,
} from './campaign-list/hooks';

// ─── Main export ──────────────────────────────────────────────────────────────

export default function CampaignList() {
  const confirm = useConfirm();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQueryParam = searchParams.get('search') ?? '';
  const currentViewId = searchParams.get('view');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const filters = useCampaignFilters(searchQueryParam);
  const {
    campaigns,
    setCampaigns,
    clients,
    activeWorkspaceId,
    setActiveWorkspaceId,
    loading,
    error,
    reload: load,
  } = useCampaignData();
  useEffect(() => { filters.setSearch(searchQueryParam); }, [filters.setSearch, searchQueryParam]);
  useEffect(() => {
    if (!activeWorkspaceId) return;
    filters.setSelectedClientIds((current) => (
      current.length === 1 && current[0] === activeWorkspaceId
        ? current
        : [activeWorkspaceId]
    ));
  }, [activeWorkspaceId, filters.setSelectedClientIds]);
  useEffect(() => {
    if (!currentViewId) return;
    let cancelled = false;
    void getSavedView(currentViewId)
      .then((view) => {
        if (cancelled) return;
        if (!view || view.surface !== 'campaigns') {
          setSearchParams((params) => {
            const next = new URLSearchParams(params);
            next.delete('view');
            return next;
          });
          return;
        }
        const nextFilters = view.filters ?? {};
        filters.setSelectedClientIds(nextFilters.clientId ? [String(nextFilters.clientId)] : activeWorkspaceId ? [activeWorkspaceId] : []);
        filters.setSearch(String(nextFilters.search ?? ''));
        filters.setStatusFilter((['all', 'live', 'paused', 'ready', 'draft', 'archived'].includes(String(nextFilters.status))
          ? nextFilters.status
          : 'all') as 'all' | 'live' | 'paused' | 'ready' | 'draft' | 'archived');
        filters.setSpendView((['without_margin', 'with_margin'].includes(String(nextFilters.spendView))
          ? nextFilters.spendView
          : 'without_margin') as 'without_margin' | 'with_margin');
      })
      .catch(() => {
        if (!cancelled) {
          setSearchParams((params) => {
            const next = new URLSearchParams(params);
            next.delete('view');
            return next;
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    activeWorkspaceId,
    currentViewId,
    filters.setSearch,
    filters.setSelectedClientIds,
    filters.setSpendView,
    filters.setStatusFilter,
    setSearchParams,
  ]);
  const {
    campaignRows,
    liveCampaigns,
    blockedOrLimited,
    draftSetup,
    openIssues,
    trackedSpend,
    needsAttentionRows,
  } = useCampaignViewModel({
    campaigns,
    filters,
  });
  const selectedKeySet = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => campaignRows.some((row) => row.id === id)));
  }, [campaignRows]);

  const handleDelete = async (campaign: CampaignRow) => {
    const confirmed = await confirm({
      title: `Delete campaign "${campaign.campaign}"?`,
      description: 'This cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Delete',
      requireTypeToConfirm: campaign.campaign,
    });
    if (!confirmed) return;
    setDeletingId(campaign.id);
    try {
      if (campaign.raw.workspace_id && campaign.raw.workspace_id !== activeWorkspaceId) {
        await switchWorkspace(campaign.raw.workspace_id);
        setActiveWorkspaceId(campaign.raw.workspace_id);
      }
      const res = await fetch(`/v1/campaigns/${campaign.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error((payload as any)?.message ?? 'Delete failed');
      }
      setCampaigns((current) => current.filter((item) => item.id !== campaign.id));
      toast({ tone: 'warning', title: `Campaign "${campaign.campaign}" deleted` });
    } catch (deleteError: any) {
      toast({ tone: 'critical', title: deleteError.message ?? 'Failed to delete campaign.' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = async (campaign: CampaignRow) => {
    try {
      if (campaign.raw.workspace_id && campaign.raw.workspace_id !== activeWorkspaceId) {
        await switchWorkspace(campaign.raw.workspace_id);
        setActiveWorkspaceId(campaign.raw.workspace_id);
      }
      navigate(`/campaigns/${campaign.id}`);
    } catch {
      toast({ tone: 'critical', title: 'Failed to open campaign in its client workspace.' });
    }
  };

  const updateCampaignStatuses = async (
    rows: CampaignRow[],
    nextStatus: 'active' | 'paused' | 'archived',
    messages: {
      title: string;
      description: string;
      confirmLabel: string;
      success: string;
      tone: 'default' | 'danger';
    },
  ) => {
    if (!rows.length) return;
    const confirmed = await confirm({
      title: messages.title,
      description: messages.description,
      tone: messages.tone,
      confirmLabel: messages.confirmLabel,
    });
    if (!confirmed) return;

    setBulkActionLoading(true);
    try {
      for (const row of rows) {
        const res = await fetch(`/v1/campaigns/${row.id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: row.raw.workspace_id ?? null,
            status: nextStatus,
          }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error((payload as any)?.message ?? `Failed to update "${row.campaign}"`);
        }
      }
      await load();
      setSelectedIds([]);
      toast({ tone: nextStatus === 'active' ? 'success' : 'warning', title: messages.success });
    } catch (bulkError: any) {
      toast({ tone: 'critical', title: bulkError.message ?? 'Bulk status update failed.' });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkPause = async (rows: CampaignRow[]) => {
    await updateCampaignStatuses(rows, 'paused', {
      title: `Pause ${rows.length} campaign${rows.length === 1 ? '' : 's'}?`,
      description: 'They will stop delivering until resumed.',
      confirmLabel: 'Pause',
      success: `Paused ${rows.length} campaign${rows.length === 1 ? '' : 's'}.`,
      tone: 'default',
    });
  };

  const handleBulkResume = async (rows: CampaignRow[]) => {
    await updateCampaignStatuses(rows, 'active', {
      title: `Resume ${rows.length} campaign${rows.length === 1 ? '' : 's'}?`,
      description: 'They will return to active delivery.',
      confirmLabel: 'Resume',
      success: `Resumed ${rows.length} campaign${rows.length === 1 ? '' : 's'}.`,
      tone: 'default',
    });
  };

  const handleBulkArchive = async (rows: CampaignRow[]) => {
    await updateCampaignStatuses(rows, 'archived', {
      title: `Archive ${rows.length} campaign${rows.length === 1 ? '' : 's'}?`,
      description: 'Archived campaigns stay available for history but leave the active queue.',
      confirmLabel: 'Archive',
      success: `Archived ${rows.length} campaign${rows.length === 1 ? '' : 's'}.`,
      tone: 'danger',
    });
  };

  const handleBulkDelete = async (rows: CampaignRow[]) => {
    if (!rows.length) return;
    const confirmed = await confirm({
      title: `Delete ${rows.length} campaign${rows.length === 1 ? '' : 's'}?`,
      description: 'This cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;

    setBulkActionLoading(true);
    try {
      for (const row of rows) {
        const params = new URLSearchParams();
        if (row.raw.workspace_id) params.set('workspaceId', row.raw.workspace_id);
        const res = await fetch(`/v1/campaigns/${row.id}?${params.toString()}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error((payload as any)?.message ?? `Failed to delete "${row.campaign}"`);
        }
      }
      await load();
      setSelectedIds([]);
      toast({ tone: 'warning', title: `Deleted ${rows.length} campaign${rows.length === 1 ? '' : 's'}.` });
    } catch (bulkError: any) {
      toast({ tone: 'critical', title: bulkError.message ?? 'Bulk delete failed.' });
    } finally {
      setBulkActionLoading(false);
    }
  };

  if (loading) {
    return (
      <CenteredSpinner label="Loading campaigns workspace…" />
    );
  }

  if (error) {
    return (
      <Panel className="border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] p-4 text-[color:var(--dusk-status-critical-fg)]" role="alert">
        <p className="font-medium">Error loading campaigns</p>
        <p className="mt-1 text-sm">{error}</p>
        <Button onClick={load} variant="ghost" size="sm" className="mt-3">Retry</Button>
      </Panel>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-6">

          <PageHeader
            kicker="Campaigns · Delivery workspace"
            title="Campaigns"
            meta={`${campaignRows.length} campaigns · ${blockedOrLimited} paused · delivery workspace`}
            primaryAction={<Link to="/campaigns/new"><Button variant="primary">New campaign</Button></Link>}
            secondaryActions={(
              <SavedViewsMenu
                surface="campaigns"
                currentFilters={{
                  clientId: filters.selectedClientIds[0] ?? '',
                  search: filters.search,
                  status: filters.statusFilter,
                  spendView: filters.spendView,
                }}
                currentViewId={currentViewId}
                onApplyView={(view) => {
                  const nextSearch = String(view.filters?.search ?? '');
                  setSearchParams((params) => {
                    const next = new URLSearchParams(params);
                    next.set('view', view.id);
                    if (nextSearch) next.set('search', nextSearch);
                    else next.delete('search');
                    return next;
                  });
                }}
                onClearView={() => {
                  setSearchParams((params) => {
                    const next = new URLSearchParams(params);
                    next.delete('view');
                    return next;
                  });
                }}
              />
            )}
            alert={needsAttentionRows.length ? (
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <AlertTriangleIcon className="mt-0.5 shrink-0" />
                  <p className="text-sm font-medium">
                  {needsAttentionRows.length} campaigns need operational review before new trafficking changes.
                </p>
              </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => filters.setSearch(needsAttentionRows[0]?.campaign ?? '')}
                >
                  Focus issues
                </Button>
              </div>
            ) : undefined}
          />

          <FilterBar
            pills={[
              {
                id: 'advertiser',
                label: 'Advertiser',
                value: filters.selectedClientIds[0] ?? '',
                options: [
                  { value: '', label: 'All advertisers' },
                  ...clients.map((client) => ({ value: client.id, label: client.name })),
                ],
                onChange: (value) => filters.setSelectedClientIds(value ? [value] : []),
              },
              {
                id: 'status',
                label: 'Status',
                value: filters.statusFilter,
                options: [
                  { value: 'all', label: 'Active + setup' },
                  { value: 'live', label: 'Live' },
                  { value: 'paused', label: 'Paused' },
                  { value: 'ready', label: 'Ready' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'archived', label: 'Archived' },
                ],
                onChange: (value) => filters.setStatusFilter(value as 'all' | 'live' | 'paused' | 'ready' | 'draft' | 'archived'),
              },
              {
                id: 'spend-view',
                label: 'Spend view',
                value: filters.spendView,
                options: [
                  { value: 'without_margin', label: 'Without margin' },
                  { value: 'with_margin', label: 'With margin' },
                ],
                onChange: (value) => filters.setSpendView(value as 'without_margin' | 'with_margin'),
              },
            ]}
            search={{
              value: filters.search,
              onChange: filters.setSearch,
              placeholder: 'Search campaign, advertiser, owner',
            }}
            activeFilterCount={filters.activeFilterCount}
            onResetAll={() => {
              filters.resetAll();
              if (activeWorkspaceId) filters.setSelectedClientIds([activeWorkspaceId]);
            }}
          />

          {/* ── Metrics ── */}
          <ConfigurableMetricStrip
            scope={campaignMetricScope}
            data={{
              liveCampaigns,
              blockedOrLimited,
              draftSetup,
              openIssues,
              trackedSpend,
              campaignCount: campaignRows.length,
              spendView: filters.spendView,
            }}
          />

          {/* ── Campaigns table ── */}
      {campaignRows.length === 0 ? (
        <EmptyState
          kicker="Empty view"
          title="No campaigns match this view"
          description="Try another advertiser filter or create a new campaign."
          action={<Link to="/campaigns/new"><Button variant="primary">New campaign</Button></Link>}
        />
      ) : (
        <CampaignsTable
          campaignRows={campaignRows}
          liveCampaigns={liveCampaigns}
          blockedOrLimited={blockedOrLimited}
          draftSetup={draftSetup}
          spendView={filters.spendView}
          onEdit={(row) => void handleEdit(row)}
          onDelete={(row) => void handleDelete(row)}
          deletingId={deletingId}
          selectedKeys={selectedKeySet}
          onSelectionChange={(keys) => setSelectedIds(Array.from(keys))}
          bulkActionLoading={bulkActionLoading}
          onBulkPause={(rows) => void handleBulkPause(rows)}
          onBulkResume={(rows) => void handleBulkResume(rows)}
          onBulkArchive={(rows) => void handleBulkArchive(rows)}
          onBulkDelete={(rows) => void handleBulkDelete(rows)}
        />
      )}
    </div>
  );
}
