import type { ProjectAccessScope } from './access-scopes';

export type ProjectSummaryDto = {
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

export type DuplicateProjectResponseDto = {
  project: ProjectSummaryDto;
};

export type ChangeProjectOwnerRequestDto = {
  ownerUserId: string;
  ownerName?: string;
};

export type ProjectVersionSummaryDto = {
  id: string;
  projectId: string;
  projectName: string;
  versionNumber: number;
  savedAt: string;
  note?: string;
};

export type StudioStateSnapshotDto = Record<string, unknown>;

export type ListProjectsResponseDto = {
  projects: ProjectSummaryDto[];
};

export type SaveProjectRequestDto = {
  state: StudioStateSnapshotDto;
  projectId?: string;
};

export type SaveProjectResponseDto = {
  project: ProjectSummaryDto;
};

export type LoadProjectResponseDto = {
  state: StudioStateSnapshotDto | null;
};

export type ListProjectVersionsResponseDto = {
  versions: ProjectVersionSummaryDto[];
};

export type SaveProjectVersionRequestDto = {
  state: StudioStateSnapshotDto;
  note?: string;
};

export type SaveProjectVersionResponseDto = {
  version: ProjectVersionSummaryDto;
};

export type LoadProjectVersionResponseDto = {
  state: StudioStateSnapshotDto | null;
};
