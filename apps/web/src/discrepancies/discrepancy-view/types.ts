export type Severity = 'ok' | 'warning' | 'critical';
export type TrendDirection = 'up' | 'down' | 'flat';
export type Tone = 'fuchsia' | 'emerald' | 'amber' | 'rose' | 'sky' | 'slate';
export type PrioritySeverity = 'Critical' | 'Warning' | 'Notice';
export type DiscrepancyStatus = 'Within threshold' | 'Investigating' | 'Threshold breach' | 'Resolved' | 'Needs publisher';

export interface Discrepancy {
  id: string;
  tagId: string;
  tagName: string;
  date: string;
  source: string;
  servedImpressions: number;
  reportedImpressions: number;
  deltaPct: number;
  severity: Severity;
}

export interface DiscrepancySummary {
  totalReports: number;
  criticalCount: number;
  warningCount: number;
}

export interface Thresholds {
  warningPct: number;
  criticalPct: number;
}

export interface Filters {
  dateFrom: string;
  dateTo: string;
  severity: string;
}

export type Metric = {
  id: string;
  label: string;
  value: string;
  delta: string;
  direction: TrendDirection;
  helper: string;
  tone: Tone;
  series: number[];
};

export type DiscrepancyRow = {
  id: string;
  campaign: string;
  advertiser: string;
  publisher: string;
  status: DiscrepancyStatus;
  adserver: string;
  publisherReported: string;
  variance: string;
  threshold: string;
  risk: PrioritySeverity;
  owner: string;
};
