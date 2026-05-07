import type { MetricScope } from '../system/metrics/registry';

export interface CreativeMetricData {
  creativeEligibility: number;
  pendingQaCreatives: number;
  approvedCreatives: number;
  rejectedCreatives: number;
  missingCreatives: number;
  filteredCreativeCount: number;
}

export const creativeMetricScope: MetricScope<CreativeMetricData> = {
  id: 'creatives',
  defaultIds: ['creative-health', 'creative-qa', 'creative-approved', 'creative-blocked'],
  metrics: [
    {
      id: 'creative-health',
      label: 'Creative eligibility',
      description: 'Approved or ready creatives in current scope.',
      group: 'Health',
      tone: 'brand',
      compute: ({ filteredCreativeCount, creativeEligibility }) => {
        if (filteredCreativeCount === 0) return null;
        return {
          id: 'creative-health',
          label: 'Creative eligibility',
          value: `${creativeEligibility}%`,
          tone: creativeEligibility >= 80 ? 'success' : creativeEligibility >= 60 ? 'warning' : 'critical',
          context: 'Approved or ready for activation',
        };
      },
    },
    {
      id: 'creative-qa',
      label: 'Pending QA',
      description: 'Creatives waiting on spec or clickthrough review.',
      group: 'QA',
      tone: 'warning',
      compute: ({ pendingQaCreatives }) => ({
        id: 'creative-qa',
        label: 'Pending QA',
        value: String(pendingQaCreatives),
        tone: pendingQaCreatives > 0 ? 'warning' : 'success',
        context: 'Need spec and clickthrough review',
      }),
    },
    {
      id: 'creative-approved',
      label: 'Approved',
      description: 'Creatives eligible to traffic now.',
      group: 'QA',
      tone: 'success',
      compute: ({ approvedCreatives }) => ({
        id: 'creative-approved',
        label: 'Approved',
        value: String(approvedCreatives),
        tone: 'success',
        context: 'Eligible creatives in active campaigns',
      }),
    },
    {
      id: 'creative-blocked',
      label: 'Blocked creatives',
      description: 'Rejected or missing assets.',
      group: 'Risk',
      tone: 'critical',
      compute: ({ rejectedCreatives, missingCreatives }) => ({
        id: 'creative-blocked',
        label: 'Blocked creatives',
        value: String(rejectedCreatives + missingCreatives),
        tone: rejectedCreatives + missingCreatives > 0 ? 'critical' : 'success',
        context: 'Rejected or missing assets',
      }),
    },
    {
      id: 'missing-assets',
      label: 'Missing assets',
      description: 'Creatives lacking a previewable version.',
      group: 'Risk',
      tone: 'warning',
      compute: ({ missingCreatives }) => ({
        id: 'missing-assets',
        label: 'Missing assets',
        value: String(missingCreatives),
        tone: missingCreatives > 0 ? 'warning' : 'success',
        context: 'Assets missing preview or latest version',
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
