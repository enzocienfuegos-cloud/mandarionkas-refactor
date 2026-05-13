export interface Tag {
  id: string;
  workspaceId?: string | null;
  workspaceName?: string | null;
  name: string;
  campaign: { id: string; name: string } | null;
  format: 'VAST' | 'display' | 'native' | 'tracker';
  status: 'active' | 'paused' | 'archived' | 'draft';
  sizeLabel?: string;
  clickUrl?: string;
  servingWidth?: number | null;
  servingHeight?: number | null;
  trackerType?: 'click' | 'impression' | null;
  assignedCount?: number;
  assignedNames?: string;
  totalImpressions?: number;
  lastImpressionAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export type TrendDirection = 'up' | 'down' | 'flat';
export type Tone = 'fuchsia' | 'emerald' | 'amber' | 'rose' | 'sky' | 'slate';
export type PrioritySeverity = 'Critical' | 'Warning' | 'Notice';
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

export type CreateTagForm = {
  workspaceId: string;
  name: string;
  campaignId: string;
  format: Tag['format'];
  status: Tag['status'];
  servingWidth: string;
  servingHeight: string;
  trackerType: 'click' | 'impression';
  clickUrl: string;
};

export const DISPLAY_SIZE_PRESETS = [
  { label: '300x250', width: 300, height: 250 },
  { label: '320x50', width: 320, height: 50 },
  { label: '320x100', width: 320, height: 100 },
  { label: '336x280', width: 336, height: 280 },
  { label: '728x90', width: 728, height: 90 },
  { label: '970x250', width: 970, height: 250 },
  { label: '160x600', width: 160, height: 600 },
  { label: '300x600', width: 300, height: 600 },
];

export const EMPTY_CREATE_FORM: CreateTagForm = {
  workspaceId: '',
  name: '',
  campaignId: '',
  format: 'display',
  status: 'draft',
  servingWidth: '',
  servingHeight: '',
  trackerType: 'click',
  clickUrl: '',
};
