import type { ExportValidationIssue } from '../domain/document/export-validation';
import type { ReleaseTarget } from '../domain/document/types';
import type { ExportChannelProfile } from './adapters';
import type { MraidHandoff, MraidHostFeature } from './mraid-handoff';

export type ExportReadiness = {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  blockers: number;
  warnings: number;
  checklist: Array<{ label: string; passed: boolean }>;
  targetChannel: ReleaseTarget;
  qaStatus: string;
  channelProfile: Pick<ExportChannelProfile, 'id' | 'label' | 'family' | 'deliveryMode' | 'exitStrategy' | 'supportedSizes'>;
  hostRequirements?: {
    requiredFeatures: MraidHostFeature[];
    expectedPlacementType: MraidHandoff['placementType'];
  };
};

export type ChannelRequirement = {
  id: string;
  label: string;
  passed: boolean;
  severity?: 'warning' | 'error';
};

export type ExportManifest = {
  documentId: string;
  documentName: string;
  exportedAt: string;
  canvas: { width: number; height: number; backgroundColor: string };
  activeVariant: string;
  activeFeedSource: string;
  activeFeedRecordId: string;
  sceneCount: number;
  widgetCount: number;
  actionCount: number;
  targetChannel: ReleaseTarget;
  channelProfile: Pick<ExportChannelProfile, 'id' | 'label' | 'family' | 'deliveryMode' | 'exitStrategy' | 'supportedSizes'>;
  qaStatus: string;
  issues: ExportValidationIssue[];
  channelChecklist: ChannelRequirement[];
  handoff?: {
    mraid?: MraidHandoff;
  };
};
