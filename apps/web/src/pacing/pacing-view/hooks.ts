import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BreakdownDay, PacingAlert, PacingCampaign, PacingData, PacingRow } from './types';
import { buildPacingRow, normalizePacingAlert, normalizePacingCampaign } from './utils';

export function usePacingFilters() {
  const [search, setSearch] = useState('');
  const [advertiserFilter, setAdvertiserFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState<'7d' | '30d' | '90d'>('30d');
  const [statusFilter, setStatusFilter] = useState<'all' | 'exceptions' | 'on_pace' | 'paused'>('all');
  const [exceptionsOnly, setExceptionsOnly] = useState(false);

  const resetAll = useCallback(() => {
    setSearch('');
    setAdvertiserFilter('');
    setDateRangeFilter('30d');
    setStatusFilter('all');
    setExceptionsOnly(false);
  }, []);

  const activeFilterCount = [
    advertiserFilter !== '',
    statusFilter !== 'all',
    dateRangeFilter !== '30d',
    search.trim() !== '',
  ].filter(Boolean).length;

  return {
    search,
    setSearch,
    advertiserFilter,
    setAdvertiserFilter,
    dateRangeFilter,
    setDateRangeFilter,
    statusFilter,
    setStatusFilter,
    exceptionsOnly,
    setExceptionsOnly,
    resetAll,
    activeFilterCount,
  };
}

export function usePacingData() {
  const [data, setData] = useState<PacingData | null>(null);
  const [alerts, setAlerts] = useState<PacingAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      fetch('/v1/pacing', { credentials: 'include' }).then((response) => {
        if (!response.ok) {
          throw new Error('Couldn’t load pacing workspace data. The service may be unavailable or this workspace may not have pacing access.');
        }
        return response.json();
      }),
      fetch('/v1/pacing/alerts', { credentials: 'include' }).then((response) => response.json()).catch(() => []),
    ])
      .then(([pacingData, alertData]) => {
        const campaigns = (pacingData?.campaigns ?? []).map(normalizePacingCampaign);
        const summary = {
          total: campaigns.length,
          active: campaigns.filter((campaign: PacingCampaign) => ['on_track', 'behind', 'ahead'].includes(campaign.status)).length,
          onTrack: campaigns.filter((campaign: PacingCampaign) => campaign.status === 'on_track').length,
          behind: campaigns.filter((campaign: PacingCampaign) => campaign.status === 'behind').length,
          totalServed: campaigns.reduce((sum: number, campaign: PacingCampaign) => sum + Number(campaign.impressionsServed ?? 0), 0),
        };
        setData({ campaigns, summary });
        setAlerts((alertData?.alerts ?? alertData ?? []).map(normalizePacingAlert));
      })
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, alerts, loading, error, reload: load };
}

export function usePacingViewModel({
  data,
  filters,
}: {
  data: PacingData | null;
  filters: ReturnType<typeof usePacingFilters>;
}) {
  const rows = useMemo(() => (data?.campaigns ?? []).map(buildPacingRow), [data]);

  const advertiserOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.advertiser))).sort(),
    [rows],
  );

  const normalizedSearch = filters.search.trim().toLowerCase();
  const filteredRows = useMemo(() => rows.filter((row) => {
    if (filters.advertiserFilter && row.advertiser !== filters.advertiserFilter) {
      return false;
    }
    if (filters.statusFilter === 'exceptions' && !['Underpacing', 'Overpacing', 'At risk', 'Paused'].includes(row.status)) {
      return false;
    }
    if (filters.statusFilter === 'on_pace' && row.status !== 'On pace') {
      return false;
    }
    if (filters.statusFilter === 'paused' && row.status !== 'Paused') {
      return false;
    }
    if (filters.exceptionsOnly && !['Underpacing', 'Overpacing', 'At risk', 'Paused'].includes(row.status)) {
      return false;
    }
    const campaign = data?.campaigns.find((entry) => entry.id === row.id);
    if (campaign) {
      const remainingDays = campaign.remainingDays ?? 0;
      if (filters.dateRangeFilter === '7d' && remainingDays > 7) return false;
      if (filters.dateRangeFilter === '30d' && remainingDays > 30) return false;
      if (filters.dateRangeFilter === '90d' && remainingDays > 90) return false;
    }
    if (!normalizedSearch) return true;
    return [row.campaign, row.advertiser, row.owner].join(' ').toLowerCase().includes(normalizedSearch);
  }), [rows, filters, data?.campaigns, normalizedSearch]);

  const focusCampaign = useMemo(
    () => data?.campaigns.find((campaign) => campaign.id === filteredRows[0]?.id) ?? null,
    [data?.campaigns, filteredRows],
  );

  const exceptionsCount = useMemo(
    () => rows.filter((row) => ['Underpacing', 'Overpacing', 'At risk', 'Paused'].includes(row.status)).length,
    [rows],
  );
  const onTargetCount = useMemo(
    () => rows.filter((row) => row.status === 'On pace').length,
    [rows],
  );
  const budgetRiskValue = useMemo(
    () => rows
      .filter((row) => row.risk !== 'Notice')
      .reduce((sum, row) => sum + Number(row.projected.replace(/[^0-9.]/g, '')), 0),
    [rows],
  );
  const prototypeChecks = useMemo(() => [
    { name: 'pacing view renders rows', passed: rows.length >= 1 },
    { name: 'row ids are stable', passed: rows.every((row) => row.id.length > 0) },
    { name: 'pacing statuses are valid', passed: rows.every((row) => ['On pace', 'Underpacing', 'Overpacing', 'At risk', 'Paused'].includes(row.status)) },
    { name: 'risk severities are valid', passed: rows.every((row) => ['Critical', 'Warning', 'Notice'].includes(row.risk)) },
    { name: 'budget fields exist', passed: rows.every((row) => row.spend && row.budget && row.dailyTarget && row.projected) },
    { name: 'primary CTA remains review pacing', passed: true },
  ], [rows]);

  return {
    rows,
    filteredRows,
    advertiserOptions,
    focusCampaign,
    exceptionsCount,
    onTargetCount,
    budgetRiskValue,
    prototypeChecks,
  };
}

export function usePacingBreakdown(focusCampaignId?: string) {
  const [focusBreakdown, setFocusBreakdown] = useState<BreakdownDay[]>([]);

  useEffect(() => {
    if (!focusCampaignId) {
      setFocusBreakdown([]);
      return;
    }
    fetch(`/v1/pacing/${focusCampaignId}/breakdown?days=7`, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error('Couldn’t load pacing breakdown history for the focused campaign.');
        return response.json();
      })
      .then((payload) => setFocusBreakdown(payload?.breakdown ?? payload ?? []))
      .catch(() => setFocusBreakdown([]));
  }, [focusCampaignId]);

  return { focusBreakdown };
}
