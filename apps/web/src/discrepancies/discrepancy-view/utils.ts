import type {
  DiscrepancyStatus,
  PrioritySeverity,
} from './types';

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function discrepancyStatusBadge(status: DiscrepancyStatus) {
  const map: Record<DiscrepancyStatus, string> = {
    'Within threshold': 'success',
    Investigating: 'warning',
    'Threshold breach': 'critical',
    Resolved: 'info',
    'Needs publisher': 'neutral',
  };
  return map[status];
}

export function severityBadge(severity: PrioritySeverity) {
  const map: Record<PrioritySeverity, string> = {
    Critical: 'critical',
    Warning: 'warning',
    Notice: 'info',
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
