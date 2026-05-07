import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadAuthMe, loadWorkspaces } from '../../shared/workspaces';
import type { Campaign, CampaignRow, CampaignStatus, Metric } from './types';
import { computeDelta, formatCompactMoney, formatDateRange, toNumber } from './utils';

export function useCampaignFilters(initialSearch = '') {
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'limited' | 'blocked' | 'ready' | 'draft'>('all');

  const resetAll = useCallback(() => {
    setSelectedClientIds([]);
    setStatusFilter('all');
    setSearch('');
  }, []);

  const activeFilterCount = [selectedClientIds[0], statusFilter !== 'all', search.trim()].filter(Boolean).length;

  return {
    selectedClientIds,
    setSelectedClientIds,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    resetAll,
    activeFilterCount,
  };
}

export function useCampaignData() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      fetch('/v1/campaigns?scope=all', { credentials: 'include' }).then((response) => {
        if (!response.ok) throw new Error('Failed to load campaigns');
        return response.json();
      }),
      loadWorkspaces(),
      loadAuthMe(),
    ])
      .then(([campaignData, workspaceData, authMe]) => {
        setCampaigns(campaignData?.campaigns ?? campaignData ?? []);
        setClients(workspaceData ?? []);
        setActiveWorkspaceId(authMe.workspace?.id ?? '');
      })
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    campaigns,
    setCampaigns,
    clients,
    activeWorkspaceId,
    setActiveWorkspaceId,
    loading,
    error,
    reload: load,
  };
}

function deriveCampaignStatus(campaign: Campaign): CampaignStatus {
  const impressions = toNumber(campaign.impressions);
  const ctr = toNumber(campaign.ctr);
  const hoverMs = toNumber(campaign.totalHoverDurationMs ?? campaign.total_hover_duration_ms);
  if (campaign.status === 'draft' || campaign.status === 'archived') return 'Draft';
  if (campaign.status === 'paused') return impressions > 0 ? 'Limited' : 'Blocked';
  if (impressions === 0 && hoverMs === 0) return 'Ready';
  if (ctr < 0.35 || impressions < 100) return 'Limited';
  return 'Live';
}

export function useCampaignViewModel({
  campaigns,
  filters,
}: {
  campaigns: Campaign[];
  filters: ReturnType<typeof useCampaignFilters>;
}) {
  const filteredCampaigns = useMemo(() => campaigns.filter((campaign) => {
    const clientMatch = !filters.selectedClientIds.length || filters.selectedClientIds.includes(campaign.workspace_id ?? '');
    const needle = filters.search.trim().toLowerCase();
    const searchMatch = !needle
      || campaign.name.toLowerCase().includes(needle)
      || (campaign.workspace_name ?? '').toLowerCase().includes(needle)
      || (campaign.advertiser?.name ?? '').toLowerCase().includes(needle)
      || (campaign.metadata?.dsp ?? '').toLowerCase().includes(needle);
    if (!clientMatch || !searchMatch) return false;
    if (filters.statusFilter === 'all') return true;
    return deriveCampaignStatus(campaign).toLowerCase() === filters.statusFilter;
  }), [campaigns, filters]);

  const campaignRows = useMemo<CampaignRow[]>(() => filteredCampaigns.map((campaign) => {
    const impressions = toNumber(campaign.impressions);
    const hoverMs = toNumber(campaign.totalHoverDurationMs ?? campaign.total_hover_duration_ms);
    const status = deriveCampaignStatus(campaign);
    const ctr = toNumber(campaign.ctr);
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

  const liveCampaigns = campaignRows.filter((row) => row.status === 'Live').length;
  const blockedOrLimited = campaignRows.filter((row) => row.status === 'Blocked' || row.status === 'Limited').length;
  const draftSetup = campaignRows.filter((row) => row.status === 'Draft' || row.status === 'Ready').length;
  const openIssues = campaignRows.reduce((sum, row) => sum + row.issues, 0);
  const trackedSpend = campaignRows.reduce((sum, row) => sum + toNumber(row.raw.dailyBudget) * 7, 0);
  const previousTrackedSpend = trackedSpend * 0.92;
  const needsAttentionRows = campaignRows.filter((row) => row.status === 'Blocked' || row.status === 'Limited').slice(0, 3);

  const metrics: Metric[] = [
    { id: 'live', label: 'Live campaigns', value: String(liveCampaigns), delta: `+${Math.max(0, liveCampaigns - 1)}`, direction: 'up', helper: 'currently eligible to deliver', tone: 'fuchsia', series: [1, 1, 2, 2, liveCampaigns || 1, liveCampaigns || 1, liveCampaigns || 1] },
    { id: 'blocked', label: 'Blocked / limited', value: String(blockedOrLimited), delta: `+${Math.max(0, blockedOrLimited - 1)}`, direction: blockedOrLimited > 0 ? 'up' : 'flat', helper: 'need delivery review', tone: 'amber', series: [0, 1, 1, 1, blockedOrLimited || 1, blockedOrLimited || 1, blockedOrLimited || 1] },
    { id: 'spend', label: 'Spend tracked', value: formatCompactMoney(trackedSpend), delta: computeDelta(trackedSpend, previousTrackedSpend).label, direction: computeDelta(trackedSpend, previousTrackedSpend).direction, helper: 'against active campaign budgets', tone: 'emerald', series: [18, 22, 26, 31, 34, 37, 42].map((n) => n * Math.max(trackedSpend / 15300, 0.2)) },
    { id: 'issues', label: 'Open issues', value: String(openIssues), delta: `+${Math.max(0, openIssues - 7)}`, direction: openIssues > 0 ? 'up' : 'flat', helper: 'tags, creatives and pacing', tone: 'rose', series: [4, 5, 5, 7, 8, 9, Math.max(openIssues, 1)] },
  ];

  return {
    filteredCampaigns,
    campaignRows,
    liveCampaigns,
    blockedOrLimited,
    draftSetup,
    openIssues,
    trackedSpend,
    needsAttentionRows,
    metrics,
  };
}
