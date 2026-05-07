import type { MetricTone } from '../primitives/MetricCard';

export type MetricTrend = 'up' | 'down' | 'flat';

export type MetricIconKind =
  | 'spend'
  | 'impressions'
  | 'ctr'
  | 'engagements'
  | 'viewability';

export interface ResolvedMetric {
  id: string;
  label: string;
  value: string;
  delta?: string;
  direction?: MetricTrend;
  context?: string;
  series?: number[];
  tone: MetricTone;
  icon?: MetricIconKind;
}

export interface MetricDefinition<TData = unknown> {
  id: string;
  label: string;
  description?: string;
  group: string;
  tone: MetricTone;
  icon?: MetricIconKind;
  compute: (data: TData) => ResolvedMetric | null;
}

export interface MetricScope<TData> {
  id: string;
  metrics: MetricDefinition<TData>[];
  defaultIds: string[];
}
