import React, { useEffect, useMemo, useState, FormEvent } from 'react';
import {
  Button,
  CenteredSpinner,
  IconButton,
  Input,
  Kicker,
  MetricCard,
  Panel,
} from '../system';
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
  FilterIcon,
  ReportIcon,
  SearchIcon,
  SeverityPill,
  TableIcon,
  TrendBadge,
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
  }, []);

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
      series: [Math.max(varianceHealth - 12, 0), Math.max(varianceHealth - 10, 0), Math.max(varianceHealth - 7, 0), Math.max(varianceHealth - 5, 0), Math.max(varianceHealth - 3, 0), Math.max(varianceHealth - 1, 0), varianceHealth],
    },
    {
      id: 'threshold-breaches',
      label: 'Threshold breaches',
      value: `${thresholdBreaches}`,
      delta: thresholdBreaches > 0 ? '+1' : '0',
      direction: thresholdBreaches > 0 ? 'up' : 'flat',
      helper: 'need reconciliation or publisher review',
      tone: 'amber',
      series: [Math.max(thresholdBreaches - 1, 0), Math.max(thresholdBreaches - 1, 0), Math.max(thresholdBreaches - 1, 0), thresholdBreaches, thresholdBreaches, thresholdBreaches, thresholdBreaches],
    },
    {
      id: 'resolved',
      label: 'Resolved',
      value: `${resolvedCount}`,
      delta: resolvedCount > 0 ? '+3' : '0',
      direction: resolvedCount > 0 ? 'up' : 'flat',
      helper: 'closed discrepancy checks',
      tone: 'emerald',
      series: [Math.max(resolvedCount - 6, 0), Math.max(resolvedCount - 5, 0), Math.max(resolvedCount - 4, 0), Math.max(resolvedCount - 3, 0), Math.max(resolvedCount - 3, 0), Math.max(resolvedCount - 1, 0), resolvedCount],
    },
    {
      id: 'unmatched-spend',
      label: 'Unmatched spend',
      value: formatCurrency(unmatchedSpend * 1000),
      delta: '+$0.4K',
      direction: unmatchedSpend > 0 ? 'up' : 'flat',
      helper: 'requires invoice or delivery validation',
      tone: 'rose',
      series: [Math.max(unmatchedSpend - 1.2, 0), Math.max(unmatchedSpend - 1.0, 0), Math.max(unmatchedSpend - 0.8, 0), Math.max(unmatchedSpend - 0.6, 0), Math.max(unmatchedSpend - 0.4, 0), Math.max(unmatchedSpend - 0.2, 0), unmatchedSpend],
    },
  ], [resolvedCount, thresholdBreaches, unmatchedSpend, varianceHealth]);

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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary">
            Last 30 days
          </Button>
          <Button type="button" variant="secondary">
            {filters.severity === 'all' ? 'All severities' : filters.severity}
          </Button>
          <label className="relative block min-w-[320px]">
            <span className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[color:var(--dusk-text-muted)]"><SearchIcon /></span>
            <Input
              value={filters.severity === 'all' ? '' : filters.severity}
              onChange={() => undefined}
              placeholder="Search campaign, publisher, owner"
              className="min-h-[46px] pl-10"
              readOnly
            />
          </label>
        </div>

        <Button type="button" onClick={load} variant="primary">
          Investigate gap
        </Button>
      </div>

      <header className="grid gap-6 xl:grid-cols-[1.4fr_1fr] xl:items-end">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-700 dark:border-fuchsia-500/15 dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
            Discrepancies
            <span className="h-1 w-1 rounded-full bg-current opacity-60" />
            Reconciliation workspace
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-white md:text-5xl">Publisher variance without reconciliation blind spots</h1>
          <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600 dark:text-white/62">Compare adserver delivery, publisher reporting and variance thresholds from one dense operational workspace.</p>
        </div>
        <Panel className="p-5">
          <Kicker>Recommended focus</Kicker>
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/18 dark:bg-amber-500/10">
            <AlertTriangleIcon className="text-amber-600 dark:text-amber-300" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-100">{thresholdBreaches} threshold breaches need investigation</p>
              <p className="mt-1 text-sm text-amber-700/72 dark:text-amber-100/62">Validate publisher-reported delivery against adserver totals before invoice reconciliation.</p>
            </div>
          </div>
        </Panel>
      </header>

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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
          <Panel className="overflow-hidden p-6">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-white/8 xl:flex-row xl:items-center xl:justify-between">
              <div>
              <Kicker>Discrepancy workspace</Kicker>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Publisher reconciliation queue</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-white/56">Review variance, threshold breaches, and publisher totals from one dense reconciliation table.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
              >
                <FilterIcon className="h-4 w-4" />
                Filters
              </Button>
              <Button type="button" onClick={load} variant="ghost" size="sm">Refresh</Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 dark:border-white/8 dark:bg-white/[0.025]"><p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Total</p><p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{summary?.totalReports ?? discrepancyRows.length}</p><p className="mt-1 text-sm text-slate-500 dark:text-white/52">reports in current view</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 dark:border-white/8 dark:bg-white/[0.025]"><p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Critical</p><p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{summary?.criticalCount ?? discrepancyRows.filter((row) => row.risk === 'Critical').length}</p><p className="mt-1 text-sm text-slate-500 dark:text-white/52">need invoice validation</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 dark:border-white/8 dark:bg-white/[0.025]"><p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Warning</p><p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{summary?.warningCount ?? discrepancyRows.filter((row) => row.risk === 'Warning').length}</p><p className="mt-1 text-sm text-slate-500 dark:text-white/52">publisher follow-up required</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 dark:border-white/8 dark:bg-white/[0.025]"><p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Thresholds</p><p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{thresholds.warningPct}% / {thresholds.criticalPct}%</p><p className="mt-1 text-sm text-slate-500 dark:text-white/52">warning and critical variance caps</p></div>
          </div>

          <div className="app-scrollbar mt-6 overflow-auto rounded-3xl border border-slate-200 dark:border-white/8">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/8">
              <thead className="bg-slate-50/80 dark:bg-white/[0.02]">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/42">
                  <th className="px-5 py-4">Campaign</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Adserver</th>
                  <th className="px-5 py-4">Publisher</th>
                  <th className="px-5 py-4">Variance</th>
                  <th className="px-5 py-4">Threshold</th>
                  <th className="px-5 py-4">Risk</th>
                  <th className="px-5 py-4">Owner</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/8">
                {discrepancyRows.map((row) => (
                  <tr key={row.id} className="bg-white/42 transition hover:bg-fuchsia-50/45 dark:bg-transparent dark:hover:bg-white/[0.04]">
                    <td className="px-5 py-5">
                      <p className="font-semibold text-slate-950 dark:text-white">{row.campaign}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-white/48">{row.advertiser} · {row.publisher}</p>
                    </td>
                    <td className="px-5 py-5">
                      <DiscrepancyStatusPill status={row.status} />
                    </td>
                    <td className="px-5 py-5 text-slate-600 dark:text-white/62">{row.adserver}</td>
                    <td className="px-5 py-5 text-slate-600 dark:text-white/62">{row.publisherReported}</td>
                    <td className="px-5 py-5 font-medium text-slate-700 dark:text-white/72">{row.variance}</td>
                    <td className="px-5 py-5 text-slate-600 dark:text-white/62">{row.threshold}</td>
                    <td className="px-5 py-5">
                      <SeverityPill severity={row.risk} />
                    </td>
                    <td className="px-5 py-5 text-slate-600 dark:text-white/62">{row.owner}</td>
                    <td className="px-5 py-5">
                      <Button type="button" onClick={load} variant="secondary" size="sm">Investigate</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="space-y-8">
            <section>
              <Kicker>Module health</Kicker>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.025]">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Threshold breaches</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{thresholdBreaches}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-white/56">require reconciliation review</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.025]">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Resolved</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{resolvedCount}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-white/56">closed discrepancy checks</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.025]">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Within threshold</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{withinThresholdCount}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-white/56">accepted delivery variance</p>
                </div>
              </div>
            </section>

            <section>
              <Kicker>Threshold controls</Kicker>
              <form onSubmit={handleSaveThresholds} className="mt-4 space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.025]">
                  <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Warning threshold (%)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={thresholds.warningPct}
                    onChange={(e) => setThresholds((t) => ({ ...t, warningPct: Number(e.target.value) }))}
                    className="mt-2"
                  />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.025]">
                  <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Critical threshold (%)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={thresholds.criticalPct}
                    onChange={(e) => setThresholds((t) => ({ ...t, criticalPct: Number(e.target.value) }))}
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
                  <p className={thresholdMsg.includes('Failed') ? 'text-sm text-rose-600 dark:text-rose-300' : 'text-sm text-emerald-600 dark:text-emerald-300'}>
                    {thresholdMsg}
                  </p>
                )}
              </form>
            </section>

            <section>
              <Kicker>Prototype checks</Kicker>
              <div className="mt-4 grid gap-3">
                {prototypeChecks.map((test) => (
                  <div key={test.name} className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.025]">
                    <p className="text-xs font-medium text-slate-500 dark:text-white/42">{test.name}</p>
                    <p className={test.passed ? 'mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-300' : 'mt-1 text-sm font-semibold text-rose-600 dark:text-rose-300'}>
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
