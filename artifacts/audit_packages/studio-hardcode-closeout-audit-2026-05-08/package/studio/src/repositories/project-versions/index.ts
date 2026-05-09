import type { StudioState } from '../../domain/document/types';
import type { ProjectVersionSummary } from '../types';
import { getRepositoryServices } from '../services';

export function getProjectVersionRepository() {
  return getRepositoryServices().projectVersions;
}

export async function listProjectVersions(projectId: string): Promise<ProjectVersionSummary[]> {
  return getProjectVersionRepository().list(projectId);
}

export async function saveProjectVersion(projectId: string, state: StudioState, note?: string): Promise<ProjectVersionSummary> {
  return getProjectVersionRepository().save(projectId, state, note);
}

export async function loadProjectVersion(projectId: string, versionId: string): Promise<StudioState | null> {
  return getProjectVersionRepository().load(projectId, versionId);
}
