import type { StudioState } from '../../domain/document/types';
import { getRepositoryApiBase } from '../api-config';
import { fetchOptionalJson } from '../../shared/net/http-json';
import type { ProjectVersionRepository, ProjectVersionSummary } from '../types';
import type {
  ListProjectVersionsResponseDto,
  LoadProjectVersionResponseDto,
  SaveProjectVersionRequestDto,
  SaveProjectVersionResponseDto,
} from '../../types/contracts';

function getBaseUrl(): string {
  return getRepositoryApiBase('smx-studio-v4:project-api-base');
}

async function tryFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const base = getBaseUrl().trim();
  if (!base) return null;
  return fetchOptionalJson<T>(`${base.replace(/\/$/, '')}${path}`, init);
}

function unwrapVersions(
  response: ListProjectVersionsResponseDto | ProjectVersionSummary[] | null,
): ProjectVersionSummary[] | null {
  if (!response) return null;
  return Array.isArray(response) ? response : response.versions;
}

function unwrapVersion(
  response: SaveProjectVersionResponseDto | ProjectVersionSummary | null,
): ProjectVersionSummary | null {
  if (!response) return null;
  return 'version' in response ? response.version : response;
}

function unwrapState(
  response: LoadProjectVersionResponseDto | StudioState | null,
): StudioState | null {
  if (!response) return null;
  return 'state' in response ? (response.state as StudioState | null) : response;
}

export const apiProjectVersionRepository: ProjectVersionRepository = {
  async list(projectId: string) {
    const response = await tryFetch<ListProjectVersionsResponseDto | ProjectVersionSummary[]>(
      `/projects/${projectId}/versions`,
    );
    if (response) return unwrapVersions(response) ?? [];
    throw new Error('Project version API unavailable');
  },

  async save(projectId: string, state: StudioState, note?: string) {
    const payload: SaveProjectVersionRequestDto = {
      state: state as Record<string, unknown>,
      note,
    };

    const response = await tryFetch<SaveProjectVersionResponseDto | ProjectVersionSummary>(
      `/projects/${projectId}/versions`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );

    const version = unwrapVersion(response);
    if (version) return version;
    throw new Error('Project version save failed');
  },

  async load(projectId: string, versionId: string) {
    const response = await tryFetch<LoadProjectVersionResponseDto | StudioState>(
      `/projects/${projectId}/versions/${versionId}`,
    );
    if (response) return unwrapState(response);
    throw new Error('Project version load failed');
  },
};
