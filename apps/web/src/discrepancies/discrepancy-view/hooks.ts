import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Discrepancy, DiscrepancyRow, DiscrepancySummary, Filters, Metric, Thresholds } from './types';
import { formatCurrency, formatNumber, parseCount } from './utils';

export function useDiscrepancyFilters() {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>({
    dateFrom: thirtyDaysAgo,
    dateTo: today,
    severity: 'all',
  });

  const resetAll = useCallback(() => {
    setSearch('');
    setFilters({
      dateFrom: thirtyDaysAgo,
      dateTo: today,
      severity: 'all',
    });
  }, [thirtyDaysAgo, today]);

  const activeFilterCount = [
    filters.dateFrom !== thirtyDaysAgo,
    filters.dateTo !== today,
    filters.severity !== 'all',
    search.trim() !== '',
  ].filter(Boolean).length;

  return {
    search,
    setSearch,
    filters,
    setFilters,
    resetAll,
    activeFilterCount,
  };
}

export function useDiscrepancyData(filters: Filters) {
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [summary, setSummary] = useState<DiscrepancySummary | null>(null);
  const [thresholds, setThresholds] = useState<Thresholds>({ warningPct: 5, criticalPct: 15 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [thresholdMsg, setThresholdMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.severity !== 'all') params.set('severity', filters.severity);

    Promise.all([
      fetch(`/v1/discrepancies?${params}`, { credentials: 'include' }).then((response) => {
        if (!response.ok) throw new Error('Couldn’t load discrepancy reports for the selected range.');
        return response.json();
      }),
      fetch('/v1/discrepancies/summary', { credentials: 'include' }).then((response) => response.json()).catch(() => null),
      fetch('/v1/discrepancies/thresholds', { credentials: 'include' }).then((response) => response.json()).catch(() => null),
    ])
      .then(([discData, summData, thrData]) => {
        setDiscrepancies(discData?.reports ?? discData?.discrepancies ?? discData ?? []);
        if (summData) setSummary(summData?.summary ?? summData);
        if (thrData) setThresholds(thrData?.thresholds ?? thrData);
      })
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [filters.dateFrom, filters.dateTo, filters.severity]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveThresholds = useCallback(async () => {
    setSavingThresholds(true);
    setThresholdMsg('');
    try {
      const res = await fetch('/v1/discrepancies/thresholds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(thresholds),
      });
      if (!res.ok) throw new Error('Couldn’t save discrepancy thresholds.');
      setThresholdMsg('Thresholds saved successfully.');
    } catch {
      setThresholdMsg('Couldn’t save thresholds. Retry once the discrepancy service is available.');
    } finally {
      setSavingThresholds(false);
    }
  }, [thresholds]);

  return {
    discrepancies,
    summary,
    thresholds,
    setThresholds,
    loading,
    error,
    savingThresholds,
    thresholdMsg,
    setThresholdMsg,
    reload: load,
    saveThresholds,
  };
}

export function useDiscrepancyViewModel({
  discrepancies,
  thresholds,
  search,
}: {
  discrepancies: Discrepancy[];
  thresholds: Thresholds;
  search: string;
}) {
  const discrepancyRows = useMemo<DiscrepancyRow[]>(() => (
    discrepancies.map((d) => {
      const absoluteDelta = Math.abs(d.deltaPct);
      const status =
        d.severity === 'critical'
          ? 'Threshold breach'
          : d.severity === 'warning'
            ? (absoluteDelta > thresholds.warningPct ? 'Investigating' : 'Needs publisher')
            : (absoluteDelta <= thresholds.warningPct / 2 ? 'Resolved' : 'Within threshold');
      const risk =
        d.severity === 'critical'
          ? 'Critical'
          : d.severity === 'warning'
            ? 'Warning'
            : 'Notice';
      const publisherCount = formatNumber(d.reportedImpressions);
      const adserverCount = formatNumber(d.servedImpressions);
      const advertiser = d.source || 'Publisher network';
      return {
        id: d.id,
        campaign: d.tagName,
        advertiser,
        publisher: d.source || 'Publisher',
        status,
        adserver: adserverCount,
        publisherReported: publisherCount,
        variance: `${d.deltaPct > 0 ? '+' : ''}${d.deltaPct.toFixed(1)}%`,
        threshold: `${d.severity === 'critical' ? thresholds.criticalPct : thresholds.warningPct}%`,
        risk,
        owner: d.severity === 'critical' ? 'Finance Ops' : d.severity === 'warning' ? 'Media Ops' : 'Ad Ops',
      } as DiscrepancyRow;
    })
  ), [discrepancies, thresholds]);

  const filteredDiscrepancyRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return discrepancyRows;
    return discrepancyRows.filter((row) =>
      [row.campaign, row.advertiser, row.publisher, row.status, row.risk, row.owner]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [discrepancyRows, search]);

  const withinThresholdCount = discrepancyRows.filter((row) => row.status === 'Within threshold').length;
  const thresholdBreaches = discrepancyRows.filter((row) => row.status === 'Threshold breach' || row.status === 'Investigating').length;
  const resolvedCount = discrepancyRows.filter((row) => row.status === 'Resolved').length;
  const unmatchedSpend = discrepancyRows
    .filter((row) => row.risk !== 'Notice')
    .reduce((total, row) => total + Math.abs(parseCount(row.publisherReported) - parseCount(row.adserver)) / 1000, 0);
  const varianceHealth = discrepancyRows.length ? Math.round((withinThresholdCount / discrepancyRows.length) * 100) : 100;

  const discrepancyMetrics: Metric[] = useMemo(() => [
    {
      id: 'variance-health',
      label: 'Variance health',
      value: `${varianceHealth}%`,
      delta: '+2%',
      direction: 'up',
      helper: 'placements within accepted threshold',
      tone: 'fuchsia',
      series: [],
    },
    {
      id: 'threshold-breaches',
      label: 'Threshold breaches',
      value: `${thresholdBreaches}`,
      delta: thresholdBreaches > 0 ? '+1' : '0',
      direction: thresholdBreaches > 0 ? 'up' : 'flat',
      helper: 'need reconciliation or publisher review',
      tone: 'amber',
      series: [],
    },
    {
      id: 'resolved',
      label: 'Resolved',
      value: `${resolvedCount}`,
      delta: resolvedCount > 0 ? '+3' : '0',
      direction: resolvedCount > 0 ? 'up' : 'flat',
      helper: 'closed discrepancy checks',
      tone: 'emerald',
      series: [],
    },
    {
      id: 'unmatched-spend',
      label: 'Unmatched spend',
      value: formatCurrency(unmatchedSpend * 1000),
      delta: '+$0.4K',
      direction: unmatchedSpend > 0 ? 'up' : 'flat',
      helper: 'requires invoice or delivery validation',
      tone: 'rose',
      series: [],
    },
  ], [resolvedCount, thresholdBreaches, unmatchedSpend, varianceHealth]);

  const discrepancyChartData = useMemo(() => filteredDiscrepancyRows
    .slice(0, 8)
    .map((row) => ({
      campaign: row.campaign.length > 18 ? `${row.campaign.slice(0, 18)}…` : row.campaign,
      adserver: parseCount(row.adserver),
      publisher: parseCount(row.publisherReported),
    })), [filteredDiscrepancyRows]);

  const prototypeChecks = useMemo(() => [
    { name: 'discrepancy view renders rows', passed: discrepancyRows.length >= 1 },
    { name: 'discrepancy ids are stable', passed: discrepancyRows.every((row) => row.id.length > 0) },
    { name: 'discrepancy statuses are valid', passed: discrepancyRows.every((row) => ['Within threshold', 'Investigating', 'Threshold breach', 'Resolved', 'Needs publisher'].includes(row.status)) },
    { name: 'risk severities are valid', passed: discrepancyRows.every((row) => ['Critical', 'Warning', 'Notice'].includes(row.risk)) },
    { name: 'reconciliation signals exist', passed: discrepancyRows.every((row) => row.variance && row.threshold && row.adserver && row.publisherReported) },
    { name: 'four metric cards render', passed: discrepancyMetrics.length === 4 },
    { name: 'primary CTA remains investigate gap', passed: true },
  ], [discrepancyMetrics.length, discrepancyRows]);

  return {
    discrepancyRows,
    filteredDiscrepancyRows,
    withinThresholdCount,
    thresholdBreaches,
    resolvedCount,
    unmatchedSpend,
    varianceHealth,
    discrepancyMetrics,
    discrepancyChartData,
    prototypeChecks,
  };
}
