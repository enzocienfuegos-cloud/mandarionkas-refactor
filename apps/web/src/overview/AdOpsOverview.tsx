import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadCreatives, type Creative } from '../creatives/catalog';
import { loadAuthMe, loadWorkspaces, switchWorkspace, type WorkspaceOption } from '../shared/workspaces';
import { THEME_PREFERENCE_KEY, applyTheme, getInitialTheme, persistTheme, type ThemeMode } from '../shared/theme';

type DateRange = 7 | 30 | 90;
type TrendDirection = 'up' | 'down' | 'flat';
type AttentionSeverity = 'critical' | 'warning' | 'notice' | 'healthy';
type OverviewCardId =
  | 'spend'
  | 'impressions'
  | 'ctr'
  | 'engagements'
  | 'viewability'
  | 'topCampaigns'
  | 'quickNavigation'
  | 'systemHealth'
  | 'audienceInsights';

type SavedOverviewSetup = {
  id: string;
  name: string;
  cards: OverviewCardId[];
};

type OverviewPreferences = {
  visibleCards?: OverviewCardId[];
  savedSetups?: SavedOverviewSetup[];
  activeSetupId?: string;
};

type WorkspaceStats = {
  total_impressions?: number;
  total_clicks?: number;
  total_spend?: number;
  total_engagements?: number;
  viewability_rate?: number;
  avg_ctr?: number;
  active_campaigns?: number;
  active_tags?: number;
  total_creatives?: number;
  total_hover_duration_ms?: number;
  measurable_rate?: number;
};

type TimelinePoint = {
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
  viewability_rate: number;
  spend?: number;
};

type BreakdownItem = {
  id?: string;
  name?: string;
  label?: string;
  status?: string;
  format?: string;
  source_kind?: string;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  spend?: number;
  event_count?: number;
  event_type?: string;
};

type Campaign = {
  id: string;
  workspace_id?: string;
  name: string;
  status: 'active' | 'paused' | 'archived' | 'draft';
};

type Tag = {
  id: string;
  workspaceId?: string | null;
  name: string;
  format: 'VAST' | 'display' | 'native' | 'tracker';
  status: 'active' | 'paused' | 'archived' | 'draft';
  assignedCount?: number;
};

type AuthPayload = {
  user?: { display_name?: string | null; email?: string | null };
  workspace?: { id?: string; name?: string };
};

type AttentionItem = {
  id: string;
  title: string;
  detail: string;
  actionLabel: string;
  actionHref: string;
  severity: AttentionSeverity;
};

type MetricCardData = {
  id: Extract<OverviewCardId, 'spend' | 'impressions' | 'ctr' | 'engagements' | 'viewability'>;
  label: string;
  value: string;
  delta: string;
  direction: TrendDirection;
  icon: 'spend' | 'impressions' | 'ctr' | 'engagements' | 'viewability';
  tone: string;
  series: number[];
};

type TopCampaignRow = {
  id: string;
  name: string;
  spend: string;
  ctr: string;
  status: 'Healthy' | 'Needs optimization' | 'Critical';
};

type QuickNavRow = {
  id: string;
  label: string;
  detail: string;
  to: string;
  icon: 'campaigns' | 'creatives' | 'tags' | 'analytics';
  tone: string;
};

type SystemHealthRow = {
  id: string;
  label: string;
  value: string;
  note: string;
  severity: AttentionSeverity | 'positive';
};

type AudienceRow = {
  id: string;
  name: string;
  ctr: string;
  delta: string;
  direction: TrendDirection;
  score: number;
};

type SegmentBreakdownItem = {
  label?: string;
  name?: string;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  identity_count?: number;
};

const OVERVIEW_LAYOUT_PREFERENCE_KEY = 'overviewLayout';
const OVERVIEW_CARD_ORDER: OverviewCardId[] = [
  'spend',
  'impressions',
  'ctr',
  'engagements',
  'viewability',
  'topCampaigns',
  'quickNavigation',
  'systemHealth',
  'audienceInsights',
];
const DEFAULT_DATE_RANGE: DateRange = 7;
const DEFAULT_SETUP_ID = 'default';
const DEFAULT_SETUP_NAME = 'Default setup';

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function fmtNum(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function fmtPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

function fmtPctCompact(value: number): string {
  return `${value.toFixed(1)}%`;
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function getDateFrom(days: DateRange, now = new Date()): string {
  const copy = new Date(now);
  copy.setDate(copy.getDate() - (days - 1));
  return copy.toISOString().slice(0, 10);
}

function getPreviousRange(days: DateRange, now = new Date()) {
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - (days - 1));

  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);

  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - (days - 1));

  return {
    dateFrom: previousStart.toISOString().slice(0, 10),
    dateTo: previousEnd.toISOString().slice(0, 10),
  };
}

function buildQuery({ dateFrom, dateTo, campaignId }: { dateFrom: string; dateTo: string; campaignId?: string }) {
  const params = new URLSearchParams();
  params.set('dateFrom', dateFrom);
  params.set('dateTo', dateTo);
  params.set('limit', '12');
  if (campaignId) params.set('campaignId', campaignId);
  return `?${params.toString()}`;
}

function computeDelta(current: number, previous: number): { direction: TrendDirection; label: string } {
  if (previous <= 0 && current <= 0) return { direction: 'flat', label: '0%' };
  if (previous <= 0) return { direction: 'up', label: '+100%' };
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.05) return { direction: 'flat', label: '0%' };
  return {
    direction: change >= 0 ? 'up' : 'down',
    label: `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`,
  };
}

function normalizeCardOrder(candidate: unknown): OverviewCardId[] {
  if (!Array.isArray(candidate)) return OVERVIEW_CARD_ORDER;
  const allowed = new Set(OVERVIEW_CARD_ORDER);
  const normalized = candidate.filter((item): item is OverviewCardId => typeof item === 'string' && allowed.has(item as OverviewCardId));
  return normalized.length
    ? [...normalized, ...OVERVIEW_CARD_ORDER.filter((item) => !normalized.includes(item))]
    : OVERVIEW_CARD_ORDER;
}

function sanitizeSetups(candidate: unknown): SavedOverviewSetup[] {
  if (!Array.isArray(candidate)) return [];
  return candidate
    .map((item) => {
      const name = typeof item?.name === 'string' ? item.name.trim() : '';
      const id = typeof item?.id === 'string' ? item.id : '';
      const cards = normalizeCardOrder(item?.cards);
      if (!id || !name) return null;
      return { id, name, cards } satisfies SavedOverviewSetup;
    })
    .filter((item): item is SavedOverviewSetup => Boolean(item));
}

function getDefaultVisibleCards() {
  return [...OVERVIEW_CARD_ORDER];
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function SectionKicker({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-white/38">{children}</p>;
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={classNames(
        'rounded-[28px] border border-slate-200/80 bg-white/92 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/[0.05] dark:bg-[linear-gradient(180deg,rgba(17,24,39,0.9),rgba(9,13,24,0.96))] dark:shadow-[0_22px_60px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.025)]',
        className,
      )}
    >
      {children}
    </section>
  );
}

function TrendBadge({ direction, value }: { direction: TrendDirection; value: string }) {
  const classes =
    direction === 'up'
      ? 'text-emerald-500 dark:text-emerald-400'
      : direction === 'down'
        ? 'text-rose-500 dark:text-rose-400'
        : 'text-slate-500 dark:text-white/45';
  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '•';
  return <span className={classNames('inline-flex items-center gap-1 text-sm font-semibold', classes)}><span aria-hidden="true">{arrow}</span>{value}</span>;
}

function SelectChip({ label, icon, trailingIcon = true }: { label: string; icon?: React.ReactNode; trailingIcon?: boolean }) {
  return (
    <button
      type="button"
      className="inline-flex min-h-[46px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/86 dark:hover:border-fuchsia-500/30 dark:hover:bg-white/[0.05]"
    >
      {icon}
      <span>{label}</span>
      {trailingIcon ? <ChevronDownIcon className="ml-1 text-slate-400 dark:text-white/40" /> : null}
    </button>
  );
}

function NotificationButton({ count }: { count: number }) {
  return (
    <button
      type="button"
      className="relative inline-flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/80 dark:hover:border-fuchsia-500/30 dark:hover:bg-white/[0.05]"
      aria-label="Notifications"
    >
      <BellIcon className="h-5 w-5" />
      {count > 0 ? (
        <span className="absolute right-2 top-2 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function UserChip({ name, email }: { name: string; email: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'AU';
  return (
    <div className="inline-flex min-h-[46px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/86">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(180deg,#c026d3,#7c3aed)] text-sm font-semibold text-white">{initials}</span>
      <span className="flex flex-col text-left leading-tight">
        <span className="font-medium">{name}</span>
        <span className="text-xs text-slate-500 dark:text-white/45">{email}</span>
      </span>
      <ChevronDownIcon className="text-slate-400 dark:text-white/36" />
    </div>
  );
}

function AttentionCard({ item }: { item: AttentionItem }) {
  const severityMap: Record<AttentionSeverity, { shell: string; accent: string; button: string }> = {
    critical: {
      shell: 'from-rose-500/16 to-transparent text-rose-300 dark:text-rose-200',
      accent: 'text-rose-500 dark:text-rose-300',
      button: 'border-rose-300/60 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/12 dark:text-rose-100 dark:hover:bg-rose-500/18',
    },
    warning: {
      shell: 'from-amber-500/16 to-transparent text-amber-300 dark:text-amber-200',
      accent: 'text-amber-500 dark:text-amber-300',
      button: 'border-amber-300/60 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/12 dark:text-amber-100 dark:hover:bg-amber-500/18',
    },
    notice: {
      shell: 'from-orange-500/16 to-transparent text-orange-300 dark:text-orange-200',
      accent: 'text-orange-500 dark:text-orange-300',
      button: 'border-orange-300/60 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-500/20 dark:bg-orange-500/12 dark:text-orange-100 dark:hover:bg-orange-500/18',
    },
    healthy: {
      shell: 'from-emerald-500/16 to-transparent text-emerald-300 dark:text-emerald-200',
      accent: 'text-emerald-500 dark:text-emerald-300',
      button: 'border-emerald-300/60 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/12 dark:text-emerald-100 dark:hover:bg-emerald-500/18',
    },
  };
  const theme = severityMap[item.severity];
  return (
    <article className="flex min-w-0 flex-1 items-center gap-4 px-2 py-3">
      <div className={classNames('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br', theme.shell)}>
        <AlertTriangleIcon className={classNames('h-5 w-5', theme.accent)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={classNames('truncate text-lg font-semibold', theme.accent)}>{item.title}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-white/58">{item.detail}</p>
      </div>
      <Link to={item.actionHref} className={classNames('inline-flex shrink-0 items-center rounded-xl border px-5 py-3 text-sm font-semibold transition', theme.button)}>{item.actionLabel}</Link>
    </article>
  );
}

function Sparkline({ series, className }: { series: number[]; className?: string }) {
  const width = 160;
  const height = 56;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = Math.max(max - min, 1);
  const points = series.map((value, index) => {
    const x = (index / Math.max(series.length - 1, 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });
  const linePath = points.join(' ');
  const areaPath = `${points[0]} ${points.slice(1).join(' ')} ${width},${height} 0,${height}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true">
      <polyline points={areaPath} fill="currentColor" opacity="0.15" />
      <polyline points={linePath} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MetricCard({ metric }: { metric: MetricCardData }) {
  return (
    <Panel className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionKicker>{metric.label}</SectionKicker>
          <div className="mt-5 flex items-end gap-3">
            <span className="text-5xl font-semibold tracking-tight text-slate-950 dark:text-white">{metric.value}</span>
            <TrendBadge direction={metric.direction} value={metric.delta} />
          </div>
          <p className="mt-3 text-sm text-slate-500 dark:text-white/56">vs previous {DEFAULT_DATE_RANGE} days</p>
        </div>
        <div className={classNames('flex h-16 w-16 items-center justify-center rounded-[22px] border bg-gradient-to-br', metric.tone)}>
          <MetricIcon icon={metric.icon} />
        </div>
      </div>
      <Sparkline series={metric.series.length ? metric.series : [0, 0, 0, 0, 0]} className={classNames('mt-6 h-16 w-full', metric.tone.split(' ').slice(-1).join(' '))} />
    </Panel>
  );
}

function CampaignStatusBadge({ status }: { status: TopCampaignRow['status'] }) {
  const theme =
    status === 'Healthy'
      ? 'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-500/22 dark:bg-emerald-500/10 dark:text-emerald-300'
      : status === 'Needs optimization'
        ? 'border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-500/22 dark:bg-amber-500/10 dark:text-amber-300'
        : 'border-rose-300/70 bg-rose-50 text-rose-700 dark:border-rose-500/22 dark:bg-rose-500/10 dark:text-rose-300';
  return <span className={classNames('inline-flex rounded-full border px-3 py-1 text-xs font-semibold', theme)}>{status}</span>;
}

function CampaignTable({ rows }: { rows: TopCampaignRow[] }) {
  return (
    <Panel className="overflow-hidden p-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <SectionKicker>Top Campaigns</SectionKicker>
          <p className="mt-3 text-sm text-slate-500 dark:text-white/56">Campaigns demanding budget, optimization, and pacing attention.</p>
        </div>
        <Link to="/campaigns" className="text-sm font-medium text-fuchsia-600 transition hover:text-fuchsia-500 dark:text-fuchsia-300">View all campaigns</Link>
      </div>
      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 dark:border-white/8">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/8">
          <thead className="bg-slate-50/70 dark:bg-white/[0.02]">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-white/35">
              <th className="px-6 py-4">Campaign</th>
              <th className="px-6 py-4">Spend</th>
              <th className="px-6 py-4">CTR</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/8">
            {rows.map((row) => (
              <tr key={row.id} className="bg-white/40 dark:bg-transparent">
                <td className="px-6 py-5 font-medium text-slate-900 dark:text-white">{row.name}</td>
                <td className="px-6 py-5 text-slate-700 dark:text-white/72">{row.spend}</td>
                <td className="px-6 py-5 text-slate-700 dark:text-white/72">{row.ctr}</td>
                <td className="px-6 py-5"><CampaignStatusBadge status={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function QuickNavigation({ items }: { items: QuickNavRow[] }) {
  return (
    <Panel className="p-7">
      <SectionKicker>Quick Navigation</SectionKicker>
      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <Link
            key={item.id}
            to={item.to}
            className="group flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white/60 px-5 py-4 transition hover:border-fuchsia-300 hover:bg-fuchsia-50/70 dark:border-white/8 dark:bg-white/[0.03] dark:hover:border-fuchsia-500/30 dark:hover:bg-white/[0.05]"
          >
            <div className="flex items-center gap-4">
              <div className={classNames('flex h-14 w-14 items-center justify-center rounded-2xl border bg-gradient-to-br', item.tone)}><QuickNavIcon icon={item.icon} /></div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{item.label}</p>
                <p className="text-sm text-slate-500 dark:text-white/55">{item.detail}</p>
              </div>
            </div>
            <ArrowRightIcon className="text-slate-400 transition group-hover:text-fuchsia-500 dark:text-white/30 dark:group-hover:text-fuchsia-300" />
          </Link>
        ))}
      </div>
    </Panel>
  );
}

function SystemHealth({ items }: { items: SystemHealthRow[] }) {
  return (
    <Panel className="p-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <SectionKicker>Delivery &amp; System Health</SectionKicker>
        </div>
        <Link to="/reporting" className="text-sm font-medium text-fuchsia-600 transition hover:text-fuchsia-500 dark:text-fuchsia-300">View system status</Link>
      </div>
      <div className="mt-6 space-y-3">
        {items.map((item) => {
          const tone =
            item.severity === 'positive'
              ? 'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-500/22 dark:bg-emerald-500/10 dark:text-emerald-300'
              : item.severity === 'critical'
                ? 'border-rose-300/70 bg-rose-50 text-rose-700 dark:border-rose-500/22 dark:bg-rose-500/10 dark:text-rose-300'
                : item.severity === 'warning'
                  ? 'border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-500/22 dark:bg-amber-500/10 dark:text-amber-300'
                  : 'border-orange-300/70 bg-orange-50 text-orange-700 dark:border-orange-500/22 dark:bg-orange-500/10 dark:text-orange-300';
          return (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white/60 px-5 py-4 dark:border-white/8 dark:bg-white/[0.03]">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{item.label}</p>
                <p className="text-sm text-slate-500 dark:text-white/52">{item.note}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-slate-900 dark:text-white">{item.value}</span>
                <span className={classNames('rounded-full border px-3 py-1 text-xs font-semibold', tone)}>{item.note}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function SegmentColumn({ title, items, positive }: { title: string; items: AudienceRow[]; positive: boolean }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
      <div className="mt-5 space-y-4">
        {items.map((item) => (
          <div key={item.id} className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-slate-700 dark:text-white/82">{item.name}</span>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-slate-500 dark:text-white/55">CTR {item.ctr}</span>
                <TrendBadge direction={item.direction} value={item.delta} />
              </div>
            </div>
            <div className="h-2.5 rounded-full bg-slate-200 dark:bg-white/8">
              <div
                className={classNames(
                  'h-full rounded-full',
                  positive ? 'bg-[linear-gradient(90deg,#22c55e,#86efac)]' : 'bg-[linear-gradient(90deg,#fb7185,#f97316)]',
                )}
                style={{ width: `${Math.max(8, Math.min(item.score, 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AudienceInsights({ topSegments, underperformingSegments }: { topSegments: AudienceRow[]; underperformingSegments: AudienceRow[] }) {
  return (
    <Panel className="p-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <SectionKicker>Audience Signal Insights</SectionKicker>
        </div>
        <Link to="/reporting" className="text-sm font-medium text-fuchsia-600 transition hover:text-fuchsia-500 dark:text-fuchsia-300">Explore all segments</Link>
      </div>
      <div className="mt-6 grid gap-10 xl:grid-cols-2">
        <SegmentColumn title="Top performing segments" items={topSegments} positive />
        <SegmentColumn title="Underperforming segments" items={underperformingSegments} positive={false} />
      </div>
    </Panel>
  );
}

function CardCustomizationPanel({
  open,
  visibleCards,
  activeSetupId,
  savedSetups,
  setupName,
  onSetupNameChange,
  onToggleCard,
  onApplySetup,
  onCreateSetup,
  onUpdateSetup,
  onReset,
}: {
  open: boolean;
  visibleCards: OverviewCardId[];
  activeSetupId: string;
  savedSetups: SavedOverviewSetup[];
  setupName: string;
  onSetupNameChange: (value: string) => void;
  onToggleCard: (cardId: OverviewCardId) => void;
  onApplySetup: (setupId: string) => void;
  onCreateSetup: () => void;
  onUpdateSetup: () => void;
  onReset: () => void;
}) {
  if (!open) return null;
  return (
    <Panel className="absolute right-0 top-[calc(100%+12px)] z-30 w-[360px] p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Customize cards</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-white/55">Show, hide, and save your overview setups.</p>
        </div>
        <button type="button" onClick={onReset} className="text-xs font-medium text-fuchsia-600 dark:text-fuchsia-300">Reset</button>
      </div>
      <div className="mt-4 space-y-3">
        <label className="block text-xs font-medium text-slate-500 dark:text-white/55">Saved setup</label>
        <select
          value={activeSetupId}
          onChange={(event) => onApplySetup(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-fuchsia-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
        >
          <option value={DEFAULT_SETUP_ID}>{DEFAULT_SETUP_NAME}</option>
          {savedSetups.map((setup) => (
            <option key={setup.id} value={setup.id}>{setup.name}</option>
          ))}
        </select>
      </div>
      <div className="mt-5 grid gap-2">
        {OVERVIEW_CARD_ORDER.map((cardId) => (
          <label key={cardId} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5 text-sm dark:border-white/8 dark:bg-white/[0.03]">
            <span className="font-medium text-slate-800 dark:text-white/88">{cardLabel(cardId)}</span>
            <input type="checkbox" checked={visibleCards.includes(cardId)} onChange={() => onToggleCard(cardId)} className="h-4 w-4 accent-fuchsia-500" />
          </label>
        ))}
      </div>
      <div className="mt-5 space-y-3 border-t border-slate-200 pt-4 dark:border-white/8">
        <label className="block text-xs font-medium text-slate-500 dark:text-white/55">Save current setup</label>
        <input
          value={setupName}
          onChange={(event) => onSetupNameChange(event.target.value)}
          placeholder="Ad ops morning view"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-fuchsia-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
        />
        <div className="flex gap-3">
          <button type="button" onClick={onCreateSetup} className="inline-flex flex-1 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#c026d3,#7c3aed)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(168,85,247,0.3)] transition hover:opacity-95">Save as new</button>
          <button type="button" onClick={onUpdateSetup} disabled={activeSetupId === DEFAULT_SETUP_ID} className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-fuchsia-300 hover:text-fuchsia-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-white dark:hover:border-fuchsia-500/30 dark:hover:text-fuchsia-300">Update current</button>
        </div>
      </div>
    </Panel>
  );
}

function cardLabel(cardId: OverviewCardId) {
  const labels: Record<OverviewCardId, string> = {
    spend: 'Spend',
    impressions: 'Impressions',
    ctr: 'CTR',
    engagements: 'Engagements',
    viewability: 'Viewability',
    topCampaigns: 'Top campaigns',
    quickNavigation: 'Quick navigation',
    systemHealth: 'System health',
    audienceInsights: 'Audience insights',
  };
  return labels[cardId];
}

export default function AdOpsOverview() {
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);
  const [campaignId, setCampaignId] = useState('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [userName, setUserName] = useState('Admin User');
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentStats, setCurrentStats] = useState<WorkspaceStats>({});
  const [previousStats, setPreviousStats] = useState<WorkspaceStats>({});
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [campaignBreakdown, setCampaignBreakdown] = useState<BreakdownItem[]>([]);
  const [tagBreakdown, setTagBreakdown] = useState<BreakdownItem[]>([]);
  const [creativeBreakdown, setCreativeBreakdown] = useState<BreakdownItem[]>([]);
  const [identitySegments, setIdentitySegments] = useState<SegmentBreakdownItem[]>([]);
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [visibleCards, setVisibleCards] = useState<OverviewCardId[]>(getDefaultVisibleCards());
  const [savedSetups, setSavedSetups] = useState<SavedOverviewSetup[]>([]);
  const [activeSetupId, setActiveSetupId] = useState(DEFAULT_SETUP_ID);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [setupName, setSetupName] = useState('');
  const preferenceSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setTheme(root.classList.contains('dark') ? 'dark' : 'light');
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchJson<{ preferences?: Record<string, unknown> }>('/v1/auth/preferences').catch(() => ({ preferences: {} })),
      loadAuthMe() as Promise<AuthPayload>,
      loadWorkspaces('ad_server').catch(() => [] as WorkspaceOption[]),
      fetchJson<{ campaigns?: Campaign[] }>('/v1/campaigns?scope=all').catch(() => ({ campaigns: [] })),
      fetchJson<{ tags?: Tag[] }>('/v1/tags?scope=all').catch(() => ({ tags: [] })),
      loadCreatives({ scope: 'all' }).catch(() => [] as Creative[]),
    ])
      .then(([prefPayload, authMe, workspaceList, campaignPayload, tagPayload, creativeList]) => {
        if (!active) return;
        const displayName = String(authMe?.user?.display_name ?? '').trim() || String(authMe?.user?.email ?? '').split('@')[0] || 'Admin';
        setUserName(displayName);
        setUserEmail(String(authMe?.user?.email ?? ''));
        setActiveWorkspaceId(authMe?.workspace?.id ?? '');
        setWorkspaces(workspaceList);
        setCampaigns(campaignPayload.campaigns ?? []);
        setTags(tagPayload.tags ?? []);
        setCreatives(creativeList);
        const preferences = (prefPayload?.preferences ?? {}) as Record<string, unknown>;
        const layout = preferences[OVERVIEW_LAYOUT_PREFERENCE_KEY] as OverviewPreferences | undefined;
        const preferredTheme = preferences[THEME_PREFERENCE_KEY];
        if (preferredTheme === 'dark' || preferredTheme === 'light') {
          applyTheme(preferredTheme);
          persistTheme(preferredTheme);
          setTheme(preferredTheme);
        }
        setVisibleCards(normalizeCardOrder(layout?.visibleCards));
        setSavedSetups(sanitizeSetups(layout?.savedSetups));
        setActiveSetupId(typeof layout?.activeSetupId === 'string' ? layout.activeSetupId : DEFAULT_SETUP_ID);
        setPreferencesLoaded(true);
      })
      .catch((loadError: any) => {
        if (!active) return;
        setError(loadError.message ?? 'Failed to load overview.');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    if (preferenceSaveTimer.current) clearTimeout(preferenceSaveTimer.current);
    preferenceSaveTimer.current = setTimeout(() => {
      void fetchJson('/v1/auth/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          preferences: {
            [OVERVIEW_LAYOUT_PREFERENCE_KEY]: {
              visibleCards,
              savedSetups,
              activeSetupId,
            },
          },
        }),
      }).catch(() => undefined);
    }, 300);
    return () => {
      if (preferenceSaveTimer.current) clearTimeout(preferenceSaveTimer.current);
    };
  }, [preferencesLoaded, visibleCards, savedSetups, activeSetupId]);

  useEffect(() => {
    const dateFrom = getDateFrom(dateRange);
    const dateTo = new Date().toISOString().slice(0, 10);
    const previousRange = getPreviousRange(dateRange);
    const currentQuery = buildQuery({ dateFrom, dateTo, campaignId });
    const previousQuery = buildQuery({ dateFrom: previousRange.dateFrom, dateTo: previousRange.dateTo, campaignId });
    setLoading(true);
    setError('');
    Promise.all([
      fetchJson<{ stats?: WorkspaceStats; timeline?: TimelinePoint[] }>(`/v1/reporting/workspace${currentQuery}`),
      fetchJson<{ stats?: WorkspaceStats }>(`/v1/reporting/workspace${previousQuery}`),
      fetchJson<{ breakdown?: BreakdownItem[] }>(`/v1/reporting/workspace/campaign-breakdown${currentQuery}`),
      fetchJson<{ breakdown?: BreakdownItem[] }>(`/v1/reporting/workspace/tag-breakdown${currentQuery}`),
      fetchJson<{ breakdown?: BreakdownItem[] }>(`/v1/reporting/workspace/creative-breakdown${currentQuery}`),
      fetchJson<{ breakdown?: SegmentBreakdownItem[] }>(`/v1/reporting/workspace/identity-segment-presets${currentQuery}`).catch(() => ({ breakdown: [] })),
    ])
      .then(([currentPayload, previousPayload, campaignPayload, tagPayload, creativePayload, segmentPayload]) => {
        setCurrentStats(currentPayload.stats ?? {});
        setPreviousStats(previousPayload.stats ?? {});
        setTimeline(Array.isArray(currentPayload.timeline) ? currentPayload.timeline : []);
        setCampaignBreakdown(campaignPayload.breakdown ?? []);
        setTagBreakdown(tagPayload.breakdown ?? []);
        setCreativeBreakdown(creativePayload.breakdown ?? []);
        setIdentitySegments(segmentPayload.breakdown ?? []);
      })
      .catch((loadError: any) => {
        setError(loadError.message ?? 'Failed to load overview metrics.');
      })
      .finally(() => setLoading(false));
  }, [dateRange, campaignId, activeWorkspaceId]);

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    const lowCtrCampaign = [...campaignBreakdown]
      .filter((item) => toNumber(item.impressions) > 0)
      .sort((left, right) => toNumber(left.ctr) - toNumber(right.ctr))[0];
    if (lowCtrCampaign) {
      const delta = computeDelta(toNumber(lowCtrCampaign.ctr), toNumber(previousStats.avg_ctr)).label;
      items.push({
        id: 'campaign-low-ctr',
        title: `Campaign “${lowCtrCampaign.name ?? lowCtrCampaign.label ?? 'Untitled'}”`,
        detail: `CTR ${fmtPctCompact(toNumber(lowCtrCampaign.ctr))} (${delta})`,
        actionLabel: 'Fix now',
        actionHref: '/campaigns',
        severity: toNumber(lowCtrCampaign.ctr) < 0.5 ? 'critical' : 'warning',
      });
    }

    const creativeDeliveryMap = new Map<string, number>();
    creativeBreakdown.forEach((item) => {
      creativeDeliveryMap.set(String(item.name ?? item.label ?? ''), toNumber(item.impressions));
    });
    const missingCreatives = creatives.filter((creative) => {
      const latestStatus = creative.latestVersion?.status;
      const ready = latestStatus === 'approved' || latestStatus === 'pending_review';
      return ready && toNumber(creativeDeliveryMap.get(creative.name) ?? 0) === 0;
    });
    items.push({
      id: 'creatives-without-delivery',
      title: missingCreatives.length ? `${missingCreatives.length} creatives without impressions` : 'Creatives delivery looks healthy',
      detail: missingCreatives.length ? 'Review performance and assignments' : 'All ready creatives have delivery in the selected range.',
      actionLabel: missingCreatives.length ? 'Review' : 'Open creatives',
      actionHref: '/creatives',
      severity: missingCreatives.length ? (missingCreatives.length > 2 ? 'warning' : 'notice') : 'healthy',
    });

    const inactiveTag = tags.find((tag) => tag.status !== 'active');
    const staleTag = !inactiveTag
      ? [...tagBreakdown].sort((left, right) => toNumber(left.impressions) - toNumber(right.impressions))[0]
      : null;
    if (inactiveTag || staleTag) {
      const name = inactiveTag?.name ?? staleTag?.name ?? staleTag?.label ?? 'Tag';
      const detail = inactiveTag
        ? `Status: ${inactiveTag.status}`
        : `Impressions ${fmtNum(toNumber(staleTag?.impressions))} in selected range`;
      items.push({
        id: 'tag-inactive',
        title: `Tag “${name}” needs review`,
        detail,
        actionLabel: 'Fix now',
        actionHref: '/tags',
        severity: inactiveTag ? 'notice' : 'warning',
      });
    }

    while (items.length < 3) {
      items.push({
        id: `healthy-${items.length}`,
        title: 'No additional blockers detected',
        detail: 'Delivery, tags, and creatives look stable for the current filters.',
        actionLabel: 'View reporting',
        actionHref: '/reporting',
        severity: 'healthy',
      });
    }

    return items.slice(0, 3);
  }, [campaignBreakdown, creatives, creativeBreakdown, previousStats.avg_ctr, tagBreakdown, tags]);

  const metricCards = useMemo<MetricCardData[]>(() => {
    const spendDelta = computeDelta(toNumber(currentStats.total_spend), toNumber(previousStats.total_spend));
    const impressionsDelta = computeDelta(toNumber(currentStats.total_impressions), toNumber(previousStats.total_impressions));
    const ctrDelta = computeDelta(toNumber(currentStats.avg_ctr), toNumber(previousStats.avg_ctr));
    const engagementsDelta = computeDelta(toNumber(currentStats.total_engagements), toNumber(previousStats.total_engagements));
    const viewabilityDelta = computeDelta(toNumber(currentStats.viewability_rate), toNumber(previousStats.viewability_rate));
    const safeTimeline = timeline.length ? [...timeline].reverse() : [];
    return [
      {
        id: 'spend',
        label: 'Spend',
        value: fmtCurrency(toNumber(currentStats.total_spend)),
        delta: spendDelta.label,
        direction: spendDelta.direction,
        icon: 'spend',
        tone: 'from-emerald-400/20 via-emerald-500/12 to-transparent text-emerald-400 dark:text-emerald-300',
        series: safeTimeline.map((point) => toNumber(point.spend)),
      },
      {
        id: 'impressions',
        label: 'Impressions',
        value: fmtNum(toNumber(currentStats.total_impressions)),
        delta: impressionsDelta.label,
        direction: impressionsDelta.direction,
        icon: 'impressions',
        tone: 'from-sky-400/20 via-sky-500/12 to-transparent text-sky-400 dark:text-sky-300',
        series: safeTimeline.map((point) => toNumber(point.impressions)),
      },
      {
        id: 'ctr',
        label: 'CTR',
        value: fmtPctCompact(toNumber(currentStats.avg_ctr)),
        delta: ctrDelta.label,
        direction: ctrDelta.direction,
        icon: 'ctr',
        tone: 'from-fuchsia-400/20 via-fuchsia-500/12 to-transparent text-fuchsia-400 dark:text-fuchsia-300',
        series: safeTimeline.map((point) => toNumber(point.ctr)),
      },
      {
        id: 'engagements',
        label: 'Engagements',
        value: fmtNum(toNumber(currentStats.total_engagements)),
        delta: engagementsDelta.label,
        direction: engagementsDelta.direction,
        icon: 'engagements',
        tone: 'from-violet-400/20 via-violet-500/12 to-transparent text-violet-400 dark:text-violet-300',
        series: safeTimeline.map((point) => toNumber(point.clicks)),
      },
      {
        id: 'viewability',
        label: 'Viewability',
        value: fmtPctCompact(toNumber(currentStats.viewability_rate)),
        delta: viewabilityDelta.label,
        direction: viewabilityDelta.direction,
        icon: 'viewability',
        tone: 'from-amber-400/20 via-orange-500/12 to-transparent text-amber-500 dark:text-amber-300',
        series: safeTimeline.map((point) => toNumber(point.viewability_rate)),
      },
    ];
  }, [currentStats, previousStats, timeline]);

  const topCampaignRows = useMemo<TopCampaignRow[]>(() => {
    return [...campaignBreakdown]
      .sort((left, right) => toNumber(right.spend) - toNumber(left.spend))
      .slice(0, 4)
      .map((item) => {
        const ctr = toNumber(item.ctr);
        return {
          id: String(item.id ?? item.name ?? item.label ?? Math.random()),
          name: String(item.name ?? item.label ?? 'Untitled campaign'),
          spend: fmtCurrency(toNumber(item.spend)),
          ctr: fmtPctCompact(ctr),
          status: ctr >= 1 ? 'Healthy' : ctr >= 0.5 ? 'Needs optimization' : 'Critical',
        };
      });
  }, [campaignBreakdown]);

  const quickNavRows = useMemo<QuickNavRow[]>(() => {
    const activeCampaignCount = campaigns.filter((item) => item.status === 'active').length;
    const activeTagCount = tags.filter((item) => item.status === 'active').length;
    const inactiveTagCount = tags.filter((item) => item.status !== 'active').length;
    const lowCtrCampaignCount = campaignBreakdown.filter((item) => toNumber(item.ctr) > 0 && toNumber(item.ctr) < 0.5).length;
    const lowCtrCreatives = creativeBreakdown.filter((item) => toNumber(item.ctr) > 0 && toNumber(item.ctr) < 0.5).length;
    const activeCreatives = creatives.filter((item) => item.latestVersion?.status === 'approved' || item.latestVersion?.status === 'pending_review').length;
    return [
      { id: 'campaigns', label: 'Campaigns', detail: `${activeCampaignCount} active / ${lowCtrCampaignCount} issues`, to: '/campaigns', icon: 'campaigns', tone: 'from-violet-500/30 to-fuchsia-500/10 text-violet-300' },
      { id: 'creatives', label: 'Creatives', detail: `${activeCreatives} ready / ${lowCtrCreatives} low CTR`, to: '/creatives', icon: 'creatives', tone: 'from-fuchsia-500/30 to-rose-500/10 text-fuchsia-300' },
      { id: 'tags', label: 'Tags', detail: `${activeTagCount} live / ${inactiveTagCount} inactive`, to: '/tags', icon: 'tags', tone: 'from-amber-500/30 to-orange-500/10 text-amber-300' },
      { id: 'analytics', label: 'Analytics', detail: 'Full reporting & insights', to: '/reporting', icon: 'analytics', tone: 'from-sky-500/30 to-cyan-500/10 text-sky-300' },
    ];
  }, [campaignBreakdown, campaigns, creativeBreakdown, creatives, tags]);

  const systemHealthRows = useMemo<SystemHealthRow[]>(() => {
    const liveTags = tags.filter((item) => item.status === 'active').length;
    const liveCreatives = creatives.filter((item) => item.latestVersion?.status === 'approved').length;
    const missingCreatives = creatives.filter((creative) => {
      const latestStatus = creative.latestVersion?.status;
      const ready = latestStatus === 'approved' || latestStatus === 'pending_review';
      if (!ready) return false;
      const breakdown = creativeBreakdown.find((item) => String(item.name ?? item.label ?? '') === creative.name);
      return toNumber(breakdown?.impressions) === 0;
    }).length;
    return [
      { id: 'tags-live', label: 'Tags live', value: `${liveTags}/${Math.max(tags.length, 1)}`, note: `${Math.max(tags.length - liveTags, 0)} inactive`, severity: liveTags === tags.length ? 'positive' : 'notice' },
      { id: 'creatives-live', label: 'Creatives live', value: `${liveCreatives}`, note: `${missingCreatives} without delivery`, severity: missingCreatives === 0 ? 'positive' : 'warning' },
      { id: 'fill-rate', label: 'Fill rate', value: fmtPctCompact(toNumber(currentStats.measurable_rate)), note: toNumber(currentStats.measurable_rate) < 80 ? 'Below expected' : 'Healthy', severity: toNumber(currentStats.measurable_rate) < 65 ? 'critical' : toNumber(currentStats.measurable_rate) < 80 ? 'warning' : 'positive' },
      { id: 'ad-requests', label: 'Ad requests', value: fmtNum(toNumber(currentStats.total_impressions)), note: computeDelta(toNumber(currentStats.total_impressions), toNumber(previousStats.total_impressions)).label, severity: 'positive' },
      { id: 'errors', label: 'Errors', value: fmtPct(0), note: 'Low', severity: 'positive' },
    ];
  }, [creativeBreakdown, creatives, currentStats, previousStats.total_impressions, tags]);

  const audience = useMemo(() => {
    const normalized = identitySegments
      .map((item, index) => {
        const delta = computeDelta(toNumber(item.clicks), Math.max(toNumber(item.impressions) - toNumber(item.clicks), 0));
        return {
          id: `${item.label ?? item.name ?? index}`,
          name: String(item.label ?? item.name ?? 'Unknown segment'),
          ctr: fmtPctCompact(toNumber(item.ctr)),
          delta: delta.label,
          direction: delta.direction,
          score: Math.max(8, Math.min(toNumber(item.ctr) * 40, 100)),
        };
      })
      .sort((left, right) => parseFloat(right.ctr) - parseFloat(left.ctr));

    const topSegments = normalized.slice(0, 3);
    const underperformingSegments = [...normalized].reverse().slice(0, 3);

    if (!topSegments.length) {
      return {
        topSegments: [{ id: 'top-empty', name: 'No segment data yet', ctr: '0.0%', delta: '0%', direction: 'flat' as TrendDirection, score: 8 }],
        underperformingSegments: [{ id: 'under-empty', name: 'No segment data yet', ctr: '0.0%', delta: '0%', direction: 'flat' as TrendDirection, score: 8 }],
      };
    }

    return { topSegments, underperformingSegments };
  }, [identitySegments]);

  const visibleMetricCards = metricCards.filter((metric) => visibleCards.includes(metric.id));
  const showCard = (cardId: OverviewCardId) => visibleCards.includes(cardId);
  const issueCount = attentionItems.filter((item) => item.severity !== 'healthy').length;
  const selectedWorkspaceName = workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.name ?? 'Workspace';

  const toggleTheme = async () => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    persistTheme(nextTheme);
    setTheme(nextTheme);
    try {
      await fetchJson('/v1/auth/preferences', {
        method: 'PUT',
        body: JSON.stringify({ preferences: { [THEME_PREFERENCE_KEY]: nextTheme } }),
      });
    } catch {
      // Keep local theme even if save fails.
    }
  };

  const toggleVisibleCard = (cardId: OverviewCardId) => {
    setVisibleCards((current) => {
      if (current.includes(cardId)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== cardId);
      }
      return normalizeCardOrder([...current, cardId]);
    });
    setActiveSetupId(DEFAULT_SETUP_ID);
  };

  const applySetup = (setupId: string) => {
    if (setupId === DEFAULT_SETUP_ID) {
      setVisibleCards(getDefaultVisibleCards());
      setActiveSetupId(DEFAULT_SETUP_ID);
      return;
    }
    const setup = savedSetups.find((item) => item.id === setupId);
    if (!setup) return;
    setVisibleCards(normalizeCardOrder(setup.cards));
    setActiveSetupId(setup.id);
    setSetupName(setup.name);
  };

  const createSetup = () => {
    const name = setupName.trim();
    if (!name) return;
    const id = `setup-${Date.now()}`;
    const nextSetup = { id, name, cards: visibleCards } satisfies SavedOverviewSetup;
    setSavedSetups((current) => [...current, nextSetup]);
    setActiveSetupId(id);
    setSetupName('');
  };

  const updateSetup = () => {
    if (activeSetupId === DEFAULT_SETUP_ID) return;
    setSavedSetups((current) => current.map((setup) => (
      setup.id === activeSetupId
        ? { ...setup, cards: visibleCards, name: setupName.trim() || setup.name }
        : setup
    )));
    setSetupName('');
  };

  const resetLayout = () => {
    setVisibleCards(getDefaultVisibleCards());
    setActiveSetupId(DEFAULT_SETUP_ID);
    setSetupName('');
  };

  const handleWorkspaceChange = async (nextWorkspaceId: string) => {
    if (!nextWorkspaceId || nextWorkspaceId === activeWorkspaceId) return;
    try {
      await switchWorkspace(nextWorkspaceId);
      setActiveWorkspaceId(nextWorkspaceId);
      setCampaignId('');
    } catch (workspaceError: any) {
      setError(workspaceError.message ?? 'Failed to switch workspace.');
    }
  };

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.08),transparent_26%),radial-gradient(circle_at_70%_20%,rgba(124,58,237,0.1),transparent_24%)] px-8 py-8 text-slate-950 dark:text-white">
      <div className="mx-auto max-w-[1680px]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[230px]">
              <select
                value={activeWorkspaceId}
                onChange={(event) => void handleWorkspaceChange(event.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm text-slate-700 outline-none transition focus:border-fuchsia-400 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white"
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/36" />
            </div>
            <select
              value={String(dateRange)}
              onChange={(event) => setDateRange(Number(event.target.value) as DateRange)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-fuchsia-400 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
            <select
              value={campaignId}
              onChange={(event) => setCampaignId(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-fuchsia-400 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white"
            >
              <option value="">All campaigns</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <button type="button" onClick={() => setCustomizerOpen((current) => !current)} className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/86 dark:hover:border-fuchsia-500/20 dark:hover:bg-white/[0.05]">
                <LayoutGridIcon className="text-slate-500 dark:text-white/60" />
                Customize cards
              </button>
              <CardCustomizationPanel
                open={customizerOpen}
                visibleCards={visibleCards}
                activeSetupId={activeSetupId}
                savedSetups={savedSetups}
                setupName={setupName}
                onSetupNameChange={setSetupName}
                onToggleCard={toggleVisibleCard}
                onApplySetup={applySetup}
                onCreateSetup={createSetup}
                onUpdateSetup={updateSetup}
                onReset={resetLayout}
              />
            </div>
            <button type="button" onClick={() => void toggleTheme()} className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/86 dark:hover:border-fuchsia-500/20 dark:hover:bg-white/[0.05]">
              <EyeIcon className="text-slate-500 dark:text-white/60" />
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <NotificationButton count={issueCount} />
            <UserChip name={userName} email={userEmail} />
            <Link to="/campaigns/new" className="inline-flex min-h-[46px] items-center rounded-xl bg-[linear-gradient(135deg,#c026d3,#7c3aed)] px-5 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(168,85,247,0.35)] transition hover:translate-y-[-1px] hover:shadow-[0_18px_42px_rgba(168,85,247,0.42)]">
              + New campaign
            </Link>
          </div>
        </div>

        <header className="mt-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-700 dark:border-fuchsia-500/15 dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
            Agency overview
            <span className="h-1 w-1 rounded-full bg-current opacity-60" />
            {selectedWorkspaceName}
          </div>
          <h1 className="text-5xl font-semibold tracking-tight text-slate-950 dark:text-white">Good morning, {userName.split(' ')[0] || 'Admin'}</h1>
          <p className="mt-3 text-xl text-slate-600 dark:text-white/62">This is your command center across clients. Use the client selector to pivot the overview, alerts, and health signals.</p>
        </header>

        {error ? <div className="mt-6 rounded-2xl border border-rose-300 bg-rose-50 px-5 py-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">{error}</div> : null}

        <Panel className="mt-8 p-6">
          <div className="flex items-center justify-between gap-4">
            <SectionKicker>What needs attention</SectionKicker>
            <Link to="/reporting" className="text-sm font-medium text-fuchsia-600 dark:text-fuchsia-300">View all issues ({issueCount})</Link>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            {attentionItems.map((item) => (
              <AttentionCard key={item.id} item={item} />
            ))}
          </div>
        </Panel>

        {loading ? <div className="mt-8 text-sm text-slate-500 dark:text-white/56">Loading overview…</div> : null}

        <div className="mt-8 grid gap-5 xl:grid-cols-5">
          {visibleMetricCards.map((metric) => <MetricCard key={metric.id} metric={metric} />)}
        </div>

        <div className="mt-8 grid gap-5 xl:grid-cols-[1.45fr_1fr_1fr]">
          {showCard('topCampaigns') ? <CampaignTable rows={topCampaignRows} /> : null}
          {showCard('quickNavigation') ? <QuickNavigation items={quickNavRows} /> : null}
          {showCard('systemHealth') ? <SystemHealth items={systemHealthRows} /> : null}
        </div>

        {showCard('audienceInsights') ? (
          <div className="mt-8">
            <AudienceInsights topSegments={audience.topSegments} underperformingSegments={audience.underperformingSegments} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MetricIcon({ icon }: { icon: MetricCardData['icon'] }) {
  switch (icon) {
    case 'spend':
      return <CurrencyIcon className="h-7 w-7" />;
    case 'impressions':
      return <EyeIcon className="h-7 w-7" />;
    case 'ctr':
      return <TargetIcon className="h-7 w-7" />;
    case 'engagements':
      return <CursorClickIcon className="h-7 w-7" />;
    case 'viewability':
      return <VisibilityIcon className="h-7 w-7" />;
  }
}

function QuickNavIcon({ icon }: { icon: QuickNavRow['icon'] }) {
  switch (icon) {
    case 'campaigns':
      return <CampaignIcon className="h-6 w-6" />;
    case 'creatives':
      return <CreativeIcon className="h-6 w-6" />;
    case 'tags':
      return <TagIcon className="h-6 w-6" />;
    case 'analytics':
      return <ChartIcon className="h-6 w-6" />;
  }
}

function iconProps(className?: string) {
  return { className: classNames('h-5 w-5', className), viewBox: '0 0 24 24', fill: 'none' } as const;
}

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const BellIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 0 1-6 0h6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const AlertTriangleIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}><path d="M12 4 3.5 19h17L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M12 9v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="16" r="1" fill="currentColor" /></svg>
);
const ArrowRightIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const WorkspaceIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}><rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" /><rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" /><rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" /><rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" /></svg>
);
const LayoutGridIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}><rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" /><rect x="13" y="4" width="7" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.7" /><rect x="13" y="10" width="7" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.7" /><rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" /></svg>
);
const CurrencyIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}><path d="M12 4v16M16 7.5c0-1.9-1.8-3.5-4-3.5s-4 1.6-4 3.5 1.8 3.5 4 3.5 4 1.6 4 3.5-1.8 3.5-4 3.5-4-1.6-4-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const EyeIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" /></svg>
);
const TargetIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}><circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" /><path d="M12 2v3M22 12h-3M12 22v-3M2 12h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
);
const CursorClickIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}><path d="m8 4 8 8-4 1 1 5-3 1-1-5-3 1V4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M16 4v3M19 7h-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
);
const VisibilityIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M9 12a3 3 0 0 0 6 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
);
const CampaignIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}><rect x="4" y="5" width="16" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.8" /><rect x="4" y="11" width="16" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.8" /><rect x="4" y="17" width="10" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.8" /></svg>
);
const CreativeIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" /><path d="m7 15 3-3 3 2 4-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9" cy="9" r="1.5" fill="currentColor" /></svg>
);
const TagIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}><path d="M4 10V4h6l8 8-6 6-8-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" /></svg>
);
const ChartIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}><path d="M5 17V9M12 17V5M19 17v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M3 20h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
);
