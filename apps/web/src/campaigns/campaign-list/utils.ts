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
    fuchsia: 'border-brand-500/30 bg-brand-500/10 text-text-brand',
    emerald: 'border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)] text-[color:var(--dusk-status-success-fg)]',
    amber: 'border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)]',
    rose: 'border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] text-[color:var(--dusk-status-critical-fg)]',
    sky: 'border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)]',
    slate: 'border-[color:var(--dusk-status-neutral-border)] bg-[color:var(--dusk-status-neutral-bg)] text-[color:var(--dusk-status-neutral-fg)]',
  };
  return map[tone];
}

export function statusBadge(status: CampaignStatus) {
  const map: Record<CampaignStatus, string> = {
    Live: 'border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)] text-[color:var(--dusk-status-success-fg)]',
    Paused: 'border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)]',
    Ready: 'border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)]',
    Draft: 'border-[color:var(--dusk-status-neutral-border)] bg-[color:var(--dusk-status-neutral-bg)] text-[color:var(--dusk-status-neutral-fg)]',
    Archived: 'border-[color:var(--dusk-status-neutral-border)] bg-[color:var(--dusk-status-neutral-bg)] text-[color:var(--dusk-status-neutral-fg)]',
  };
  return map[status];
}
