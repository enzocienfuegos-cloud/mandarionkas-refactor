import type { MetricScope } from '../system/metrics/registry';
import { fmtNum } from '../overview/overview.utils';
import type { PacingCampaign, PacingData } from './pacing-view/types';

export interface PacingMetricData {
  data: PacingData | null;
  rows: PacingCampaign[];
}

function toNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export const pacingMetricScope: MetricScope<PacingMetricData> = {
  id: 'pacing',
  defaultIds: ['pacing-health', 'pacing-exceptions', 'on-target', 'budget-risk'],
  metrics: [
    {
      id: 'pacing-health',
      label: 'Pacing health',
      description: 'Share of campaigns on track or ahead.',
      group: 'Health',
      tone: 'success',
      compute: ({ data }) => {
        if (!data || data.summary.active === 0) return null;
        const onTrackPct = (data.summary.onTrack / data.summary.active) * 100;
        return {
          id: 'pacing-health',
          label: 'Pacing health',
          value: `${onTrackPct.toFixed(1)}%`,
          tone: onTrackPct >= 80 ? 'success' : onTrackPct >= 60 ? 'warning' : 'critical',
          context: `${data.summary.onTrack} of ${data.summary.active} campaigns on track`,
        };
      },
    },
    {
      id: 'pacing-exceptions',
      label: 'Pacing exceptions',
      description: 'Campaigns that need delivery review.',
      group: 'Health',
      tone: 'warning',
      compute: ({ data }) => {
        if (!data) return null;
        return {
          id: 'pacing-exceptions',
          label: 'Pacing exceptions',
          value: String(data.summary.behind),
          tone: data.summary.behind > 0 ? 'warning' : 'success',
          context: `${data.summary.behind} campaigns behind goal`,
        };
      },
    },
    {
      id: 'on-target',
      label: 'On target',
      description: 'Campaigns within ±20% of expected pacing.',
      group: 'Health',
      tone: 'success',
      compute: ({ rows }) => {
        if (rows.length === 0) return null;
        const onTarget = rows.filter((row) => {
          const pct = toNumber(row.pacingPct);
          return pct >= 80 && pct <= 120;
        }).length;
        return {
          id: 'on-target',
          label: 'On target',
          value: String(onTarget),
          tone: 'success',
          context: 'Within ±20% of expected pacing',
        };
      },
    },
    {
      id: 'total-served',
      label: 'Total served',
      description: 'Cumulative impressions delivered across active campaigns.',
      group: 'Delivery',
      tone: 'brand',
      compute: ({ data }) => {
        if (!data) return null;
        return {
          id: 'total-served',
          label: 'Total served',
          value: fmtNum(data.summary.totalServed),
          tone: 'brand',
          context: `Across ${data.summary.active} active campaigns`,
        };
      },
    },
    {
      id: 'remaining-goal',
      label: 'Remaining to goal',
      description: 'Sum of impression goals minus impressions served.',
      group: 'Delivery',
      tone: 'info',
      compute: ({ rows }) => {
        const remaining = rows.reduce((sum, row) => {
          const goal = toNumber(row.impressionGoal);
          const served = toNumber(row.impressionsServed);
          return sum + Math.max(0, goal - served);
        }, 0);
        if (remaining === 0) return null;
        return {
          id: 'remaining-goal',
          label: 'Remaining to goal',
          value: fmtNum(remaining),
          tone: 'info',
          context: 'Aggregate impressions left across active campaigns',
        };
      },
    },
    {
      id: 'avg-delivery-pct',
      label: 'Avg delivery %',
      description: 'Mean delivery percentage across active campaigns.',
      group: 'Health',
      tone: 'info',
      compute: ({ rows }) => {
        const active = rows.filter((row) => toNumber(row.deliveryPct) >= 0);
        if (active.length === 0) return null;
        const mean = active.reduce((sum, row) => sum + toNumber(row.deliveryPct), 0) / active.length;
        return {
          id: 'avg-delivery-pct',
          label: 'Avg delivery %',
          value: `${mean.toFixed(1)}%`,
          tone: mean >= 80 ? 'success' : mean >= 60 ? 'warning' : 'critical',
          context: `Mean across ${active.length} active campaigns`,
        };
      },
    },
    {
      id: 'budget-risk',
      label: 'Budget risk',
      description: 'Campaigns with <60% pacing and <7 days remaining.',
      group: 'Risk',
      tone: 'critical',
      compute: ({ rows }) => {
        const atRisk = rows.filter((row) => toNumber(row.pacingPct) < 60 && toNumber(row.remainingDays) < 7).length;
        return {
          id: 'budget-risk',
          label: 'Budget risk',
          value: String(atRisk),
          tone: atRisk === 0 ? 'success' : atRisk <= 2 ? 'warning' : 'critical',
          context: 'Pacing under 60% with less than 7 days left',
        };
      },
    },
  ],
};
