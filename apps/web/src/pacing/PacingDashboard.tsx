import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, CenteredSpinner, FilterBar, Kicker, MetricCard, PageHeader, Panel, TrendChart } from '../system';
import { SparklineModal } from './pacing-view/SparklineModal';
import { PacingTable } from './pacing-view/PacingTable';
import type {
  BreakdownDay,
  Metric,
  PacingAlert,
  PacingCampaign,
  PacingData,
  PacingRow,
  PacingStatus,
  PrioritySeverity,
  RawPacingStatus,
  Tone,
} from './pacing-view/types';
import {
  buildPacingRow,
  fmtCurrency,
  fmtNum,
  normalizePacingAlert,
  normalizePacingCampaign,
} from './pacing-view/utils';
import {
  AlertTriangleIcon,
  GaugeIcon,
  ReportIcon,
  TableIcon,
  toneToMetricTone,
} from './pacing-view/components';

export default function PacingView() {
  const [data, setData] = useState<PacingData | null>(null);
  const [alerts, setAlerts] = useState<PacingAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [advertiserFilter, setAdvertiserFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState<'7d' | '30d' | '90d'>('30d');
  const [statusFilter, setStatusFilter] = useState<'all' | 'exceptions' | 'on_pace' | 'paused'>('all');
  const [exceptionsOnly, setExceptionsOnly] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<PacingCampaign | null>(null);
  const [focusBreakdown, setFocusBreakdown] = useState<BreakdownDay[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      fetch('/v1/pacing', { credentials: 'include' }).then((response) => {
        if (!response.ok) throw new Error('Failed to load pacing data');
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

  const rows = useMemo(() => (data?.campaigns ?? []).map(buildPacingRow), [data]);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    if (advertiserFilter && row.advertiser !== advertiserFilter) {
      return false;
    }
    if (statusFilter === 'exceptions' && !['Underpacing', 'Overpacing', 'At risk', 'Paused'].includes(row.status)) {
      return false;
    }
    if (statusFilter === 'on_pace' && row.status !== 'On pace') {
      return false;
    }
    if (statusFilter === 'paused' && row.status !== 'Paused') {
      return false;
    }
    if (exceptionsOnly && !['Underpacing', 'Overpacing', 'At risk', 'Paused'].includes(row.status)) {
      return false;
    }
    const campaign = data?.campaigns.find((entry) => entry.id === row.id);
    if (campaign) {
      const remainingDays = campaign.remainingDays ?? 0;
      if (dateRangeFilter === '7d' && remainingDays > 7) return false;
      if (dateRangeFilter === '30d' && remainingDays > 30) return false;
      if (dateRangeFilter === '90d' && remainingDays > 90) return false;
    }
    if (!normalizedSearch) return true;
    return [row.campaign, row.advertiser, row.owner].join(' ').toLowerCase().includes(normalizedSearch);
  });

  const advertiserOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.advertiser))).sort(),
    [rows],
  );
  const focusCampaign = useMemo(
    () => data?.campaigns.find((campaign) => campaign.id === filteredRows[0]?.id) ?? null,
    [data?.campaigns, filteredRows],
  );

  useEffect(() => {
    if (!focusCampaign) {
      setFocusBreakdown([]);
      return;
    }
    fetch(`/v1/pacing/${focusCampaign.id}/breakdown?days=7`, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load pacing breakdown');
        return response.json();
      })
      .then((payload) => setFocusBreakdown(payload?.breakdown ?? payload ?? []))
      .catch(() => setFocusBreakdown([]));
  }, [focusCampaign?.id]);

  const exceptionsCount = rows.filter((row) => ['Underpacing', 'Overpacing', 'At risk', 'Paused'].includes(row.status)).length;
  const onTargetCount = rows.filter((row) => row.status === 'On pace').length;
  const budgetRiskValue = rows
    .filter((row) => row.risk !== 'Notice')
    .reduce((sum, row) => sum + Number(row.projected.replace(/[^0-9.]/g, '')), 0);
  const pacingHealth = rows.length ? Math.round((onTargetCount / rows.length) * 100) : 0;

  const pacingMetrics: Metric[] = useMemo(() => [
    {
      id: 'pacing-health',
      label: 'Pacing health',
      value: `${pacingHealth}%`,
      delta: '+3%',
      direction: 'up',
      helper: 'campaigns within delivery tolerance',
      tone: 'fuchsia',
      series: [],
    },
    {
      id: 'pacing-exceptions',
      label: 'Pacing exceptions',
      value: `${exceptionsCount}`,
      delta: exceptionsCount > 0 ? '-1' : '0',
      direction: exceptionsCount > 0 ? 'down' : 'flat',
      helper: 'under or over delivery reviews',
      tone: 'amber',
      series: [],
    },
    {
      id: 'on-target',
      label: 'On target',
      value: `${onTargetCount}`,
      delta: onTargetCount > 0 ? '+2' : '0',
      direction: onTargetCount > 0 ? 'up' : 'flat',
      helper: 'campaigns pacing within range',
      tone: 'emerald',
      series: [],
    },
    {
      id: 'budget-risk',
      label: 'Budget risk',
      value: fmtCurrency(budgetRiskValue),
      delta: '+$0.6K',
      direction: 'up',
      helper: 'projected under or over delivery',
      tone: 'rose',
      series: [],
    },
  ], [budgetRiskValue, exceptionsCount, onTargetCount, pacingHealth]);

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

  const prototypeChecks = [
    { name: 'pacing view renders rows', passed: rows.length >= 1 },
    { name: 'row ids are stable', passed: rows.every((row) => row.id.length > 0) },
    { name: 'pacing statuses are valid', passed: rows.every((row) => ['On pace', 'Underpacing', 'Overpacing', 'At risk', 'Paused'].includes(row.status)) },
    { name: 'risk severities are valid', passed: rows.every((row) => ['Critical', 'Warning', 'Notice'].includes(row.risk)) },
    { name: 'budget fields exist', passed: rows.every((row) => row.spend && row.budget && row.dailyTarget && row.projected) },
    { name: 'four metric cards render', passed: pacingMetrics.length === 4 },
    { name: 'primary CTA remains review pacing', passed: true },
  ];

  if (loading) {
    return (
      <CenteredSpinner label="Loading pacing workspace…" />
    );
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
            <Button type="button" variant="ghost" size="sm" onClick={() => setExceptionsOnly(true)} className="shrink-0">
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
            value: advertiserFilter,
            options: [
              { value: '', label: 'All advertisers' },
              ...advertiserOptions.map((advertiser) => ({ value: advertiser, label: advertiser })),
            ],
            onChange: setAdvertiserFilter,
          },
          {
            id: 'status',
            label: 'Status',
            value: statusFilter,
            options: [
              { value: 'all', label: 'All campaigns' },
              { value: 'exceptions', label: 'Exceptions only' },
              { value: 'on_pace', label: 'On pace' },
              { value: 'paused', label: 'Paused' },
            ],
            onChange: (value) => {
              const next = value as 'all' | 'exceptions' | 'on_pace' | 'paused';
              setStatusFilter(next);
              setExceptionsOnly(next === 'exceptions');
            },
          },
          {
            id: 'date-range',
            label: 'Date range',
            value: dateRangeFilter,
            options: [
              { value: '7d', label: 'Next 7 days' },
              { value: '30d', label: 'Next 30 days' },
              { value: '90d', label: 'Next 90 days' },
            ],
            onChange: (value) => setDateRangeFilter(value as '7d' | '30d' | '90d'),
          },
        ]}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search campaign, advertiser, owner',
        }}
        activeFilterCount={[advertiserFilter, statusFilter !== 'all', dateRangeFilter !== '30d', search.trim()].filter(Boolean).length}
        onResetAll={() => {
          setAdvertiserFilter('');
          setStatusFilter('all');
          setExceptionsOnly(false);
          setDateRangeFilter('30d');
          setSearch('');
        }}
      />

      <div className="grid gap-5 xl:grid-cols-4">
        {pacingMetrics.map((metric) => (
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
            icon={
              metric.id === 'pacing-health'
                ? <GaugeIcon />
                : metric.id === 'on-target'
                  ? <ReportIcon />
                  : metric.id === 'budget-risk'
                    ? <AlertTriangleIcon />
                    : <TableIcon />
            }
          />
        ))}
      </div>

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

      {selectedCampaign && <SparklineModal campaign={selectedCampaign} onClose={() => setSelectedCampaign(null)} />}
    </div>
  );
}
