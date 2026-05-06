import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loadAuthMe, loadWorkspaces, switchWorkspace } from '../shared/workspaces';
import {
  Button,
  CenteredSpinner,
  EmptyState,
  Input,
  Kicker,
  MetricCard,
  Panel,
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
    return clientMatch && searchMatch;
  }), [campaigns, search, selectedClientIds]);

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
      <Panel className="border-rose-200 bg-rose-50/70 p-4 text-rose-700 dark:border-rose-500/22 dark:bg-rose-500/10 dark:text-rose-300">
        <p className="font-medium">Error loading campaigns</p>
        <p className="mt-1 text-sm">{error}</p>
        <Button onClick={load} variant="ghost" size="sm" className="mt-3">Retry</Button>
      </Panel>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-6">

          {/* ── Toolbar ── */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedClientIds[0] ?? ''}
                onChange={(e) => setSelectedClientIds(e.target.value ? [e.target.value] : [])}
                className="inline-flex min-h-[46px] min-w-[180px] items-center gap-2 rounded-xl border border-border-default/80 bg-[rgba(252,251,255,0.82)] px-4 text-sm font-medium text-text-secondary outline-none transition hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:border-white/[0.06] dark:bg-surface-1/[0.025] dark:text-white/86 dark:hover:border-fuchsia-500/22 dark:hover:bg-surface-1/[0.045]"
              >
                <option value="">All advertisers</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
              <Button type="button" variant="secondary" className="min-h-[46px]">
                Active + setup
              </Button>
              <label className="relative block min-w-[300px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--dusk-text-soft)] dark:text-white/40"><SearchIcon /></span>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="min-h-[46px] border-border-default/80 bg-[rgba(252,251,255,0.82)] pl-10"
                  placeholder="Search campaign, advertiser, owner"
                />
              </label>
            </div>
            <Link to="/campaigns/new">
              <Button variant="primary">New campaign</Button>
            </Link>
          </div>

          {/* ── Header ── */}
          <header className="grid gap-6 xl:grid-cols-[1.4fr_1fr] xl:items-end">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-700 dark:border-fuchsia-500/15 dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
                Campaigns
                <span className="h-1 w-1 rounded-full bg-current opacity-60" />
                Delivery workspace
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)] md:text-5xl">Campaign operations without the noise</h1>
              <p className="mt-3 max-w-3xl text-lg leading-8 text-text-muted dark:text-white/62">Scan campaign readiness, catch blockers, and move from pacing, tags or creative issues into action quickly.</p>
            </div>
            <Panel className="p-5">
              <Kicker>Recommended focus</Kicker>
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/18 dark:bg-amber-500/10">
                <AlertTriangleIcon className="text-amber-600 dark:text-amber-300" />
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-100">{needsAttentionRows.length} campaigns need attention</p>
                  <p className="mt-1 text-sm text-[color:var(--dusk-status-warning-fg)]/72 dark:text-amber-100/62">Review blocked delivery and limited pacing before making new trafficking changes.</p>
                </div>
              </div>
            </Panel>
          </header>

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
