import type { StudioState } from '../domain/document/types';
import type { AssetDraft, AssetRecord } from '../assets/types';
import type { ProjectAccessScope } from '../types/contracts/access-scopes';

export type ProjectSummary = {
  id: string;
  name: string;
  updatedAt: string;
  clientId: string;
  ownerUserId: string;
  ownerName?: string;
  brandId?: string;
  brandName?: string;
  campaignName?: string;
  accessScope?: ProjectAccessScope;
  archivedAt?: string;
  canvasPresetId?: string;
  sceneCount?: number;
  widgetCount?: number;
};


export type ProjectVersionSummary = {
  id: string;
  projectId: string;
  projectName: string;
  versionNumber: number;
  savedAt: string;
  note?: string;
};

export interface DocumentRepository {
  mode: 'local' | 'api';
  saveAutosave(state: StudioState): Promise<void>;
  saveManual(state: StudioState): Promise<void>;
  loadAutosave(): Promise<StudioState | null>;
  loadManual(): Promise<StudioState | null>;
  clearAutosave(): Promise<void>;
  hasAutosave(): Promise<boolean>;
  hasManual(): Promise<boolean>;
}

export interface ProjectRepository {
  mode: 'local' | 'api';
  list(): Promise<ProjectSummary[]>;
  save(state: StudioState, projectId?: string): Promise<ProjectSummary>;
  load(projectId: string): Promise<StudioState | null>;
  delete(projectId: string): Promise<void>;
  duplicate(projectId: string): Promise<ProjectSummary>;
  archive(projectId: string): Promise<void>;
  restore(projectId: string): Promise<void>;
  changeOwner(projectId: string, ownerUserId: string, ownerName?: string): Promise<void>;
}


export interface ProjectVersionRepository {
  mode: 'local' | 'api';
  list(projectId: string): Promise<ProjectVersionSummary[]>;
  save(projectId: string, state: StudioState, note?: string): Promise<ProjectVersionSummary>;
  load(projectId: string, versionId: string): Promise<StudioState | null>;
}

export interface AssetRepository {
  mode: 'local' | 'api';
  list(): Promise<AssetRecord[]>;
  save(input: AssetDraft): Promise<AssetRecord>;
  remove(assetId: string): Promise<void>;
  rename(assetId: string, name: string): Promise<void>;
  get(assetId?: string): Promise<AssetRecord | undefined>;
}
