import React, { FormEvent } from 'react';
import { Button, CenteredSpinner, DonutChart, FilterBar, Heatmap, Input, Kicker, MetricCard, PageHeader, Panel, TrendChart } from '../system';
import { DiscrepancyTable } from './discrepancy-view/DiscrepancyTable';
import { formatNumber } from './discrepancy-view/utils';
import { AlertTriangleIcon, ReportIcon, TableIcon, toneToMetricTone } from './discrepancy-view/components';
import { useDiscrepancyData, useDiscrepancyFilters, useDiscrepancyViewModel } from './discrepancy-view/hooks';

export default function DiscrepanciesView() {
  const filtersState = useDiscrepancyFilters();
  const {
    discrepancies,
    summary,
    thresholds,
    setThresholds,
    loading,
    error,
    savingThresholds,
    thresholdMsg,
    reload: load,
    saveThresholds,
  } = useDiscrepancyData(filtersState.filters);
  const {
    discrepancyRows,
    filteredDiscrepancyRows: tableRows,
    withinThresholdCount: withinThreshold,
    thresholdBreaches: breaches,
    resolvedCount: resolved,
    discrepancyMetrics: metrics,
    discrepancyChartData,
    prototypeChecks: checks,
  } = useDiscrepancyViewModel({
    discrepancies,
    thresholds,
    search: filtersState.search,
    source: filtersState.filters.source,
  });

  const handleSaveThresholds = async (event: FormEvent) => {
    event.preventDefault();
    await saveThresholds();
  };

  const withinThresholdSummary = Math.max((summary?.totalReports ?? tableRows.length) - (summary?.criticalCount ?? 0) - (summary?.warningCount ?? 0), 0);
  const sourceTotals = discrepancies.reduce<Map<string, number>>((map, discrepancy) => {
    const key = discrepancy.source || 'Publisher';
    const nextValue = Math.max(map.get(key) ?? 0, Math.abs(discrepancy.deltaPct));
    map.set(key, nextValue);
    return map;
  }, new Map());
  const topSources = [...sourceTotals.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([source]) => source);
  const heatmapDates = [...new Set(discrepancies.map((item) => item.date))]
    .sort((left, right) => left.localeCompare(right))
    .slice(-7)
    .map((date) => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
  const heatmapCells = discrepancies
    .filter((item) => topSources.includes(item.source || 'Publisher'))
    .filter((item) => heatmapDates.includes(new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })))
    .map((item) => ({
      x: new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      y: item.source || 'Publisher',
      value: item.deltaPct,
    }));
  const sourceOptions = [...new Set(discrepancies.map((item) => item.source || 'Publisher'))].sort();

  if (loading) {
    return <CenteredSpinner label="Loading discrepancies workspace…" />;
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

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-6">
      <PageHeader
        kicker="Discrepancies · Reconciliation workspace"
        title="Discrepancies"
        meta={`${tableRows.length} reports · ${breaches} threshold breaches · invoice validation queue`}
        primaryAction={<Button type="button" onClick={load} variant="primary">Investigate gap</Button>}
        alert={(
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <AlertTriangleIcon className="mt-0.5 shrink-0" />
              <p className="text-sm font-medium">
                {breaches} threshold breaches need investigation before invoice reconciliation.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => filtersState.setFilters((current) => ({ ...current, severity: 'critical' }))}
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
            value: filtersState.filters.dateFrom === thirtyDaysAgo && filtersState.filters.dateTo === today
              ? '30d'
              : filtersState.filters.dateFrom === new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10)
                ? '7d'
                : '90d',
            options: [
              { value: '30d', label: 'Last 30 days' },
              { value: '7d', label: 'Last 7 days' },
              { value: '90d', label: 'Last 90 days' },
            ],
            onChange: (value) => {
              const days = value === '7d' ? 7 : value === '90d' ? 90 : 30;
              filtersState.setFilters((current) => ({
                ...current,
                dateFrom: new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10),
                dateTo: today,
              }));
            },
          },
          {
            id: 'severity',
            label: 'Severity',
            value: filtersState.filters.severity,
            options: [
              { value: 'all', label: 'All severities' },
              { value: 'critical', label: 'Critical' },
              { value: 'warning', label: 'Warning' },
              { value: 'ok', label: 'Healthy' },
            ],
            onChange: (value) => filtersState.setFilters((current) => ({ ...current, severity: value })),
          },
          ...(sourceOptions.length > 1 ? [{
            id: 'source',
            label: 'Source',
            value: filtersState.filters.source,
            options: [
              { value: 'all', label: 'All sources' },
              ...sourceOptions.map((source) => ({ value: source, label: source })),
            ],
            onChange: (value: string) => filtersState.setFilters((current) => ({ ...current, source: value })),
          }] : []),
        ]}
        search={{
          value: filtersState.search,
          onChange: filtersState.setSearch,
          placeholder: 'Search campaign, publisher, owner',
        }}
        activeFilterCount={filtersState.activeFilterCount}
        onResetAll={filtersState.resetAll}
      />

      <div className="grid gap-5 xl:grid-cols-4">
        {metrics.filter((metric) => metric.id !== 'threshold-breaches').map((metric) => (
          <MetricCard
            key={metric.id}
            label={metric.label}
            value={metric.value}
            delta={metric.delta}
            trend={metric.direction}
            context={metric.helper}
            series={metric.series}
            tone={toneToMetricTone(metric.tone)}
            icon={metric.id === 'variance-health' ? <ReportIcon /> : metric.id === 'resolved' ? <TableIcon /> : <AlertTriangleIcon />}
          />
        ))}
        <Panel padding="sm" className="flex items-center justify-center">
          <DonutChart
            size={140}
            showLegend={false}
            title="Discrepancy severity mix"
            description="Distribution of discrepancy reports across critical, warning, and within-threshold groups."
            segments={[
              { id: 'critical', label: 'Critical', value: summary?.criticalCount ?? tableRows.filter((row) => row.risk === 'Critical').length, tone: 'critical' },
              { id: 'warning', label: 'Warning', value: summary?.warningCount ?? tableRows.filter((row) => row.risk === 'Warning').length, tone: 'warning' },
              { id: 'within-threshold', label: 'Within threshold', value: withinThresholdSummary, tone: 'success' },
            ]}
            centerLabel={String(summary?.totalReports ?? tableRows.length)}
            centerSubLabel="reports"
          />
        </Panel>
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

      <Panel className="p-6">
        <div className="mb-4">
          <Kicker>Heatmap · Last 7 days</Kicker>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">Delta % by source × day</h2>
          <p className="mt-2 text-sm text-text-muted">
            Repeated publisher variance stands out immediately when the same source lights up across multiple days.
          </p>
        </div>
        <Heatmap
          title="Discrepancy delta by source over 7 days"
          description="Heatmap showing discrepancy delta percent across the most volatile sources over the last seven visible days."
          cells={heatmapCells}
          xLabels={heatmapDates}
          yLabels={topSources}
          tone="warning"
          format={(value) => `${value.toFixed(1)}%`}
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
            <div className="rounded-2xl border border-border-default bg-surface-2 p-4"><p className="text-xs font-medium uppercase tracking-wide text-text-muted">Total</p><p className="mt-2 text-2xl font-semibold text-text-primary">{tableRows.length}</p><p className="mt-1 text-sm text-text-muted">reports in current view</p></div>
            <div className="rounded-2xl border border-border-default bg-surface-2 p-4"><p className="text-xs font-medium uppercase tracking-wide text-text-muted">Critical</p><p className="mt-2 text-2xl font-semibold text-text-primary">{tableRows.filter((row) => row.risk === 'Critical').length}</p><p className="mt-1 text-sm text-text-muted">need invoice validation</p></div>
            <div className="rounded-2xl border border-border-default bg-surface-2 p-4"><p className="text-xs font-medium uppercase tracking-wide text-text-muted">Warning</p><p className="mt-2 text-2xl font-semibold text-text-primary">{tableRows.filter((row) => row.risk === 'Warning').length}</p><p className="mt-1 text-sm text-text-muted">publisher follow-up required</p></div>
            <div className="rounded-2xl border border-border-default bg-surface-2 p-4"><p className="text-xs font-medium uppercase tracking-wide text-text-muted">Thresholds</p><p className="mt-2 text-2xl font-semibold text-text-primary">{thresholds.warningPct}% / {thresholds.criticalPct}%</p><p className="mt-1 text-sm text-text-muted">warning and critical variance caps</p></div>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-border-default">
            <DiscrepancyTable rows={tableRows} onInvestigate={load} />
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="space-y-8">
            <section>
              <Kicker>Module health</Kicker>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-border-default bg-surface-2 px-4 py-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Threshold breaches</p>
                  <p className="mt-2 text-2xl font-semibold text-text-primary">{breaches}</p>
                  <p className="mt-1 text-sm text-text-muted">require reconciliation review</p>
                </div>
                <div className="rounded-2xl border border-border-default bg-surface-2 px-4 py-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Resolved</p>
                  <p className="mt-2 text-2xl font-semibold text-text-primary">{resolved}</p>
                  <p className="mt-1 text-sm text-text-muted">closed discrepancy checks</p>
                </div>
                <div className="rounded-2xl border border-border-default bg-surface-2 px-4 py-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Within threshold</p>
                  <p className="mt-2 text-2xl font-semibold text-text-primary">{withinThreshold}</p>
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
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setThresholds((current) => ({ ...current, warningPct: Number(event.target.value) }))}
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
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setThresholds((current) => ({ ...current, criticalPct: Number(event.target.value) }))}
                    className="mt-2"
                  />
                </div>
                <Button type="submit" disabled={savingThresholds} variant="primary">
                  {savingThresholds ? 'Saving…' : 'Save thresholds'}
                </Button>
                {thresholdMsg && (
                  <p className={thresholdMsg.includes('Couldn’t') ? 'text-sm text-[color:var(--dusk-status-critical-fg)]' : 'text-sm text-[color:var(--dusk-status-success-fg)]'}>
                    {thresholdMsg}
                  </p>
                )}
              </form>
            </section>

            <section>
              <Kicker>Prototype checks</Kicker>
              <div className="mt-4 grid gap-3">
                {checks.map((test) => (
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
