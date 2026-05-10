import type { StudioState } from '../../domain/document/types';
import type { ProjectSummary } from '../types';
import { setProjectRepositoryMode } from '../mode';
import { getRepositoryServices } from '../services';

export { setProjectRepositoryMode };

export function getProjectRepository() {
  return getRepositoryServices().projects;
}

export async function listProjects(): Promise<ProjectSummary[]> { return getProjectRepository().list(); }
export async function saveProject(state: StudioState, projectId?: string): Promise<ProjectSummary> { return getProjectRepository().save(state, projectId); }
export async function loadProject(projectId: string): Promise<StudioState | null> { return getProjectRepository().load(projectId); }
export async function deleteProject(projectId: string): Promise<void> { return getProjectRepository().delete(projectId); }

export async function duplicateProject(projectId: string): Promise<ProjectSummary> { return getProjectRepository().duplicate(projectId); }
export async function archiveProject(projectId: string): Promise<void> { return getProjectRepository().archive(projectId); }
export async function restoreProject(projectId: string): Promise<void> { return getProjectRepository().restore(projectId); }
export async function changeProjectOwner(projectId: string, ownerUserId: string, ownerName?: string): Promise<void> { return getProjectRepository().changeOwner(projectId, ownerUserId, ownerName); }
