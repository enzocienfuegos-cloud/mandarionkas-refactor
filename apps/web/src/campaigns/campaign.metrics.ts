import type { SpendView } from '../shared/costing';
import type { MetricScope } from '../system/metrics/registry';
import { formatCompactMoney } from './campaign-list/utils';

export interface CampaignMetricData {
  liveCampaigns: number;
  blockedOrLimited: number;
  draftSetup: number;
  openIssues: number;
  trackedSpend: number;
  campaignCount: number;
  spendView: SpendView;
}

export const campaignMetricScope: MetricScope<CampaignMetricData> = {
  id: 'campaigns',
  defaultIds: ['live', 'blocked', 'spend', 'issues'],
  metrics: [
    {
      id: 'live',
      label: 'Live campaigns',
      description: 'Campaigns currently eligible to deliver.',
      group: 'Delivery',
      tone: 'brand',
      compute: ({ liveCampaigns }) => ({
        id: 'live',
        label: 'Live campaigns',
        value: String(liveCampaigns),
        tone: 'brand',
        context: 'Currently eligible to deliver',
      }),
    },
    {
      id: 'blocked',
      label: 'Blocked / limited',
      description: 'Campaigns requiring trafficking review.',
      group: 'Risk',
      tone: 'warning',
      compute: ({ blockedOrLimited }) => ({
        id: 'blocked',
        label: 'Blocked / limited',
        value: String(blockedOrLimited),
        tone: blockedOrLimited > 0 ? 'warning' : 'success',
        context: 'Need delivery review',
      }),
    },
    {
      id: 'spend',
      label: 'Spend tracked',
      description: 'Tracked weekly budget across visible campaigns.',
      group: 'Budget',
      tone: 'success',
      compute: ({ trackedSpend, spendView }) => ({
        id: 'spend',
        label: spendView === 'with_margin' ? 'Spend tracked (gross)' : 'Spend tracked (net)',
        value: formatCompactMoney(trackedSpend),
        tone: 'success',
        context: spendView === 'with_margin'
          ? 'Includes configured margin on visible campaigns'
          : 'Net of configured margin on visible campaigns',
      }),
    },
    {
      id: 'issues',
      label: 'Open issues',
      description: 'Tags, creatives, and pacing blockers.',
      group: 'Risk',
      tone: 'critical',
      compute: ({ openIssues }) => ({
        id: 'issues',
        label: 'Open issues',
        value: String(openIssues),
        tone: openIssues > 0 ? 'critical' : 'success',
        context: 'Tags, creatives and pacing',
      }),
    },
    {
      id: 'drafts',
      label: 'Draft / ready',
      description: 'Campaigns still in setup or not yet live.',
      group: 'Setup',
      tone: 'neutral',
      compute: ({ draftSetup }) => ({
        id: 'drafts',
        label: 'Draft / ready',
        value: String(draftSetup),
        tone: 'neutral',
        context: 'Setup before launch',
      }),
    },
    {
      id: 'total',
      label: 'Visible campaigns',
      description: 'Campaigns in the current view.',
      group: 'Workspace',
      tone: 'info',
      compute: ({ campaignCount }) => ({
        id: 'total',
        label: 'Visible campaigns',
        value: String(campaignCount),
        tone: 'info',
        context: 'Current filter scope',
      }),
    },
  ],
};
