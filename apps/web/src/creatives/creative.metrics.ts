import type { MetricScope } from '../system/metrics/registry';

export interface CreativeMetricData {
  creativeAvailability: number;
  publishingCreatives: number;
  liveCreatives: number;
  attentionCreatives: number;
  previewMissingCreatives: number;
  filteredCreativeCount: number;
}

export const creativeMetricScope: MetricScope<CreativeMetricData> = {
  id: 'creatives',
  defaultIds: ['creative-availability', 'creative-publishing', 'creative-live', 'creative-attention'],
  metrics: [
    {
      id: 'creative-availability',
      label: 'Creative availability',
      description: 'Creatives that are live and ready to serve in the current scope.',
      group: 'Health',
      tone: 'brand',
      compute: ({ filteredCreativeCount, creativeAvailability }) => {
        if (filteredCreativeCount === 0) return null;
        return {
          id: 'creative-availability',
          label: 'Creative availability',
          value: `${creativeAvailability}%`,
          tone: creativeAvailability >= 80 ? 'success' : creativeAvailability >= 60 ? 'warning' : 'critical',
          context: 'Live and ready for activation',
        };
      },
    },
    {
      id: 'creative-publishing',
      label: 'Publishing',
      description: 'Creatives still being published, transcoded or prepared for preview.',
      group: 'Pipeline',
      tone: 'info',
      compute: ({ publishingCreatives }) => ({
        id: 'creative-publishing',
        label: 'Publishing',
        value: String(publishingCreatives),
        tone: publishingCreatives > 0 ? 'info' : 'success',
        context: 'Still processing before they go live',
      }),
    },
    {
      id: 'creative-live',
      label: 'Live',
      description: 'Creatives currently available to serve.',
      group: 'Delivery',
      tone: 'success',
      compute: ({ liveCreatives }) => ({
        id: 'creative-live',
        label: 'Live',
        value: String(liveCreatives),
        tone: 'success',
        context: 'Serving-ready creatives in this scope',
      }),
    },
    {
      id: 'creative-attention',
      label: 'Needs attention',
      description: 'Creatives blocked by upload, asset processing, or missing destination URL issues.',
      group: 'Risk',
      tone: 'critical',
      compute: ({ attentionCreatives }) => ({
        id: 'creative-attention',
        label: 'Needs attention',
        value: String(attentionCreatives),
        tone: attentionCreatives > 0 ? 'critical' : 'success',
        context: 'Upload, asset, or URL issues',
      }),
    },
    {
      id: 'missing-preview',
      label: 'Preview missing',
      description: 'Creatives that still lack a previewable asset.',
      group: 'Risk',
      tone: 'warning',
      compute: ({ previewMissingCreatives }) => ({
        id: 'missing-preview',
        label: 'Preview missing',
        value: String(previewMissingCreatives),
        tone: previewMissingCreatives > 0 ? 'warning' : 'success',
        context: 'Creatives without a preview asset yet',
      }),
    },
    {
      id: 'visible-creatives',
      label: 'Visible creatives',
      description: 'Creatives in the current filter scope.',
      group: 'Workspace',
      tone: 'neutral',
      compute: ({ filteredCreativeCount }) => ({
        id: 'visible-creatives',
        label: 'Visible creatives',
        value: String(filteredCreativeCount),
        tone: 'neutral',
        context: 'Current filter scope',
      }),
    },
  ],
};
