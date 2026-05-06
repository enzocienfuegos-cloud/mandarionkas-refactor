export type TrendDirection = 'up' | 'down' | 'flat';
export type Tone = 'fuchsia' | 'emerald' | 'amber' | 'rose' | 'sky' | 'slate';
export type PrioritySeverity = 'Critical' | 'Warning' | 'Notice';
export type CreativeStatus = 'Approved' | 'Pending QA' | 'Rejected' | 'Ready' | 'Missing';
export type CreativeFormat = 'Display' | 'HTML5' | 'Video' | 'Native';
export type IconProps = { className?: string };

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

export type CreativeRow = {
  id: string;
  creative: string;
  advertiser: string;
  campaign: string;
  format: CreativeFormat;
  size: string;
  status: CreativeStatus;
  qa: PrioritySeverity;
  preview: string;
  owner: string;
};
