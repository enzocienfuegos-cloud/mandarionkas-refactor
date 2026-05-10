import type { MetricScope } from '../system/metrics/registry';
import { fmtNum, fmtPct, toNumber } from '../overview/overview.utils';
import type { Discrepancy, DiscrepancySummary } from './discrepancy-view/types';

export interface DiscrepancyMetricData {
  summary: DiscrepancySummary | null;
  rows: Discrepancy[];
  withinThreshold: number;
}

export const discrepancyMetricScope: MetricScope<DiscrepancyMetricData> = {
  id: 'discrepancies',
  defaultIds: ['variance-health', 'threshold-breaches', 'resolved', 'critical-count'],
  metrics: [
    {
      id: 'variance-health',
      label: 'Variance health',
      description: 'Share of reports within threshold.',
      group: 'Health',
      tone: 'success',
      compute: ({ summary, withinThreshold, rows }) => {
        const total = summary?.totalReports ?? rows.length;
        if (total === 0) return null;
        const pct = (withinThreshold / total) * 100;
        return {
          id: 'variance-health',
          label: 'Variance health',
          value: fmtPct(pct),
          tone: pct >= 80 ? 'success' : pct >= 60 ? 'warning' : 'critical',
          context: `${withinThreshold} of ${total} within threshold`,
        };
      },
    },
    {
      id: 'critical-count',
      label: 'Critical breaches',
      description: 'Reports above critical threshold.',
      group: 'Risk',
      tone: 'critical',
      compute: ({ summary, rows }) => {
        const value = summary?.criticalCount ?? rows.filter((row) => row.severity === 'critical').length;
        return {
          id: 'critical-count',
          label: 'Critical breaches',
          value: String(value),
          tone: value === 0 ? 'success' : 'critical',
          context: 'Reports above critical threshold',
        };
      },
    },
    {
      id: 'warning-count',
      label: 'Warning breaches',
      description: 'Reports above warning threshold.',
      group: 'Risk',
      tone: 'warning',
      compute: ({ summary, rows }) => {
        const value = summary?.warningCount ?? rows.filter((row) => row.severity === 'warning').length;
        return {
          id: 'warning-count',
          label: 'Warning breaches',
          value: String(value),
          tone: value === 0 ? 'success' : 'warning',
          context: 'Reports above warning threshold',
        };
      },
    },
    {
      id: 'threshold-breaches',
      label: 'Threshold breaches',
      description: 'Total reports above any threshold.',
      group: 'Risk',
      tone: 'warning',
      compute: ({ summary, rows }) => {
        const critical = summary?.criticalCount ?? rows.filter((row) => row.severity === 'critical').length;
        const warning = summary?.warningCount ?? rows.filter((row) => row.severity === 'warning').length;
        const total = critical + warning;
        return {
          id: 'threshold-breaches',
          label: 'Threshold breaches',
          value: String(total),
          tone: total === 0 ? 'success' : total <= 3 ? 'warning' : 'critical',
          context: `${critical} critical · ${warning} warning`,
        };
      },
    },
    {
      id: 'resolved',
      label: 'Resolved',
      description: 'Reports already within threshold.',
      group: 'Health',
      tone: 'success',
      compute: ({ withinThreshold }) => ({
        id: 'resolved',
        label: 'Resolved',
        value: String(withinThreshold),
        tone: 'success',
        context: 'Reports within threshold',
      }),
    },
    {
      id: 'avg-delta',
      label: 'Avg variance',
      description: 'Mean delta % across all reports.',
      group: 'Trend',
      tone: 'info',
      compute: ({ rows }) => {
        if (rows.length === 0) return null;
        const total = rows.reduce((sum, row) => sum + Math.abs(toNumber(row.deltaPct)), 0);
        const mean = total / rows.length;
        return {
          id: 'avg-delta',
          label: 'Avg variance',
          value: fmtPct(mean),
          tone: mean <= 5 ? 'success' : mean <= 10 ? 'warning' : 'critical',
          context: `Mean across ${rows.length} reports`,
        };
      },
    },
    {
      id: 'unmatched-impressions',
      label: 'Unmatched impressions',
      description: 'Sum of |served − reported| across critical reports.',
      group: 'Risk',
      tone: 'critical',
      compute: ({ rows }) => {
        const critical = rows.filter((row) => row.severity === 'critical');
        if (critical.length === 0) return null;
        const total = critical.reduce((sum, row) => sum + Math.abs(toNumber(row.servedImpressions) - toNumber(row.reportedImpressions)), 0);
        return {
          id: 'unmatched-impressions',
          label: 'Unmatched impressions',
          value: fmtNum(total),
          tone: 'critical',
          context: `Across ${critical.length} critical reports`,
        };
      },
    },
  ],
};
