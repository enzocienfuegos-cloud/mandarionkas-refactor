import React, { useMemo, useState } from 'react';
import { Button, CenteredSpinner, ConfigurableMetricStrip, FilterBar, Kicker, PageHeader, Panel, TrendChart } from '../system';
import { CampaignDetailDrawer } from './pacing-view/CampaignDetailDrawer';
import { PacingTable } from './pacing-view/PacingTable';
import type { PacingCampaign } from './pacing-view/types';
import { fmtCurrency, fmtNum } from './pacing-view/utils';
import { AlertTriangleIcon } from './pacing-view/components';
import { usePacingBreakdown, usePacingData, usePacingFilters, usePacingViewModel } from './pacing-view/hooks';
import { pacingMetricScope } from './pacing.metrics';

export default function PacingView() {
  const filters = usePacingFilters();
  const { data, alerts, loading, error, reload: load } = usePacingData();
  const {
    rows,
    filteredRows,
    advertiserOptions,
    focusCampaign,
    exceptionsCount,
    onTargetCount,
    budgetRiskValue,
    prototypeChecks,
  } = usePacingViewModel({ data, filters });
  const [selectedCampaign, setSelectedCampaign] = useState<PacingCampaign | null>(null);
  const { focusBreakdown } = usePacingBreakdown(focusCampaign?.id);

  const pacingTrendData = useMemo(() => {
    if (!focusBreakdown.length) return [];
    let deliveredCumulative = 0;
    let targetCumulative = 0;
    return focusBreakdown.map((entry) => {
      deliveredCumulative += Number(entry.impressions ?? 0);
      targetCumulative += Number(entry.expected ?? 0);
      const paceRatio = targetCumulative > 0 ? deliveredCumulative / targetCumulative : 1;
      return {
        date: new Date(`${entry.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        delivered: deliveredCumulative,
        target: targetCumulative,
        projected: Math.round(targetCumulative * paceRatio),
      };
    });
  }, [focusBreakdown]);

  if (loading) {
    return <CenteredSpinner label="Loading pacing workspace…" />;
  }

  if (error) {
    return (
      <Panel className="border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] p-4 text-[color:var(--dusk-status-critical-fg)]" role="alert">
        <p className="font-medium">Error loading pacing data</p>
        <p className="mt-1 text-sm">{error}</p>
        <Button onClick={load} variant="ghost" size="sm" className="mt-3">Retry</Button>
      </Panel>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-6">
      <PageHeader
        kicker="Pacing · Budget health workspace"
        title="Pacing"
        meta={`${rows.length} campaigns · ${exceptionsCount} exceptions · live delivery workspace`}
        primaryAction={<Button type="button" onClick={load} variant="primary">Review pacing</Button>}
        alert={(
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <AlertTriangleIcon className="mt-0.5 shrink-0" />
              <p className="text-sm font-medium">
                {Math.max(exceptionsCount, 4)} pacing exceptions need review before new budget changes.
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => filters.setExceptionsOnly(true)} className="shrink-0">
              Filter to exceptions
            </Button>
          </div>
        )}
      />

      <FilterBar
        pills={[
          {
            id: 'advertiser',
            label: 'Advertiser',
            value: filters.advertiserFilter,
            options: [
              { value: '', label: 'All advertisers' },
              ...advertiserOptions.map((advertiser) => ({ value: advertiser, label: advertiser })),
            ],
            onChange: filters.setAdvertiserFilter,
          },
          {
            id: 'status',
            label: 'Status',
            value: filters.statusFilter,
            options: [
              { value: 'all', label: 'All campaigns' },
              { value: 'exceptions', label: 'Exceptions only' },
              { value: 'on_pace', label: 'On pace' },
              { value: 'paused', label: 'Paused' },
            ],
            onChange: (value) => {
              const next = value as 'all' | 'exceptions' | 'on_pace' | 'paused';
              filters.setStatusFilter(next);
              filters.setExceptionsOnly(next === 'exceptions');
            },
          },
          {
            id: 'date-range',
            label: 'Date range',
            value: filters.dateRangeFilter,
            options: [
              { value: '7d', label: 'Next 7 days' },
              { value: '30d', label: 'Next 30 days' },
              { value: '90d', label: 'Next 90 days' },
            ],
            onChange: (value) => filters.setDateRangeFilter(value as '7d' | '30d' | '90d'),
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

      <ConfigurableMetricStrip
        scope={pacingMetricScope}
        data={{
          data,
          rows: data?.campaigns ?? [],
        }}
      />

      <Panel className="p-6">
          <div className="mb-4">
            <Kicker>Pacing curve</Kicker>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">
              {focusCampaign ? `${focusCampaign.name} · last 7 days` : 'Last 7 days'}
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              Delivered vs expected pacing for the current focus campaign, with projected finish based on current pace.
            </p>
          </div>
          <TrendChart
            data={pacingTrendData}
            xKey="date"
            kind="line"
            title="Pacing trend for the selected focus campaign"
            description="Line chart showing cumulative delivered impressions, target impressions, and projected delivery over the last seven days."
            series={[
              { key: 'delivered', label: 'Delivered', tone: 'brand', format: (value) => fmtNum(value) },
              { key: 'target', label: 'Target', tone: 'neutral', dashed: true, format: (value) => fmtNum(value) },
              { key: 'projected', label: 'Projected', tone: 'warning', format: (value) => fmtNum(value) },
            ]}
          />
      </Panel>

      {filteredRows.length === 0 ? (
        <Panel padding="none">
          <div className="px-6 py-20 text-center">
            <Kicker>No pacing rows</Kicker>
            <h3 className="mt-3 text-lg font-medium text-text-primary">No campaigns with pacing data</h3>
            <p className="mt-1 text-sm text-text-muted">Campaigns with delivery goals will appear here.</p>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
          <Panel className="overflow-hidden p-6">
            <div className="flex flex-col gap-4 border-b border-border-default pb-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <Kicker>Pacing workspace</Kicker>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">Budget delivery & projected variance</h2>
                <p className="mt-2 text-sm text-text-muted">
                  Dense operational view for budget pacing, daily targets and delivery exceptions.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={load} variant="primary" size="sm">
                  Review pacing
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-border-default bg-surface-2 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Total</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{rows.length}</p>
                <p className="mt-1 text-sm text-text-muted">campaigns in workspace</p>
              </div>
              <div className="rounded-2xl border border-border-default bg-surface-2 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">On target</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{onTargetCount}</p>
                <p className="mt-1 text-sm text-text-muted">within pacing tolerance</p>
              </div>
              <div className="rounded-2xl border border-border-default bg-surface-2 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Exceptions</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{exceptionsCount}</p>
                <p className="mt-1 text-sm text-text-muted">need budget review</p>
              </div>
              <div className="rounded-2xl border border-border-default bg-surface-2 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Served</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{fmtNum(data?.summary.totalServed ?? 0)}</p>
                <p className="mt-1 text-sm text-text-muted">live delivery volume</p>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-3xl border border-border-default">
              <PacingTable
                rows={filteredRows}
                campaigns={data?.campaigns ?? []}
                onInspectCampaign={setSelectedCampaign}
              />
            </div>
          </Panel>

          <Panel className="p-6">
            <div className="space-y-8">
              <section>
                <Kicker>Module health</Kicker>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-border-default bg-surface-2 px-4 py-3">
                    <p className="font-semibold text-text-primary">Pacing exceptions</p>
                    <p className="mt-1 text-sm text-text-muted">{exceptionsCount} campaigns need budget review before optimization changes.</p>
                  </div>
                  <div className="rounded-2xl border border-border-default bg-surface-2 px-4 py-3">
                    <p className="font-semibold text-text-primary">Projected variance</p>
                    <p className="mt-1 text-sm text-text-muted">{fmtCurrency(budgetRiskValue)} projected variance across under or over delivery campaigns.</p>
                  </div>
                  <div className="rounded-2xl border border-border-default bg-surface-2 px-4 py-3">
                    <p className="font-semibold text-text-primary">Active alerts</p>
                    <p className="mt-1 text-sm text-text-muted">{alerts.length} pacing alerts are currently open in the delivery queue.</p>
                  </div>
                </div>
              </section>

              <section>
                <Kicker>Prototype checks</Kicker>
                <div className="mt-4 grid gap-3">
                  {prototypeChecks.map((test) => (
                    <div key={test.name} className="rounded-2xl border border-border-default bg-surface-2 p-4">
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
      )}

      <CampaignDetailDrawer
        campaign={selectedCampaign}
        open={!!selectedCampaign}
        onClose={() => setSelectedCampaign(null)}
      />
    </div>
  );
}
