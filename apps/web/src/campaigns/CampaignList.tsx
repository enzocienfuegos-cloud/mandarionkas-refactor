import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loadAuthMe, loadWorkspaces, switchWorkspace } from '../shared/workspaces';
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
import type { Campaign, CampaignRow, CampaignStatus, Metric, Tone } from './campaign-list/types';
import { computeDelta, formatCompactMoney, formatDateRange, toNumber, toneClass } from './campaign-list/utils';

// ─── Main export ──────────────────────────────────────────────────────────────

export default function CampaignList() {
  const confirm = useConfirm();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQueryParam = searchParams.get('search') ?? '';
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [search, setSearch] = useState(() => searchQueryParam);
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'limited' | 'blocked' | 'ready' | 'draft'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch('/v1/campaigns?scope=all', { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load campaigns');
        return r.json();
      }),
      loadWorkspaces(),
      loadAuthMe(),
    ])
      .then(([campaignData, workspaceData, authMe]) => {
        setCampaigns(campaignData?.campaigns ?? campaignData ?? []);
        setClients(workspaceData ?? []);
        setActiveWorkspaceId(authMe.workspace?.id ?? '');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => { setSearch(searchQueryParam); }, [searchQueryParam]);

  const filteredCampaigns = useMemo(() => campaigns.filter((campaign) => {
    const clientMatch = !selectedClientIds.length || selectedClientIds.includes(campaign.workspace_id ?? '');
    const needle = search.trim().toLowerCase();
    const searchMatch = !needle
      || campaign.name.toLowerCase().includes(needle)
      || (campaign.workspace_name ?? '').toLowerCase().includes(needle)
      || (campaign.advertiser?.name ?? '').toLowerCase().includes(needle)
      || (campaign.metadata?.dsp ?? '').toLowerCase().includes(needle);
    if (!clientMatch || !searchMatch) return false;

    if (statusFilter === 'all') return true;

    const impressions = toNumber(campaign.impressions);
    const ctr = toNumber(campaign.ctr);
    const hoverMs = toNumber(campaign.totalHoverDurationMs ?? campaign.total_hover_duration_ms);
    let derivedStatus: CampaignStatus = 'Draft';
    if (campaign.status === 'draft' || campaign.status === 'archived') derivedStatus = 'Draft';
    else if (campaign.status === 'paused') derivedStatus = impressions > 0 ? 'Limited' : 'Blocked';
    else if (impressions === 0 && hoverMs === 0) derivedStatus = 'Ready';
    else if (ctr < 0.35 || impressions < 100) derivedStatus = 'Limited';
    else derivedStatus = 'Live';

    const normalized = derivedStatus.toLowerCase() as Lowercase<CampaignStatus>;
    return normalized === statusFilter;
  }), [campaigns, search, selectedClientIds, statusFilter]);

  const campaignRows = useMemo<CampaignRow[]>(() => filteredCampaigns.map((campaign) => {
    const impressions = toNumber(campaign.impressions);
    const ctr = toNumber(campaign.ctr);
    const hoverMs = toNumber(campaign.totalHoverDurationMs ?? campaign.total_hover_duration_ms);
    let status: CampaignStatus = 'Draft';
    if (campaign.status === 'draft') status = 'Draft';
    else if (campaign.status === 'archived') status = 'Draft';
    else if (campaign.status === 'paused') status = impressions > 0 ? 'Limited' : 'Blocked';
    else if (impressions === 0 && hoverMs === 0) status = 'Ready';
    else if (ctr < 0.35 || impressions < 100) status = 'Limited';
    else status = 'Live';

    const issues =
      (status === 'Blocked' ? 2 : 0)
      + (status === 'Limited' ? 1 : 0)
      + (campaign.status === 'draft' ? 1 : 0)
      + (ctr === 0 && impressions > 0 ? 1 : 0);

    return {
      id: campaign.id,
      campaign: campaign.name,
      advertiser: campaign.workspace_name ?? campaign.advertiser?.name ?? 'Workspace',
      status,
      pacing: status === 'Ready' ? 'Not live' : status === 'Draft' ? 'Setup' : `${Math.max(0, Math.min(130, Math.round(ctr * 100)))}%`,
      spend: formatCompactMoney(toNumber(campaign.dailyBudget) * 7),
      budget: formatCompactMoney(toNumber(campaign.dailyBudget) * 10),
      tagHealth: impressions > 0 ? 'Healthy' : campaign.status === 'draft' ? 'Not generated' : 'Low firing',
      creativeStatus: hoverMs > 0 ? 'Approved' : campaign.status === 'draft' ? 'Not uploaded' : 'Pending QA',
      issues,
      owner: campaign.metadata?.dsp ?? 'Ad Ops',
      flight: formatDateRange(campaign.startDate ?? campaign.start_date, campaign.endDate ?? campaign.end_date),
      raw: campaign,
    };
  }), [filteredCampaigns]);

  const liveCampaigns = campaignRows.filter((c) => c.status === 'Live').length;
  const blockedOrLimited = campaignRows.filter((c) => c.status === 'Blocked' || c.status === 'Limited').length;
  const draftSetup = campaignRows.filter((c) => c.status === 'Draft' || c.status === 'Ready').length;
  const openIssues = campaignRows.reduce((sum, c) => sum + c.issues, 0);
  const trackedSpend = campaignRows.reduce((sum, c) => sum + toNumber(c.raw.dailyBudget) * 7, 0);
  const previousTrackedSpend = trackedSpend * 0.92;
  const needsAttentionRows = campaignRows.filter((c) => c.status === 'Blocked' || c.status === 'Limited').slice(0, 3);

  const metrics: Metric[] = [
    { id: 'live', label: 'Live campaigns', value: String(liveCampaigns), delta: `+${Math.max(0, liveCampaigns - 1)}`, direction: 'up', helper: 'currently eligible to deliver', tone: 'fuchsia', series: [1, 1, 2, 2, liveCampaigns || 1, liveCampaigns || 1, liveCampaigns || 1] },
    { id: 'blocked', label: 'Blocked / limited', value: String(blockedOrLimited), delta: `+${Math.max(0, blockedOrLimited - 1)}`, direction: blockedOrLimited > 0 ? 'up' : 'flat', helper: 'need delivery review', tone: 'amber', series: [0, 1, 1, 1, blockedOrLimited || 1, blockedOrLimited || 1, blockedOrLimited || 1] },
    { id: 'spend', label: 'Spend tracked', value: formatCompactMoney(trackedSpend), delta: computeDelta(trackedSpend, previousTrackedSpend).label, direction: computeDelta(trackedSpend, previousTrackedSpend).direction, helper: 'against active campaign budgets', tone: 'emerald', series: [18, 22, 26, 31, 34, 37, 42].map((n) => n * Math.max(trackedSpend / 15300, 0.2)) },
    { id: 'issues', label: 'Open issues', value: String(openIssues), delta: `+${Math.max(0, openIssues - 7)}`, direction: openIssues > 0 ? 'up' : 'flat', helper: 'tags, creatives and pacing', tone: 'rose', series: [4, 5, 5, 7, 8, 9, Math.max(openIssues, 1)] },
  ];

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
                  onClick={() => setSearch(needsAttentionRows[0]?.campaign ?? '')}
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
                value: selectedClientIds[0] ?? '',
                options: [
                  { value: '', label: 'All advertisers' },
                  ...clients.map((client) => ({ value: client.id, label: client.name })),
                ],
                onChange: (value) => setSelectedClientIds(value ? [value] : []),
              },
              {
                id: 'status',
                label: 'Status',
                value: statusFilter,
                options: [
                  { value: 'all', label: 'Active + setup' },
                  { value: 'live', label: 'Live' },
                  { value: 'limited', label: 'Limited' },
                  { value: 'blocked', label: 'Blocked' },
                  { value: 'ready', label: 'Ready' },
                  { value: 'draft', label: 'Draft' },
                ],
                onChange: (value) => setStatusFilter(value as 'all' | 'live' | 'limited' | 'blocked' | 'ready' | 'draft'),
              },
            ]}
            search={{
              value: search,
              onChange: setSearch,
              placeholder: 'Search campaign, advertiser, owner',
            }}
            activeFilterCount={[selectedClientIds[0], statusFilter !== 'all', search.trim()].filter(Boolean).length}
            onResetAll={() => {
              setSelectedClientIds([]);
              setStatusFilter('all');
              setSearch('');
            }}
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
