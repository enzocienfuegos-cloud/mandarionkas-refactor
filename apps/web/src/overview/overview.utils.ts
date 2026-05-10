import { type DateRange, type TrendDirection } from './overview.types';

export const DEFAULT_DATE_RANGE: DateRange = 7;

export function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function fmtNum(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function fmtCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

export function fmtPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function fmtPctCompact(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function getDateFrom(days: DateRange, now = new Date()): string {
  const copy = new Date(now);
  copy.setDate(copy.getDate() - (days - 1));
  return copy.toISOString().slice(0, 10);
}

export function getPreviousRange(days: DateRange, now = new Date()) {
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

export function buildQuery({ dateFrom, dateTo, campaignId }: { dateFrom: string; dateTo: string; campaignId?: string }) {
  const params = new URLSearchParams();
  params.set('dateFrom', dateFrom);
  params.set('dateTo', dateTo);
  params.set('limit', '12');
  if (campaignId) params.set('campaignId', campaignId);
  return `?${params.toString()}`;
}

export function computeDelta(current: number, previous: number): { direction: TrendDirection; label: string } {
  if (previous <= 0 && current <= 0) return { direction: 'flat', label: '0%' };
  if (previous <= 0) return { direction: 'up', label: '+100%' };
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.05) return { direction: 'flat', label: '0%' };
  return {
    direction: change >= 0 ? 'up' : 'down',
    label: `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`,
  };
}

export async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
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
