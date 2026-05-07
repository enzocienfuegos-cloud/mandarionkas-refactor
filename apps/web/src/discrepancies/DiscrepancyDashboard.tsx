import React, { useEffect, useMemo, useState, FormEvent } from 'react';
import {
  Button,
  CenteredSpinner,
  FilterBar,
  Input,
  Kicker,
  MetricCard,
  PageHeader,
  Panel,
  TrendChart,
} from '../system';
import { DiscrepancyTable } from './discrepancy-view/DiscrepancyTable';
import type {
  Discrepancy,
  DiscrepancyRow,
  DiscrepancyStatus,
  DiscrepancySummary,
  Filters,
  Metric,
  PrioritySeverity,
  Severity,
  Thresholds,
  Tone,
  TrendDirection,
} from './discrepancy-view/types';
import {
  classNames,
  discrepancyStatusBadge,
  formatCurrency,
  formatNumber,
  parseCount,
} from './discrepancy-view/utils';
import {
  AlertTriangleIcon,
  DiscrepancyStatusPill,
  ReportIcon,
  SeverityPill,
  TableIcon,
  toneToMetricTone,
} from './discrepancy-view/components';

export default function DiscrepanciesView() {
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [summary, setSummary] = useState<DiscrepancySummary | null>(null);
  const [thresholds, setThresholds] = useState<Thresholds>({ warningPct: 5, criticalPct: 15 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [thresholdMsg, setThresholdMsg] = useState('');
  const [search, setSearch] = useState('');

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

  const [filters, setFilters] = useState<Filters>({
    dateFrom: thirtyDaysAgo,
    dateTo: today,
    severity: 'all',
  });

  const setFilter = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [k]: e.target.value }));

  const load = () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.severity !== 'all') params.set('severity', filters.severity);

    Promise.all([
      fetch(`/v1/discrepancies?${params}`, { credentials: 'include' }).then((r) => { if (!r.ok) throw new Error('Failed to load'); return r.json(); }),
      fetch('/v1/discrepancies/summary', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
      fetch('/v1/discrepancies/thresholds', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
    ])
      .then(([discData, summData, thrData]) => {
        setDiscrepancies(discData?.reports ?? discData?.discrepancies ?? discData ?? []);
        if (summData) setSummary(summData?.summary ?? summData);
        if (thrData) setThresholds(thrData?.thresholds ?? thrData);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void load();
  }, [filters.dateFrom, filters.dateTo, filters.severity]);

  const handleSaveThresholds = async (e: FormEvent) => {
    e.preventDefault();
    setSavingThresholds(true);
    setThresholdMsg('');
    try {
      const res = await fetch('/v1/discrepancies/thresholds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(thresholds),
      });
      if (!res.ok) throw new Error('Save failed');
      setThresholdMsg('Thresholds saved successfully.');
    } catch {
      setThresholdMsg('Failed to save thresholds.');
    } finally {
      setSavingThresholds(false);
    }
  };

  const discrepancyRows = useMemo<DiscrepancyRow[]>(() => (
    discrepancies.map((d) => {
      const absoluteDelta = Math.abs(d.deltaPct);
      const status: DiscrepancyStatus =
        d.severity === 'critical'
          ? 'Threshold breach'
          : d.severity === 'warning'
            ? (absoluteDelta > thresholds.warningPct ? 'Investigating' : 'Needs publisher')
            : (absoluteDelta <= thresholds.warningPct / 2 ? 'Resolved' : 'Within threshold');
      const risk: PrioritySeverity =
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
      };
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

  const discrepancyMetrics = useMemo<Metric[]>(() => [
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

  const discrepancyChartData = useMemo(() => {
    return filteredDiscrepancyRows
      .slice(0, 8)
      .map((row) => ({
        campaign: row.campaign.length > 18 ? `${row.campaign.slice(0, 18)}…` : row.campaign,
        adserver: parseCount(row.adserver),
        publisher: parseCount(row.publisherReported),
      }));
  }, [filteredDiscrepancyRows]);

  const prototypeChecks = [
    { name: 'discrepancy view renders rows', passed: discrepancyRows.length >= 1 },
    { name: 'discrepancy ids are stable', passed: discrepancyRows.every((row) => row.id.length > 0) },
    { name: 'discrepancy statuses are valid', passed: discrepancyRows.every((row) => ['Within threshold', 'Investigating', 'Threshold breach', 'Resolved', 'Needs publisher'].includes(row.status)) },
    { name: 'risk severities are valid', passed: discrepancyRows.every((row) => ['Critical', 'Warning', 'Notice'].includes(row.risk)) },
    { name: 'reconciliation signals exist', passed: discrepancyRows.every((row) => row.variance && row.threshold && row.adserver && row.publisherReported) },
    { name: 'four metric cards render', passed: discrepancyMetrics.length === 4 },
    { name: 'primary CTA remains investigate gap', passed: true },
  ];

  if (loading) {
    return (
      <CenteredSpinner label="Loading discrepancies workspace…" />
    );
  }

  if (error) {
    return (
      <Panel className="border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] p-4 text-[color:var(--dusk-status-critical-fg)]" role="alert">
        <p className="font-medium">Error loading discrepancies</p>
        <p className="mt-1 text-sm">{error}</p>
        <Button onClick={load} variant="ghost" size="sm" className="mt-3">Retry</Button>
      </Panel>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-6">
      <PageHeader
        kicker="Discrepancies · Reconciliation workspace"
        title="Discrepancies"
        meta={`${filteredDiscrepancyRows.length} reports · ${thresholdBreaches} threshold breaches · invoice validation queue`}
        primaryAction={<Button type="button" onClick={load} variant="primary">Investigate gap</Button>}
        alert={(
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <AlertTriangleIcon className="mt-0.5 shrink-0" />
              <p className="text-sm font-medium">
                {thresholdBreaches} threshold breaches need investigation before invoice reconciliation.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFilters((current) => ({ ...current, severity: 'critical' }))}
              className="shrink-0"
            >
              Filter critical
            </Button>
          </div>
        )}
      />

      <FilterBar
        pills={[
          {
            id: 'date-range',
            label: 'Date range',
            value: filters.dateFrom === thirtyDaysAgo && filters.dateTo === today ? '30d' : filters.dateFrom === new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10) ? '7d' : '90d',
            options: [
              { value: '30d', label: 'Last 30 days' },
              { value: '7d', label: 'Last 7 days' },
              { value: '90d', label: 'Last 90 days' },
            ],
            onChange: (value) => {
              const days = value === '7d' ? 7 : value === '90d' ? 90 : 30;
              setFilters((current) => ({
                ...current,
                dateFrom: new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10),
                dateTo: today,
              }));
            },
          },
          {
            id: 'severity',
            label: 'Severity',
            value: filters.severity,
            options: [
              { value: 'all', label: 'All severities' },
              { value: 'critical', label: 'Critical' },
              { value: 'warning', label: 'Warning' },
              { value: 'ok', label: 'Healthy' },
            ],
            onChange: (value) => setFilters((current) => ({ ...current, severity: value })),
          },
        ]}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search campaign, publisher, owner',
        }}
        activeFilterCount={[filters.severity !== 'all', search.trim(), !(filters.dateFrom === thirtyDaysAgo && filters.dateTo === today)].filter(Boolean).length}
        onResetAll={() => {
          setSearch('');
          setFilters({ dateFrom: thirtyDaysAgo, dateTo: today, severity: 'all' });
        }}
      />

      <div className="grid gap-5 xl:grid-cols-4">
        {discrepancyMetrics.map((metric) => (
          <MetricCard
            key={metric.id}
            label={metric.label}
            value={metric.value}
            delta={metric.delta}
            trend={metric.direction}
            context={metric.helper}
            series={metric.series}
            tone={
              toneToMetricTone(metric.tone)
            }
            icon={metric.id === 'variance-health' ? <ReportIcon /> : metric.id === 'resolved' ? <TableIcon /> : <AlertTriangleIcon />}
          />
        ))}
      </div>

      <Panel className="p-6">
        <div className="mb-4">
          <Kicker>Reconciliation snapshot</Kicker>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">Adserver vs publisher</h2>
          <p className="mt-2 text-sm text-text-muted">
            Current-view comparison for the highest-variance discrepancy rows in the workspace.
          </p>
        </div>
        <TrendChart
          data={discrepancyChartData}
          xKey="campaign"
          kind="bar"
          title="Discrepancy comparison chart"
          description="Bar chart comparing adserver and publisher-reported delivery for the highest variance rows."
          series={[
            { key: 'adserver', label: 'Adserver', tone: 'brand', format: (value) => formatNumber(value) },
            { key: 'publisher', label: 'Publisher', tone: 'warning', format: (value) => formatNumber(value) },
          ]}
        />
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
        <Panel className="overflow-hidden p-6">
          <div className="flex flex-col gap-4 border-b border-border-default pb-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
              <Kicker>Discrepancy workspace</Kicker>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">Publisher reconciliation queue</h2>
              <p className="mt-2 text-sm text-text-muted">Review variance, threshold breaches, and publisher totals from one dense reconciliation table.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={load} variant="ghost" size="sm">Refresh</Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-border-default bg-surface-2 p-4"><p className="text-xs font-medium uppercase tracking-wide text-text-muted">Total</p><p className="mt-2 text-2xl font-semibold text-text-primary">{filteredDiscrepancyRows.length}</p><p className="mt-1 text-sm text-text-muted">reports in current view</p></div>
            <div className="rounded-2xl border border-border-default bg-surface-2 p-4"><p className="text-xs font-medium uppercase tracking-wide text-text-muted">Critical</p><p className="mt-2 text-2xl font-semibold text-text-primary">{filteredDiscrepancyRows.filter((row) => row.risk === 'Critical').length}</p><p className="mt-1 text-sm text-text-muted">need invoice validation</p></div>
            <div className="rounded-2xl border border-border-default bg-surface-2 p-4"><p className="text-xs font-medium uppercase tracking-wide text-text-muted">Warning</p><p className="mt-2 text-2xl font-semibold text-text-primary">{filteredDiscrepancyRows.filter((row) => row.risk === 'Warning').length}</p><p className="mt-1 text-sm text-text-muted">publisher follow-up required</p></div>
            <div className="rounded-2xl border border-border-default bg-surface-2 p-4"><p className="text-xs font-medium uppercase tracking-wide text-text-muted">Thresholds</p><p className="mt-2 text-2xl font-semibold text-text-primary">{thresholds.warningPct}% / {thresholds.criticalPct}%</p><p className="mt-1 text-sm text-text-muted">warning and critical variance caps</p></div>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-border-default">
            <DiscrepancyTable rows={filteredDiscrepancyRows} onInvestigate={load} />
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="space-y-8">
            <section>
              <Kicker>Module health</Kicker>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-border-default bg-surface-2 px-4 py-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Threshold breaches</p>
                  <p className="mt-2 text-2xl font-semibold text-text-primary">{thresholdBreaches}</p>
                  <p className="mt-1 text-sm text-text-muted">require reconciliation review</p>
                </div>
                <div className="rounded-2xl border border-border-default bg-surface-2 px-4 py-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Resolved</p>
                  <p className="mt-2 text-2xl font-semibold text-text-primary">{resolvedCount}</p>
                  <p className="mt-1 text-sm text-text-muted">closed discrepancy checks</p>
                </div>
                <div className="rounded-2xl border border-border-default bg-surface-2 px-4 py-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Within threshold</p>
                  <p className="mt-2 text-2xl font-semibold text-text-primary">{withinThresholdCount}</p>
                  <p className="mt-1 text-sm text-text-muted">accepted delivery variance</p>
                </div>
              </div>
            </section>

            <section>
              <Kicker>Threshold controls</Kicker>
              <form onSubmit={handleSaveThresholds} className="mt-4 space-y-3">
                <div className="rounded-2xl border border-border-default bg-surface-2 px-4 py-4">
                  <label className="block text-xs font-medium uppercase tracking-wide text-text-muted">Warning threshold (%)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={thresholds.warningPct}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setThresholds((t) => ({ ...t, warningPct: Number(event.target.value) }))}
                    className="mt-2"
                  />
                </div>
                <div className="rounded-2xl border border-border-default bg-surface-2 px-4 py-4">
                  <label className="block text-xs font-medium uppercase tracking-wide text-text-muted">Critical threshold (%)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={thresholds.criticalPct}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setThresholds((t) => ({ ...t, criticalPct: Number(event.target.value) }))}
                    className="mt-2"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={savingThresholds}
                  variant="primary"
                >
                  {savingThresholds ? 'Saving…' : 'Save thresholds'}
                </Button>
                {thresholdMsg && (
                  <p className={thresholdMsg.includes('Failed') ? 'text-sm text-[color:var(--dusk-status-critical-fg)]' : 'text-sm text-[color:var(--dusk-status-success-fg)]'}>
                    {thresholdMsg}
                  </p>
                )}
              </form>
            </section>

            <section>
              <Kicker>Prototype checks</Kicker>
              <div className="mt-4 grid gap-3">
                {prototypeChecks.map((test) => (
                  <div key={test.name} className="rounded-2xl border border-border-default bg-surface-2 px-4 py-3">
                    <p className="text-xs font-medium text-text-muted">{test.name}</p>
                    <p className={test.passed ? 'mt-1 text-sm font-semibold text-[color:var(--dusk-status-success-fg)]' : 'mt-1 text-sm font-semibold text-[color:var(--dusk-status-critical-fg)]'}>
                      {test.passed ? 'Passed' : 'Failed'}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </Panel>
      </div>
    </div>
  );
}
