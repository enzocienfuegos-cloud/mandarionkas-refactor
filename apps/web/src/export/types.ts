import type { ExportValidationIssue } from '../domain/document/export-validation';
import type { ReleaseTarget } from '../types/release-targets';

export type ExportReadiness = {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  blockers: number;
  warnings: number;
  checklist: Array<{ label: string; passed: boolean }>;
  targetChannel: ReleaseTarget;
  qaStatus: string;
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
  qaStatus: string;
  issues: ExportValidationIssue[];
  channelChecklist: ChannelRequirement[];
};
