import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadAuthMe, loadWorkspaces } from '../../shared/workspaces';
import { deriveSpendMetrics, resolveSpendViewValue, type CostMetadata } from '../../shared/costing';
import type { Campaign, CampaignRow, CampaignSpendView, CampaignStatus } from './types';
import { formatCompactMoney, formatDateRange, toNumber } from './utils';

function getCampaignBudgetBaseValue(campaign: Campaign) {
  const lifetimeBudget = toNumber(campaign.budget);
  if (lifetimeBudget > 0) return lifetimeBudget;
  const dailyBudget = toNumber(campaign.dailyBudget);
  if (dailyBudget <= 0) return 0;
  const startDate = campaign.startDate ?? campaign.start_date;
  const endDate = campaign.endDate ?? campaign.end_date;
  if (startDate && endDate) {
    const durationMs = new Date(endDate).getTime() - new Date(startDate).getTime();
    const durationDays = Math.max(Math.floor(durationMs / 86400000) + 1, 1);
    return dailyBudget * durationDays;
  }
  return dailyBudget * 30;
}

function getCampaignCostMetadata(campaign: Campaign): CostMetadata {
  return campaign.metadata ?? {};
}

function getCampaignBudgetValue(campaign: Campaign, spendView: CampaignSpendView) {
  const budget = getCampaignBudgetBaseValue(campaign);
  if (budget <= 0) return 0;
  const markupPercent = spendView === 'with_margin'
    ? Math.max(toNumber(campaign.metadata?.markupPercent), 0)
    : 0;
  return budget * (1 + (markupPercent / 100));
}

function getCampaignSpendValue(campaign: Campaign, spendView: CampaignSpendView) {
  const budget = getCampaignBudgetBaseValue(campaign);
  const spend = deriveSpendMetrics({
    impressions: campaign.impressions,
    metadata: getCampaignCostMetadata(campaign),
    fallbackBudget: budget,
    impressionGoal: campaign.impressionGoal ?? campaign.impression_goal,
  });
  return resolveSpendViewValue(spend, spendView);
}

export function useCampaignFilters(initialSearch = '') {
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'limited' | 'blocked' | 'ready' | 'draft'>('all');
  const [spendView, setSpendView] = useState<CampaignSpendView>('without_margin');

  const resetAll = useCallback(() => {
    setSelectedClientIds([]);
    setStatusFilter('all');
    setSearch('');
    setSpendView('without_margin');
  }, []);

  const activeFilterCount = [selectedClientIds[0], statusFilter !== 'all', search.trim(), spendView !== 'without_margin'].filter(Boolean).length;

  return {
    selectedClientIds,
    setSelectedClientIds,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    spendView,
    setSpendView,
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
  const spendView = filters.spendView;
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
    const spendValue = getCampaignSpendValue(campaign, spendView);
    const budgetValue = getCampaignBudgetValue(campaign, spendView);
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
      spend: formatCompactMoney(spendValue),
      spendValue,
      budget: formatCompactMoney(budgetValue),
      budgetValue,
      tagHealth: impressions > 0 ? 'Healthy' : campaign.status === 'draft' ? 'Not generated' : 'Low firing',
      creativeStatus: hoverMs > 0 ? 'Approved' : campaign.status === 'draft' ? 'Not uploaded' : 'Pending QA',
      issues,
      owner: campaign.metadata?.dsp ?? 'Ad Ops',
      flight: formatDateRange(campaign.startDate ?? campaign.start_date, campaign.endDate ?? campaign.end_date),
      raw: campaign,
    };
  }), [filteredCampaigns, spendView]);

  const liveCampaigns = campaignRows.filter((row) => row.status === 'Live').length;
  const blockedOrLimited = campaignRows.filter((row) => row.status === 'Blocked' || row.status === 'Limited').length;
  const draftSetup = campaignRows.filter((row) => row.status === 'Draft' || row.status === 'Ready').length;
  const openIssues = campaignRows.reduce((sum, row) => sum + row.issues, 0);
  const trackedSpend = campaignRows.reduce((sum, row) => sum + row.spendValue, 0);
  const needsAttentionRows = campaignRows.filter((row) => row.status === 'Blocked' || row.status === 'Limited').slice(0, 3);

  return {
    filteredCampaigns,
    campaignRows,
    liveCampaigns,
    blockedOrLimited,
    draftSetup,
    openIssues,
    trackedSpend,
    needsAttentionRows,
  };
}
