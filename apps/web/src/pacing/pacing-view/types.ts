export type TrendDirection = 'up' | 'down' | 'flat';
export type Tone = 'fuchsia' | 'emerald' | 'amber' | 'rose' | 'sky' | 'slate';
export type PrioritySeverity = 'Critical' | 'Warning' | 'Notice';
export type PacingStatus = 'On pace' | 'Underpacing' | 'Overpacing' | 'At risk' | 'Paused';

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

export type PacingRow = {
  id: string;
  campaign: string;
  advertiser: string;
  status: PacingStatus;
  pacing: string;
  pacingPct: number;
  spend: string;
  budget: string;
  dailyTarget: string;
  projected: string;
  risk: PrioritySeverity;
  owner: string;
};

export type RawPacingStatus = 'on_track' | 'behind' | 'ahead' | 'completed' | 'not_started' | 'no_goal';

export interface PacingCampaign {
  id: string;
  name: string;
  advertiser: string;
  status: RawPacingStatus;
  pacingPct: number;
  deliveryPct: number;
  impressionsServed: number;
  impressionGoal: number | null;
  remainingDays: number;
  startDate: string;
  endDate: string;
}

export interface PacingAlert {
  campaignId: string;
  campaignName: string;
  status: RawPacingStatus;
  message: string;
  severity: 'warning' | 'critical';
}

export interface PacingData {
  campaigns: PacingCampaign[];
  summary: {
    total: number;
    active: number;
    onTrack: number;
    behind: number;
    totalServed: number;
  };
}

export interface BreakdownDay {
  date: string;
  impressions: number;
  expected: number;
}

export type SortKey = 'campaign' | 'advertiser' | 'pacingPct' | 'deliveryPct' | 'remainingDays' | 'impressionsServed';
