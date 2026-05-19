import type { StudioState } from '../../domain/document/types';

export type ClientPreviewPin = {
  id: string;
  xPct: number;
  yPct: number;
  sceneIndex: number;
};

export type ClientPreviewComment = {
  id: string;
  threadId: string;
  pinId?: string;
  authorName: string;
  authorInitials: string;
  authorColor: string;
  body: string;
  createdAt: string;
  parentId?: string;
};

export type ClientPreviewThread = {
  id: string;
  pin?: ClientPreviewPin;
  comments: ClientPreviewComment[];
  resolvedAt?: string;
};

export type LoadedClientPreviewProject = {
  projectId: string;
  token: string;
  state: StudioState;
  publicAssetPathMap: Record<string, string>;
};
