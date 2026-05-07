import type { CreativeArtifact, CreativeVersion } from '../catalog';

export interface ActionState {
  versionId: string;
  type: 'approve' | 'reject';
  notes: string;
  reason: string;
  loading: boolean;
  error: string;
}

export interface QaState {
  versionId: string;
  loading: boolean;
  error: string;
  version: CreativeVersion | null;
  artifacts: CreativeArtifact[];
}

export interface PreviewState {
  url: string;
  name: string;
  width: number;
  height: number;
  kind: 'html' | 'video';
}
