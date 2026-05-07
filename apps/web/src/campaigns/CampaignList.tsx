import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { switchWorkspace } from '../shared/workspaces';
import {
  Button,
  CenteredSpinner,
  EmptyState,
  FilterBar,
  FormField,
  Input,
  Kicker,
  MetricCard,
  PageHeader,
  Panel,
  Select,
  useConfirm,
  useToast,
} from '../system';
import { AlertTriangleIcon, CampaignsTable, GaugeIcon, ReportIcon, SearchIcon, TableIcon, TrendBadge } from './campaign-list/components';
import type { CampaignRow } from './campaign-list/types';
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
  const [searchParams] = useSearchParams();
  const searchQueryParam = searchParams.get('search') ?? '';
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
  useEffect(() => { filters.setSearch(searchQueryParam); }, [filters, searchQueryParam]);
  const {
    campaignRows,
    liveCampaigns,
    blockedOrLimited,
    draftSetup,
    needsAttentionRows,
    metrics,
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
          <div className="grid gap-5 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricCard
                key={metric.id}
                label={metric.label}
                value={metric.value}
                delta={metric.delta}
                trend={metric.direction}
                context={metric.helper}
                series={metric.series}
                tone={
                  metric.tone === 'fuchsia'
                    ? 'brand'
                    : metric.tone === 'emerald'
                      ? 'success'
                      : metric.tone === 'amber'
                        ? 'warning'
                        : metric.tone === 'rose'
                          ? 'critical'
                          : metric.tone === 'sky'
                            ? 'info'
                            : 'neutral'
                }
                icon={
                  metric.id === 'live'
                    ? <GaugeIcon />
                    : metric.id === 'blocked'
                      ? <AlertTriangleIcon />
                      : metric.id === 'spend'
                        ? <ReportIcon />
                        : <TableIcon />
                }
              />
            ))}
          </div>

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
