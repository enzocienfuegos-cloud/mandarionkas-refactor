import { normalizeStudioState } from '../../domain/document/normalize-state';
import type { StudioState } from '../../domain/document/types';
import { loadProject } from '../../repositories/project';
import { readStorageItem } from '../../shared/browser/storage';
import type { LoadedClientPreviewProject } from './types';

const PROJECT_KEY_PREFIX = 'smx-studio-v4:project:';

export function readClientPreviewRoute(url = window.location): { projectId: string; token: string } | null {
  const pathname = url.pathname.replace(/\/+$/, '');
  const match = pathname.match(/\/preview\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return {
    projectId: decodeURIComponent(match[1]),
    token: decodeURIComponent(match[2]),
  };
}

function readProjectFromLocalStorage(projectId: string): StudioState | null {
  const raw = readStorageItem(`${PROJECT_KEY_PREFIX}${projectId}`, '');
  if (!raw) return null;
  try {
    return normalizeStudioState(JSON.parse(raw) as StudioState);
  } catch {
    return null;
  }
}

export async function loadClientPreviewProject(projectId: string, token: string): Promise<LoadedClientPreviewProject | null> {
  const loaded = await loadProject(projectId).catch(() => null);
  const state = loaded ?? readProjectFromLocalStorage(projectId);
  if (!state) return null;
  return {
    projectId,
    token,
    state,
  };
}
