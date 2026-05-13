import type { MetricScope } from '../system/metrics/registry';

export interface TagMetricData {
  totalTags: number;
  activeTags: number;
  readyTags: number;
  draftTags: number;
  needsAttentionCount: number;
  healthyRate: number;
}

export const tagMetricScope: MetricScope<TagMetricData> = {
  id: 'tags',
  defaultIds: ['tag-health', 'low-firing', 'ready-tags', 'missing-tags'],
  metrics: [
    {
      id: 'tag-health',
      label: 'Signal health',
      description: 'Share of signal-eligible active tags that are receiving impressions.',
      group: 'Health',
      tone: 'brand',
      compute: ({ totalTags, healthyRate }) => {
        if (totalTags === 0) return null;
        return {
          id: 'tag-health',
          label: 'Signal health',
          value: `${healthyRate}%`,
          tone: healthyRate >= 80 ? 'success' : healthyRate >= 60 ? 'warning' : 'critical',
          context: 'Only evaluates active tags after signal is expected',
        };
      },
    },
    {
      id: 'low-firing',
      label: 'Signal gaps',
      description: 'Active tags older than 7 days with no impressions.',
      group: 'Risk',
      tone: 'warning',
      compute: ({ needsAttentionCount }) => ({
        id: 'low-firing',
        label: 'Signal gaps',
        value: String(needsAttentionCount),
        tone: needsAttentionCount > 0 ? 'warning' : 'success',
        context: 'Active 7+ days with no impressions',
      }),
    },
    {
      id: 'ready-tags',
      label: 'Ready tags',
      description: 'Generated tags ready to share.',
      group: 'Readiness',
      tone: 'success',
      compute: ({ readyTags }) => ({
        id: 'ready-tags',
        label: 'Ready tags',
        value: String(readyTags),
        tone: 'success',
        context: 'Generated and ready to share',
      }),
    },
    {
      id: 'missing-tags',
      label: 'Draft tags',
      description: 'Tags still in setup.',
      group: 'Setup',
      tone: 'neutral',
      compute: ({ draftTags }) => ({
        id: 'missing-tags',
        label: 'Draft tags',
        value: String(draftTags),
        tone: 'neutral',
        context: 'Not counted as signal risk',
      }),
    },
    {
      id: 'active-tags',
      label: 'Firing tags',
      description: 'Tags actively producing signals.',
      group: 'Delivery',
      tone: 'info',
      compute: ({ activeTags }) => ({
        id: 'active-tags',
        label: 'Firing tags',
        value: String(activeTags),
        tone: 'info',
        context: 'Healthy signal flow',
      }),
    },
    {
      id: 'visible-tags',
      label: 'Visible tags',
      description: 'Total tags in the current filter scope.',
      group: 'Workspace',
      tone: 'neutral',
      compute: ({ totalTags }) => ({
        id: 'visible-tags',
        label: 'Visible tags',
        value: String(totalTags),
        tone: 'neutral',
        context: 'Current filter scope',
      }),
    },
  ],
};
