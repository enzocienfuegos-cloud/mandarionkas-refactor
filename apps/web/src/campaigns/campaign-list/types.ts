import type { SpendView } from '../../shared/costing';

export type Severity = 'critical' | 'warning' | 'notice' | 'healthy';
export type TrendDirection = 'up' | 'down' | 'flat';
export type Tone = 'fuchsia' | 'emerald' | 'amber' | 'rose' | 'sky' | 'slate';
export type IconProps = { className?: string };
export type CampaignStatus = 'Live' | 'Paused' | 'Ready' | 'Draft' | 'Archived';

export interface Campaign {
  id: string;
  workspace_id?: string;
  workspace_name?: string;
  name: string;
  advertiser?: { id: string; name: string };
  metadata?: {
    dsp?: string | null;
    estimatedRate?: number | null;
    markupPercent?: number | null;
    servingFeeCpm?: number | null;
    budgetDeliveryMode?: string | null;
    rateStrategy?: string | null;
    servingCostMode?: string | null;
  };
  status: 'active' | 'paused' | 'archived' | 'draft';
  startDate: string | null;
  endDate: string | null;
  start_date?: string | null;
  end_date?: string | null;
  budget?: number | null;
  impressionGoal: number | null;
  impression_goal?: number | null;
  dailyBudget: number | null;
  impressions?: number | string | null;
  clicks?: number | string | null;
  ctr?: number | string | null;
  engagement_rate?: number | string | null;
  engagementRate?: number | string | null;
  viewability_rate?: number | string | null;
  viewabilityRate?: number | string | null;
  total_hover_duration_ms?: number | string | null;
  totalHoverDurationMs?: number | string | null;
}

export type CampaignRow = {
  id: string;
  campaign: string;
  advertiser: string;
  status: CampaignStatus;
  pacing: string;
  spend: string;
  spendValue: number;
  budget: string;
  budgetValue: number;
  tagHealth: string;
  creativeStatus: string;
  issues: number;
  owner: string;
  flight: string;
  raw: Campaign;
};

export type CampaignSpendView = SpendView;

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
