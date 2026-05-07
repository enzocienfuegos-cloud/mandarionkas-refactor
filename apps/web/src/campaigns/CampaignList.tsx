import React, { useEffect, useState } from 'react';
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
        filters.setSelectedClientIds(nextFilters.clientId ? [String(nextFilters.clientId)] : []);
        filters.setSearch(String(nextFilters.search ?? ''));
        filters.setStatusFilter((['all', 'live', 'limited', 'blocked', 'ready', 'draft'].includes(String(nextFilters.status))
          ? nextFilters.status
          : 'all') as 'all' | 'live' | 'limited' | 'blocked' | 'ready' | 'draft');
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
    currentViewId,
    filters.setSearch,
    filters.setSelectedClientIds,
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
            meta={`${campaignRows.length} campaigns · ${blockedOrLimited} blocked or limited · delivery workspace`}
            primaryAction={<Link to="/campaigns/new"><Button variant="primary">New campaign</Button></Link>}
            secondaryActions={(
              <SavedViewsMenu
                surface="campaigns"
                currentFilters={{
                  clientId: filters.selectedClientIds[0] ?? '',
                  search: filters.search,
                  status: filters.statusFilter,
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
            alert={(
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <AlertTriangleIcon className="mt-0.5 shrink-0" />
                  <p className="text-sm font-medium">
                  {needsAttentionRows.length} campaigns need attention before new trafficking changes.
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
            )}
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
                  { value: 'limited', label: 'Limited' },
                  { value: 'blocked', label: 'Blocked' },
                  { value: 'ready', label: 'Ready' },
                  { value: 'draft', label: 'Draft' },
                ],
                onChange: (value) => filters.setStatusFilter(value as 'all' | 'live' | 'limited' | 'blocked' | 'ready' | 'draft'),
              },
            ]}
            search={{
              value: filters.search,
              onChange: filters.setSearch,
              placeholder: 'Search campaign, advertiser, owner',
            }}
            activeFilterCount={filters.activeFilterCount}
            onResetAll={filters.resetAll}
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
          onEdit={(row) => void handleEdit(row)}
          onDelete={(row) => void handleDelete(row)}
          deletingId={deletingId}
        />
      )}
    </div>
  );
}
