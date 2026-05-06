import type {
  CreativeIngestion,
  CreativeSizeVariant,
  CreativeVersion,
  TagBinding,
  VideoRendition,
} from '../catalog';

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

export interface BindingState {
  creativeId: string;
  creativeName: string;
  versionId: string;
  servingFormat: string;
  tagId: string;
  loading: boolean;
  error: string;
  bindingsLoading: boolean;
  bindings: TagBinding[];
}

export interface VariantState {
  creativeId: string;
  creativeName: string;
  versionId: string;
  loading: boolean;
  error: string;
  variants: CreativeSizeVariant[];
  selectedVariantIds: string[];
  form: {
    label: string;
    width: string;
    height: string;
  };
}

export interface VideoRenditionState {
  creativeId: string;
  creativeName: string;
  workspaceId?: string | null;
  versionId: string;
  loading: boolean;
  error: string;
  version: CreativeVersion | null;
  renditions: VideoRendition[];
  pendingIngestion: CreativeIngestion | null;
  awaitingPublish: boolean;
}

export interface RegenerationFeedbackState {
  active: boolean;
  startedAt: number;
  elapsedMs: number;
  stageLabel: string;
  progressPercent: number;
}

export interface PreviewModalState {
  url: string;
  width: number;
  height: number;
  name: string;
  kind: 'html' | 'video';
}

export interface ClickUrlEditorState {
  creativeId: string;
  creativeName: string;
  workspaceId?: string | null;
  value: string;
  loading: boolean;
  error: string;
}

export interface QuickCreateTagState {
  suggestedFormat: string;
  creativeName: string;
  name: string;
  loading: boolean;
  error: string;
}
