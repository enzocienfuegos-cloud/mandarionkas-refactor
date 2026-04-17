import type { StudioState } from '../../domain/document/types';
import { getRepositoryApiBase } from '../api-config';
import { fetchJson, fetchOptionalJson } from '../../shared/net/http-json';
import type { ProjectRepository, ProjectSummary } from '../types';
import type {
  ListProjectsResponseDto,
  LoadProjectResponseDto,
  SaveProjectRequestDto,
  SaveProjectResponseDto,
} from '../../types/contracts';

function getBaseUrl(): string {
  return getRepositoryApiBase('smx-studio-v4:project-api-base');
}

async function tryFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const base = getBaseUrl().trim();
  if (!base) throw new Error('Project API unavailable');
  return fetchOptionalJson<T>(`${base.replace(/\/$/, '')}${path}`, init);
}

function unwrapProjects(response: ListProjectsResponseDto | ProjectSummary[] | null): ProjectSummary[] {
  if (!response) return [];
  return Array.isArray(response) ? response : response.projects;
}

function unwrapProject(response: SaveProjectResponseDto | ProjectSummary | null): ProjectSummary | null {
  if (!response) return null;
  if ('project' in response && response.project) return response.project;
  if ('id' in response) return response as ProjectSummary;
  return null;
}

function unwrapState(response: LoadProjectResponseDto | StudioState | null): StudioState | null {
  if (!response) return null;
  return 'state' in response ? (response.state as StudioState | null) : response;
}

export const apiProjectRepository: ProjectRepository = {
  mode: 'api',

  async list() {
    const response = await tryFetch<ListProjectsResponseDto | ProjectSummary[]>('/projects');
    return unwrapProjects(response);
  },

  async save(state: StudioState, projectId?: string) {
    const payload: SaveProjectRequestDto = {
      state: state as Record<string, unknown>,
      projectId,
    };

    const response = await tryFetch<SaveProjectResponseDto | ProjectSummary>('/projects/save', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const project = unwrapProject(response);
    if (!project) throw new Error('Project save failed');
    return project;
  },

  async load(projectId: string) {
    const response = await tryFetch<LoadProjectResponseDto | StudioState>(`/projects/${projectId}`);
    return unwrapState(response);
  },

  async delete(projectId: string) {
    const base = getBaseUrl().trim();
    if (!base) throw new Error('Project API unavailable');
    await fetchJson<unknown>(`${base.replace(/\/$/, '')}/projects/${projectId}`, { method: 'DELETE' });
  },

  async duplicate(projectId: string) {
    const response = await tryFetch<SaveProjectResponseDto | ProjectSummary>(`/projects/${projectId}/duplicate`, { method: 'POST' });
    const project = unwrapProject(response);
    if (!project) throw new Error('Project duplicate failed');
    return project;
  },

  async archive(projectId: string) {
    await tryFetch<unknown>(`/projects/${projectId}/archive`, { method: 'POST' });
  },

  async restore(projectId: string) {
    await tryFetch<unknown>(`/projects/${projectId}/restore`, { method: 'POST' });
  },

  async changeOwner(projectId: string, ownerUserId: string, ownerName?: string) {
    await tryFetch<unknown>(`/projects/${projectId}/owner`, {
      method: 'POST',
      body: JSON.stringify({ ownerUserId, ownerName }),
    });
  },
};
