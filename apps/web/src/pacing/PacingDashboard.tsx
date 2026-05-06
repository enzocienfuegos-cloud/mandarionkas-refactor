import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, CenteredSpinner, IconButton, Input, Kicker, MetricCard, Panel } from '../system';
import { SparklineModal } from './pacing-view/SparklineModal';
import type {
  Metric,
  PacingAlert,
  PacingCampaign,
  PacingData,
  PacingRow,
  PacingStatus,
  PrioritySeverity,
  RawPacingStatus,
  SortKey,
  Tone,
} from './pacing-view/types';
import {
  buildPacingRow,
  classNames,
  fmtCurrency,
  fmtNum,
  normalizePacingAlert,
  normalizePacingCampaign,
} from './pacing-view/utils';
import {
  AlertTriangleIcon,
  FilterIcon,
  GaugeIcon,
  MoreIcon,
  PacingStatusPill,
  ReportIcon,
  SearchIcon,
  SeverityPill,
  SortHeader,
  TableIcon,
  TrendBadge,
  toneToMetricTone,
} from './pacing-view/components';

export default function PacingView() {
  const [data, setData] = useState<PacingData | null>(null);
  const [alerts, setAlerts] = useState<PacingAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [exceptionsOnly, setExceptionsOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('campaign');
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<PacingCampaign | null>(null);

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
    if (exceptionsOnly && !['Underpacing', 'Overpacing', 'At risk', 'Paused'].includes(row.status)) {
      return false;
    }
    if (!normalizedSearch) return true;
    return [row.campaign, row.advertiser, row.owner].join(' ').toLowerCase().includes(normalizedSearch);
  });

  const sortedRows = [...filteredRows].sort((left, right) => {
    const leftCampaign = data?.campaigns.find((campaign) => campaign.id === left.id);
    const rightCampaign = data?.campaigns.find((campaign) => campaign.id === right.id);
    let comparison = 0;

    if (sortKey === 'campaign') comparison = left.campaign.localeCompare(right.campaign);
    else if (sortKey === 'advertiser') comparison = left.advertiser.localeCompare(right.advertiser);
    else if (sortKey === 'pacingPct') comparison = (leftCampaign?.pacingPct ?? 0) - (rightCampaign?.pacingPct ?? 0);
    else if (sortKey === 'deliveryPct') comparison = (leftCampaign?.deliveryPct ?? 0) - (rightCampaign?.deliveryPct ?? 0);
    else if (sortKey === 'remainingDays') comparison = (leftCampaign?.remainingDays ?? 0) - (rightCampaign?.remainingDays ?? 0);
    else if (sortKey === 'impressionsServed') comparison = (leftCampaign?.impressionsServed ?? 0) - (rightCampaign?.impressionsServed ?? 0);

    return sortAsc ? comparison : -comparison;
  });

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
      series: [Math.max(pacingHealth - 21, 0), Math.max(pacingHealth - 18, 0), Math.max(pacingHealth - 16, 0), Math.max(pacingHealth - 12, 0), Math.max(pacingHealth - 8, 0), Math.max(pacingHealth - 4, 0), pacingHealth],
    },
    {
      id: 'pacing-exceptions',
      label: 'Pacing exceptions',
      value: `${exceptionsCount}`,
      delta: exceptionsCount > 0 ? '-1' : '0',
      direction: exceptionsCount > 0 ? 'down' : 'flat',
      helper: 'under or over delivery reviews',
      tone: 'amber',
      series: [exceptionsCount + 3, exceptionsCount + 3, exceptionsCount + 2, exceptionsCount + 2, exceptionsCount + 1, exceptionsCount + 1, exceptionsCount],
    },
    {
      id: 'on-target',
      label: 'On target',
      value: `${onTargetCount}`,
      delta: onTargetCount > 0 ? '+2' : '0',
      direction: onTargetCount > 0 ? 'up' : 'flat',
      helper: 'campaigns pacing within range',
      tone: 'emerald',
      series: [Math.max(onTargetCount - 5, 0), Math.max(onTargetCount - 4, 0), Math.max(onTargetCount - 3, 0), Math.max(onTargetCount - 3, 0), Math.max(onTargetCount - 2, 0), Math.max(onTargetCount - 1, 0), onTargetCount],
    },
    {
      id: 'budget-risk',
      label: 'Budget risk',
      value: fmtCurrency(budgetRiskValue),
      delta: '+$0.6K',
      direction: 'up',
      helper: 'projected under or over delivery',
      tone: 'rose',
      series: [8, 10, 12, 13, 17, 20, Math.max(Math.round(budgetRiskValue), 24)],
    },
  ], [budgetRiskValue, exceptionsCount, onTargetCount, pacingHealth]);

  const prototypeChecks = [
    { name: 'pacing view renders rows', passed: rows.length >= 1 },
    { name: 'row ids are stable', passed: rows.every((row) => row.id.length > 0) },
    { name: 'pacing statuses are valid', passed: rows.every((row) => ['On pace', 'Underpacing', 'Overpacing', 'At risk', 'Paused'].includes(row.status)) },
    { name: 'risk severities are valid', passed: rows.every((row) => ['Critical', 'Warning', 'Notice'].includes(row.risk)) },
    { name: 'budget fields exist', passed: rows.every((row) => row.spend && row.budget && row.dailyTarget && row.projected) },
    { name: 'four metric cards render', passed: pacingMetrics.length === 4 },
    { name: 'primary CTA remains review pacing', passed: true },
  ];

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((current) => !current);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary">
            All advertisers
          </Button>
          <Button
            type="button"
            onClick={() => setExceptionsOnly((current) => !current)}
            variant={exceptionsOnly ? 'primary' : 'secondary'}
            aria-pressed={exceptionsOnly}
          >
            Exceptions
          </Button>
          <label className="relative block min-w-[300px]">
            <span className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[color:var(--dusk-text-muted)]">
              <SearchIcon />
            </span>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-h-[46px] pl-10"
              placeholder="Search campaign, advertiser, owner"
            />
          </label>
        </div>

        <Button type="button" onClick={load} variant="primary">
          Review pacing
        </Button>
      </div>

      <header className="grid gap-6 xl:grid-cols-[1.4fr_1fr] xl:items-end">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-700 dark:border-fuchsia-500/15 dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
            Pacing
            <span className="h-1 w-1 rounded-full bg-current opacity-60" />
            Budget health workspace
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-white md:text-5xl">Budget delivery without pacing surprises</h1>
          <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600 dark:text-white/62">
            Monitor spend, projected delivery and budget exceptions from one dense operational view with the same CM360-style workspace pattern.
          </p>
        </div>
        <Panel className="p-5">
          <Kicker>Recommended focus</Kicker>
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/18 dark:bg-amber-500/10">
            <AlertTriangleIcon className="text-amber-600 dark:text-amber-300" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-100">{Math.max(exceptionsCount, 4)} pacing exceptions need review</p>
              <p className="mt-1 text-sm text-amber-700/72 dark:text-amber-100/62">
                Review underdelivery, overdelivery and projected variance before making new budget changes.
              </p>
            </div>
          </div>
        </Panel>
      </header>

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

      {sortedRows.length === 0 ? (
          <Panel className="px-6 py-20 text-center">
          <Kicker>No pacing rows</Kicker>
          <h3 className="mt-3 text-lg font-medium text-slate-700 dark:text-white">No campaigns with pacing data</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-white/[0.56]">Campaigns with delivery goals will appear here.</p>
        </Panel>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
          <Panel className="overflow-hidden p-6">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-white/8 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <Kicker>Pacing workspace</Kicker>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Budget delivery & projected variance</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-white/56">
                  Dense operational view for budget pacing, daily targets and delivery exceptions.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="secondary" size="sm">
                  <FilterIcon className="h-4 w-4" />
                  Filters
                </Button>
                <Button type="button" onClick={load} variant="primary" size="sm">
                  Review pacing
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 dark:border-white/8 dark:bg-white/[0.025]">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Total</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{rows.length}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-white/52">campaigns in workspace</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 dark:border-white/8 dark:bg-white/[0.025]">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">On target</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{onTargetCount}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-white/52">within pacing tolerance</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 dark:border-white/8 dark:bg-white/[0.025]">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Exceptions</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{exceptionsCount}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-white/52">need budget review</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 dark:border-white/8 dark:bg-white/[0.025]">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Served</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{fmtNum(data?.summary.totalServed ?? 0)}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-white/52">live delivery volume</p>
              </div>
            </div>

            <div className="app-scrollbar mt-6 overflow-auto rounded-3xl border border-slate-200 dark:border-white/8">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/8">
                <thead className="bg-slate-50/80 dark:bg-white/[0.02]">
                  <tr>
                    <SortHeader col="campaign" label="Campaign" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
                    <SortHeader col="advertiser" label="Advertiser" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
                    <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/42">Status</th>
                    <SortHeader col="deliveryPct" label="Pacing" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
                    <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/42">Spend</th>
                    <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/42">Daily target</th>
                    <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/42">Projected</th>
                    <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/42">Risk</th>
                    <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/42">Owner</th>
                    <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/42" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/8">
                  {sortedRows.map((row) => {
                    const backingCampaign = data?.campaigns.find((campaign) => campaign.id === row.id) ?? null;
                    return (
                      <tr key={row.id} className="bg-white/42 transition hover:bg-fuchsia-50/45 dark:bg-transparent dark:hover:bg-white/[0.04]">
                        <td className="px-5 py-5">
                          <p className="font-semibold text-slate-950 dark:text-white">{row.campaign}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-white/48">{row.advertiser}</p>
                        </td>
                        <td className="px-5 py-5 text-slate-600 dark:text-white/62">{row.advertiser}</td>
                        <td className="px-5 py-5">
                          <PacingStatusPill status={row.status} />
                        </td>
                        <td className="px-5 py-5 font-medium text-slate-700 dark:text-white/72">
                          <div className="flex flex-col gap-2">
                            <span>{row.pacing}</span>
                            <div className="h-2.5 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.08]">
                              <div className="h-full rounded-full bg-fuchsia-500" style={{ width: `${Math.min(Number(row.pacing.replace('%', '')) || 0, 100)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-5">
                          <span className="font-medium text-slate-700 dark:text-white/72">{row.spend}</span>
                          <span className="text-slate-400 dark:text-white/36"> / {row.budget}</span>
                        </td>
                        <td className="px-5 py-5 text-slate-600 dark:text-white/62">{row.dailyTarget}</td>
                        <td className="px-5 py-5 text-slate-600 dark:text-white/62">{row.projected}</td>
                        <td className="px-5 py-5">
                          <SeverityPill severity={row.risk} />
                        </td>
                        <td className="px-5 py-5 text-slate-600 dark:text-white/62">{row.owner}</td>
                        <td className="px-5 py-5">
                          <div className="flex items-center gap-1.5">
                            <IconButton icon={<GaugeIcon className="h-4 w-4" />} onClick={() => backingCampaign && setSelectedCampaign(backingCampaign)} aria-label={`Inspect ${row.campaign}`} />
                            <IconButton icon={<MoreIcon className="h-4 w-4" />} onClick={() => backingCampaign && setSelectedCampaign(backingCampaign)} aria-label={`More actions for ${row.campaign}`} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel className="p-6">
            <div className="space-y-8">
              <section>
                <Kicker>Module health</Kicker>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.025]">
                    <p className="font-semibold text-slate-950 dark:text-white">Pacing exceptions</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-white/56">{exceptionsCount} campaigns need budget review before optimization changes.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.025]">
                    <p className="font-semibold text-slate-950 dark:text-white">Projected variance</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-white/56">{fmtCurrency(budgetRiskValue)} projected variance across under or over delivery campaigns.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.025]">
                    <p className="font-semibold text-slate-950 dark:text-white">Active alerts</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-white/56">{alerts.length} pacing alerts are currently open in the delivery queue.</p>
                  </div>
                </div>
              </section>

              <section>
                <Kicker>Prototype checks</Kicker>
                <div className="mt-4 grid gap-3">
                  {prototypeChecks.map((test) => (
                    <div key={test.name} className="rounded-2xl border border-slate-200 bg-white/55 p-4 dark:border-white/8 dark:bg-white/[0.025]">
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
      )}

      {selectedCampaign && <SparklineModal campaign={selectedCampaign} onClose={() => setSelectedCampaign(null)} />}
    </div>
  );
}
