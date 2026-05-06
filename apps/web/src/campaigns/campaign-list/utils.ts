import type { CampaignStatus, Tone, TrendDirection } from './types';

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function toNumber(val: unknown) {
  const n = Number(val ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function formatCompactMoney(value: number) {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value);
}

export function formatDateRange(start?: string | null, end?: string | null) {
  const fmt = (val?: string | null) =>
    val ? new Date(val).toLocaleDateString(undefined, { month: 'short', day: '2-digit' }) : null;
  const s = fmt(start);
  const e = fmt(end);
  if (s && e) return `${s} - ${e}`;
  if (s) return `${s} - …`;
  return 'Always on';
}

export function computeDelta(current: number, previous: number) {
  if (previous <= 0 && current <= 0) return { direction: 'flat' as TrendDirection, label: '0%' };
  if (previous <= 0) return { direction: 'up' as TrendDirection, label: '+100%' };
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.1) return { direction: 'flat' as TrendDirection, label: '0%' };
  return {
    direction: change > 0 ? 'up' as TrendDirection : 'down' as TrendDirection,
    label: `${change > 0 ? '+' : ''}${change.toFixed(1)}%`,
  };
}

export function toneClass(tone: Tone) {
  const map: Record<Tone, string> = {
    fuchsia: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-600 dark:border-fuchsia-500/18 dark:bg-fuchsia-500/10 dark:text-fuchsia-300',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/18 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber: 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/18 dark:bg-amber-500/10 dark:text-amber-300',
    rose: 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/18 dark:bg-rose-500/10 dark:text-rose-300',
    sky: 'border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-500/18 dark:bg-sky-500/10 dark:text-sky-300',
    slate: 'border-border-default bg-[color:var(--dusk-surface-muted)] text-text-muted dark:border-white/8 dark:bg-surface-1/[0.04] dark:text-white/70',
  };
  return map[tone];
}

export function statusBadge(status: CampaignStatus) {
  const map: Record<CampaignStatus, string> = {
    Live: 'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/25 dark:text-emerald-300',
    Limited: 'border-amber-300/70 bg-amber-50 text-[color:var(--dusk-status-warning-fg)] dark:border-amber-500/40 dark:bg-amber-500/25 dark:text-amber-300',
    Blocked: 'border-rose-300/70 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/25 dark:text-rose-300',
    Ready: 'border-sky-300/70 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/25 dark:text-sky-300',
    Draft: 'border-border-strong/70 bg-[color:var(--dusk-surface-muted)] text-text-secondary dark:border-white/20 dark:bg-surface-1/[0.12] dark:text-white/70',
  };
  return map[status];
}
