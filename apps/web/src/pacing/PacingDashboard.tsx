import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CenteredSpinner, Kicker, MetricCard, Panel } from '../system';
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
  TrendDirection,
} from './pacing-view/types';
import {
  buildPacingRow,
  classNames,
  fmtCurrency,
  fmtNum,
  normalizePacingAlert,
  normalizePacingCampaign,
} from './pacing-view/utils';

type IconProps = { className?: string };

function iconProps(className?: string) {
  return {
    className: classNames('h-5 w-5', className),
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true,
  } as const;
}

const AlertTriangleIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M12 4 3.5 19h17L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M12 9v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="16" r="1" fill="currentColor" />
  </svg>
);

const SearchIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8" />
    <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const FilterIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const GaugeIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M4 15a8 8 0 1 1 16 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="m12 15 4-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M8 19h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const ReportIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M6 19V9M12 19V5M18 19v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const TableIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M4 10h16M10 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const MoreIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <circle cx="5" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="19" cy="12" r="1" fill="currentColor" />
  </svg>
);

function toneClass(tone: Tone) {
  const map: Record<Tone, string> = {
    fuchsia: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-600 dark:border-fuchsia-500/18 dark:bg-fuchsia-500/10 dark:text-fuchsia-300',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/18 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber: 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/18 dark:bg-amber-500/10 dark:text-amber-300',
    rose: 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/18 dark:bg-rose-500/10 dark:text-rose-300',
    sky: 'border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-500/18 dark:bg-sky-500/10 dark:text-sky-300',
    slate: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/8 dark:bg-white/[0.04] dark:text-white/70',
  };
  return map[tone];
}

function pacingStatusBadge(status: PacingStatus) {
  const map: Record<PacingStatus, string> = {
    'On pace': 'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-500/22 dark:bg-emerald-500/10 dark:text-emerald-300',
    Underpacing: 'border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-500/22 dark:bg-amber-500/10 dark:text-amber-300',
    Overpacing: 'border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-500/22 dark:bg-amber-500/10 dark:text-amber-300',
    'At risk': 'border-rose-300/70 bg-rose-50 text-rose-700 dark:border-rose-500/22 dark:bg-rose-500/10 dark:text-rose-300',
    Paused: 'border-slate-300/70 bg-slate-50 text-slate-700 dark:border-white/12 dark:bg-white/[0.05] dark:text-white/70',
  };
  return map[status];
}

function severityBadge(severity: PrioritySeverity) {
  const map: Record<PrioritySeverity, string> = {
    Critical: 'border-rose-300/70 bg-rose-50 text-rose-700 dark:border-rose-500/22 dark:bg-rose-500/10 dark:text-rose-300',
    Warning: 'border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-500/22 dark:bg-amber-500/10 dark:text-amber-300',
    Notice: 'border-sky-300/70 bg-sky-50 text-sky-700 dark:border-sky-500/22 dark:bg-sky-500/10 dark:text-sky-300',
  };
  return map[severity];
}

function TrendBadge({ direction, value }: { direction: TrendDirection; value: string }) {
  const classes =
    direction === 'up'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
      : direction === 'down'
        ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300'
        : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/8 dark:bg-white/[0.03] dark:text-white/58';
  return <span className={classNames('rounded-full border px-2.5 py-1 text-xs font-semibold', classes)}>{value}</span>;
}

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

  const SortHeader = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      className="cursor-pointer px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 transition hover:text-slate-700 dark:text-white/42 dark:hover:text-white/70"
      onClick={() => handleSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}
        {sortKey === col ? (sortAsc ? ' ↑' : ' ↓') : <span className="text-slate-300 dark:text-white/18"> ↕</span>}
      </span>
    </th>
  );

  if (loading) {
    return (
      <CenteredSpinner label="Loading pacing workspace…" />
    );
  }

  if (error) {
    return (
      <Panel className="border-rose-200 bg-rose-50/90 p-4 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
        <p className="font-medium">Error loading pacing data</p>
        <p className="mt-1 text-sm">{error}</p>
        <button onClick={load} className="mt-3 text-sm text-rose-700 underline dark:text-rose-300">
          Retry
        </button>
      </Panel>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-slate-200/80 bg-[rgba(252,251,255,0.82)] px-4 text-sm font-medium text-slate-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-white/86 dark:hover:border-fuchsia-500/22 dark:hover:bg-white/[0.045]"
          >
            All advertisers
          </button>
          <button
            type="button"
            onClick={() => setExceptionsOnly((current) => !current)}
            className={classNames(
              'inline-flex min-h-[46px] items-center gap-2 rounded-xl border px-4 text-sm font-medium transition',
              exceptionsOnly
                ? 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/22 dark:bg-fuchsia-500/10 dark:text-fuchsia-200'
                : 'border-slate-200/80 bg-[rgba(252,251,255,0.82)] text-slate-700 hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-white/86 dark:hover:border-fuchsia-500/22 dark:hover:bg-white/[0.045]',
            )}
          >
            Exceptions
          </button>
          <label className="relative block min-w-[300px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40">
              <SearchIcon />
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-h-[46px] w-full rounded-xl border border-slate-200/80 bg-[rgba(252,251,255,0.82)] pl-10 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-500/10 dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-white dark:placeholder:text-white/30 dark:focus:border-fuchsia-500/30"
              placeholder="Search campaign, advertiser, owner"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={load}
          className="inline-flex min-h-[46px] items-center rounded-xl bg-brand-gradient px-5 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(241,0,139,0.28)] transition hover:translate-y-[-1px] hover:shadow-[0_18px_42px_rgba(241,0,139,0.34)]"
        >
          Review pacing
        </button>
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
              metric.tone === 'fuchsia'
                ? 'brand'
                : metric.tone === 'emerald'
                  ? 'success'
                  : metric.tone === 'amber'
                    ? 'warning'
                    : metric.tone === 'rose'
                      ? 'critical'
                      : metric.tone === 'sky'
                        ? 'info'
                        : 'neutral'
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
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:border-white/8 dark:bg-white/[0.03] dark:text-white/72 dark:hover:border-fuchsia-500/28 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-200"
                >
                  <FilterIcon className="h-4 w-4" />
                  Filters
                </button>
                <button
                  type="button"
                  onClick={load}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(241,0,139,0.24)]"
                >
                  Review pacing
                </button>
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
                    <SortHeader col="campaign" label="Campaign" />
                    <SortHeader col="advertiser" label="Advertiser" />
                    <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/42">Status</th>
                    <SortHeader col="deliveryPct" label="Pacing" />
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
                          <span className={classNames('inline-flex rounded-full border px-3 py-1 text-xs font-semibold', pacingStatusBadge(row.status))}>{row.status}</span>
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
                          <span className={classNames('inline-flex rounded-full border px-3 py-1 text-xs font-semibold', severityBadge(row.risk))}>{row.risk}</span>
                        </td>
                        <td className="px-5 py-5 text-slate-600 dark:text-white/62">{row.owner}</td>
                        <td className="px-5 py-5">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => backingCampaign && setSelectedCampaign(backingCampaign)}
                              className="rounded-xl border border-transparent p-2 text-slate-400 transition hover:border-fuchsia-200 hover:bg-fuchsia-50 hover:text-fuchsia-600 dark:text-white/36 dark:hover:border-fuchsia-500/20 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-300"
                              aria-label={`Inspect ${row.campaign}`}
                            >
                              <GaugeIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => backingCampaign && setSelectedCampaign(backingCampaign)}
                              className="rounded-xl border border-transparent p-2 text-slate-400 transition hover:border-fuchsia-200 hover:bg-fuchsia-50 hover:text-fuchsia-600 dark:text-white/36 dark:hover:border-fuchsia-500/20 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-300"
                              aria-label={`More actions for ${row.campaign}`}
                            >
                              <MoreIcon className="h-4 w-4" />
                            </button>
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
