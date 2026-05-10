import type { MetricScope } from '../system/metrics/registry';
import type { TimelinePoint, WorkspaceStats } from './overview.types';
import { computeDelta } from './overview.utils';
import { fmtCurrency, fmtNum, fmtPct, toNumber } from './overview.utils';

export interface OverviewMetricData {
  currentStats: WorkspaceStats;
  previousStats: WorkspaceStats;
  timeline: TimelinePoint[];
  attentionItemsCount: number;
}

function safeSeries<T>(timeline: T[], extract: (point: T) => number) {
  return timeline.length ? [...timeline].reverse().map(extract) : [];
}

export const overviewMetricScope: MetricScope<OverviewMetricData> = {
  id: 'overview',
  defaultIds: ['spend', 'impressions', 'ctr', 'engagements'],
  metrics: [
    {
      id: 'spend',
      label: 'Total spend',
      description: 'Sum of delivered media cost in the selected range.',
      group: 'Budget',
      tone: 'info',
      icon: 'spend',
      compute: ({ currentStats, previousStats, timeline }) => {
        if (currentStats.total_spend == null) return null;
        const value = toNumber(currentStats.total_spend);
        const hasPrevious = previousStats.total_spend != null;
        const delta = computeDelta(value, toNumber(previousStats.total_spend));
        return {
          id: 'spend',
          label: 'Total spend',
          value: fmtCurrency(value),
          delta: hasPrevious ? delta.label : undefined,
          direction: hasPrevious ? delta.direction : undefined,
          tone: 'info',
          icon: 'spend',
          series: safeSeries(timeline, (point) => toNumber(point.spend)),
          context: 'Tracked across live campaign budgets',
        };
      },
    },
    {
      id: 'impressions',
      label: 'Impressions',
      description: 'Total impressions delivered in the range.',
      group: 'Delivery',
      tone: 'brand',
      icon: 'impressions',
      compute: ({ currentStats, previousStats, timeline }) => {
        if (currentStats.total_impressions == null) return null;
        const value = toNumber(currentStats.total_impressions);
        const hasPrevious = previousStats.total_impressions != null;
        const delta = computeDelta(value, toNumber(previousStats.total_impressions));
        return {
          id: 'impressions',
          label: 'Impressions',
          value: fmtNum(value),
          delta: hasPrevious ? delta.label : undefined,
          direction: hasPrevious ? delta.direction : undefined,
          tone: 'brand',
          icon: 'impressions',
          series: safeSeries(timeline, (point) => toNumber(point.impressions)),
          context: 'Signals captured in the selected range',
        };
      },
    },
    {
      id: 'ctr',
      label: 'CTR',
      description: 'Click-through rate (clicks / impressions).',
      group: 'Engagement',
      tone: 'success',
      icon: 'ctr',
      compute: ({ currentStats, previousStats, timeline }) => {
        if (currentStats.avg_ctr == null) return null;
        const value = toNumber(currentStats.avg_ctr);
        const hasPrevious = previousStats.avg_ctr != null;
        const delta = computeDelta(value, toNumber(previousStats.avg_ctr));
        return {
          id: 'ctr',
          label: 'CTR',
          value: fmtPct(value),
          delta: hasPrevious ? delta.label : undefined,
          direction: hasPrevious ? delta.direction : undefined,
          tone: 'success',
          icon: 'ctr',
          series: safeSeries(timeline, (point) => toNumber(point.ctr)),
          context: 'Average click-through rate across active tags',
        };
      },
    },
    {
      id: 'clicks',
      label: 'Clicks',
      description: 'Total clicks recorded in the range.',
      group: 'Engagement',
      tone: 'brand',
      compute: ({ currentStats, previousStats, timeline }) => {
        if (currentStats.total_clicks == null) return null;
        const value = toNumber(currentStats.total_clicks);
        const hasPrevious = previousStats.total_clicks != null;
        const delta = computeDelta(value, toNumber(previousStats.total_clicks));
        return {
          id: 'clicks',
          label: 'Clicks',
          value: fmtNum(value),
          delta: hasPrevious ? delta.label : undefined,
          direction: hasPrevious ? delta.direction : undefined,
          tone: 'brand',
          series: safeSeries(timeline, (point) => toNumber(point.clicks)),
          context: 'Total click signals captured',
        };
      },
    },
    {
      id: 'engagements',
      label: 'Engagements',
      description: 'Total engagement signals (hovers, expansions, plays).',
      group: 'Engagement',
      tone: 'critical',
      icon: 'engagements',
      compute: ({ currentStats, previousStats }) => {
        if (currentStats.total_engagements == null) return null;
        const value = toNumber(currentStats.total_engagements);
        const hasPrevious = previousStats.total_engagements != null;
        const delta = computeDelta(value, toNumber(previousStats.total_engagements));
        return {
          id: 'engagements',
          label: 'Engagements',
          value: fmtNum(value),
          delta: hasPrevious ? delta.label : undefined,
          direction: hasPrevious ? delta.direction : undefined,
          tone: 'critical',
          icon: 'engagements',
          context: 'Hovers, expansions, and play interactions',
        };
      },
    },
    {
      id: 'viewability',
      label: 'Viewability',
      description: 'Share of impressions that met IAB viewability standard.',
      group: 'QA',
      tone: 'info',
      icon: 'viewability',
      compute: ({ currentStats, previousStats, timeline }) => {
        if (currentStats.viewability_rate == null) return null;
        const value = toNumber(currentStats.viewability_rate);
        const hasPrevious = previousStats.viewability_rate != null;
        const delta = computeDelta(value, toNumber(previousStats.viewability_rate));
        return {
          id: 'viewability',
          label: 'Viewability',
          value: fmtPct(value),
          delta: hasPrevious ? delta.label : undefined,
          direction: hasPrevious ? delta.direction : undefined,
          tone: 'info',
          icon: 'viewability',
          series: safeSeries(timeline, (point) => toNumber(point.viewability_rate)),
          context: 'IAB viewability across live campaigns',
        };
      },
    },
    {
      id: 'measurability',
      label: 'Measurability',
      description: 'Share of impressions that returned a measurement signal.',
      group: 'QA',
      tone: 'info',
      compute: ({ currentStats, previousStats }) => {
        if (currentStats.measurable_rate == null) return null;
        const value = toNumber(currentStats.measurable_rate);
        const hasPrevious = previousStats.measurable_rate != null;
        const delta = computeDelta(value, toNumber(previousStats.measurable_rate));
        return {
          id: 'measurability',
          label: 'Measurability',
          value: fmtPct(value),
          delta: hasPrevious ? delta.label : undefined,
          direction: hasPrevious ? delta.direction : undefined,
          tone: 'info',
          context: 'Inventory able to report measurement signals',
        };
      },
    },
    {
      id: 'cpm',
      label: 'eCPM',
      description: 'Effective cost per thousand impressions.',
      group: 'Budget',
      tone: 'info',
      compute: ({ currentStats }) => {
        const spend = currentStats.total_spend;
        const impressions = currentStats.total_impressions;
        if (spend == null || impressions == null || toNumber(impressions) <= 0) return null;
        const value = (toNumber(spend) / toNumber(impressions)) * 1000;
        return {
          id: 'cpm',
          label: 'eCPM',
          value: fmtCurrency(value),
          tone: 'info',
          context: 'Calculated as spend ÷ impressions × 1000',
        };
      },
    },
    {
      id: 'cpc',
      label: 'eCPC',
      description: 'Effective cost per click.',
      group: 'Budget',
      tone: 'info',
      compute: ({ currentStats }) => {
        const spend = currentStats.total_spend;
        const clicks = currentStats.total_clicks;
        if (spend == null || clicks == null || toNumber(clicks) <= 0) return null;
        const value = toNumber(spend) / toNumber(clicks);
        return {
          id: 'cpc',
          label: 'eCPC',
          value: fmtCurrency(value),
          tone: 'info',
          context: 'Calculated as spend ÷ clicks',
        };
      },
    },
    {
      id: 'active-campaigns',
      label: 'Active campaigns',
      description: 'Count of campaigns currently delivering.',
      group: 'Workspace',
      tone: 'neutral',
      compute: ({ currentStats }) => {
        if (currentStats.active_campaigns == null) return null;
        return {
          id: 'active-campaigns',
          label: 'Active campaigns',
          value: fmtNum(toNumber(currentStats.active_campaigns)),
          tone: 'neutral',
          context: 'Currently eligible to deliver',
        };
      },
    },
    {
      id: 'active-tags',
      label: 'Active tags',
      description: 'Count of tags currently firing.',
      group: 'Workspace',
      tone: 'neutral',
      compute: ({ currentStats }) => {
        if (currentStats.active_tags == null) return null;
        return {
          id: 'active-tags',
          label: 'Active tags',
          value: fmtNum(toNumber(currentStats.active_tags)),
          tone: 'neutral',
          context: 'Tags producing impressions today',
        };
      },
    },
    {
      id: 'creatives-count',
      label: 'Creatives',
      description: 'Total creative assets in the workspace.',
      group: 'Workspace',
      tone: 'neutral',
      compute: ({ currentStats }) => {
        if (currentStats.total_creatives == null) return null;
        return {
          id: 'creatives-count',
          label: 'Creatives',
          value: fmtNum(toNumber(currentStats.total_creatives)),
          tone: 'neutral',
          context: 'Assets in the current workspace',
        };
      },
    },
    {
      id: 'hover-time',
      label: 'Avg hover time',
      description: 'Average hover duration on rich creatives.',
      group: 'Engagement',
      tone: 'info',
      compute: ({ currentStats }) => {
        if (currentStats.total_hover_duration_ms == null || currentStats.total_impressions == null) return null;
        const impressions = toNumber(currentStats.total_impressions);
        if (impressions <= 0) return null;
        const avgMs = toNumber(currentStats.total_hover_duration_ms) / impressions;
        return {
          id: 'hover-time',
          label: 'Avg hover time',
          value: `${(avgMs / 1000).toFixed(2)}s`,
          tone: 'info',
          context: 'Average hover duration per impression',
        };
      },
    },
    {
      id: 'attention-items',
      label: 'Items needing review',
      description: 'Open critical or warning attention items.',
      group: 'QA',
      tone: 'critical',
      compute: ({ attentionItemsCount }) => ({
        id: 'attention-items',
        label: 'Items needing review',
        value: String(attentionItemsCount),
        tone: 'critical',
        context: `${attentionItemsCount} item${attentionItemsCount === 1 ? '' : 's'} require review`,
      }),
    },
  ],
};
