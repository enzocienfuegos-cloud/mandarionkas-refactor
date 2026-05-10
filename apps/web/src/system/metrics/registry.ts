import type { MetricTone } from '../primitives/MetricCard';

export type MetricTrend = 'up' | 'down' | 'flat';

export type MetricIconKind =
  | 'spend'
  | 'impressions'
  | 'ctr'
  | 'engagements'
  | 'viewability'
  | 'clicks'
  | 'ecpc'
  | 'ecpm'
  | 'ecpv'
  | 'conversions'
  | 'cvr'
  | 'roas'
  | 'viewable_imps'
  | 'attention'
  | 'in_view_time'
  | 'video_starts'
  | 'video_completes'
  | 'vtr'
  | 'completion_rate'
  | 'unique_users'
  | 'reach'
  | 'frequency'
  | 'dwell'
  | 'fraud_rate'
  | 'ivt'
  | 'mfa'
  | 'brand_safety';

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
