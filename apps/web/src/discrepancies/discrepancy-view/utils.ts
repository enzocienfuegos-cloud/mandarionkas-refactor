import type {
  DiscrepancyStatus,
  PrioritySeverity,
} from './types';

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function discrepancyStatusBadge(status: DiscrepancyStatus) {
  const map: Record<DiscrepancyStatus, string> = {
    'Within threshold': 'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-500/22 dark:bg-emerald-500/10 dark:text-emerald-300',
    Investigating: 'border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-500/22 dark:bg-amber-500/10 dark:text-amber-300',
    'Threshold breach': 'border-rose-300/70 bg-rose-50 text-rose-700 dark:border-rose-500/22 dark:bg-rose-500/10 dark:text-rose-300',
    Resolved: 'border-sky-300/70 bg-sky-50 text-sky-700 dark:border-sky-500/22 dark:bg-sky-500/10 dark:text-sky-300',
    'Needs publisher': 'border-slate-300/70 bg-slate-50 text-slate-700 dark:border-white/12 dark:bg-white/[0.05] dark:text-white/70',
  };
  return map[status];
}

export function severityBadge(severity: PrioritySeverity) {
  const map: Record<PrioritySeverity, string> = {
    Critical: 'border-rose-300/70 bg-rose-50 text-rose-700 dark:border-rose-500/22 dark:bg-rose-500/10 dark:text-rose-300',
    Warning: 'border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-500/22 dark:bg-amber-500/10 dark:text-amber-300',
    Notice: 'border-sky-300/70 bg-sky-50 text-sky-700 dark:border-sky-500/22 dark:bg-sky-500/10 dark:text-sky-300',
  };
  return map[severity];
}

export function formatNumber(value: number) {
  return value.toLocaleString();
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 1 }).format(value);
}

export function parseCount(value: string) {
  return Number(value.replace(/,/g, '')) || 0;
}
