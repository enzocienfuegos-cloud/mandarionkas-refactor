import { normalizeStudioState } from '../../domain/document/normalize-state';
import type { StudioState } from '../../domain/document/types';
import { prepareExportStateWithResolvedAssets } from '../../export/asset-resolution';
import { getRepositoryApiBase } from '../../repositories/api-config';
import { loadProject } from '../../repositories/project';
import { readStorageItem, writeStorageItem } from '../../shared/browser/storage';
import { fetchOptionalJson } from '../../shared/net/http-json';
import type { LoadedClientPreviewProject } from './types';

const PROJECT_KEY_PREFIX = 'smx-studio-v4:project:';

function normalizePreviewPath(path: string): string {
  return path.replace(/\/+$/, '');
}

export function readClientPreviewRoute(url = window.location): { projectId: string; token: string } | null {
  const pathname = normalizePreviewPath(url.pathname);
  const hashPath = normalizePreviewPath(url.hash.replace(/^#/, '').split('?')[0] ?? '');
  const match = pathname.match(/\/preview\/([^/]+)\/([^/]+)$/)
    ?? hashPath.match(/^\/?preview\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return {
    projectId: decodeURIComponent(match[1]),
    token: decodeURIComponent(match[2]),
  };
}

export function buildClientPreviewToken(projectId: string, version?: number): string {
  const safeProjectId = projectId.replace(/[^a-zA-Z0-9_-]+/g, '-');
  return `review-${safeProjectId}-${version ?? 0}`;
}

export function buildClientPreviewUrl(url: Location, projectId: string, token: string): string {
  const route = `/preview/${encodeURIComponent(projectId)}/${encodeURIComponent(token)}`;
  return `${url.origin}${url.pathname}${url.search}#${route}`;
}

export function persistClientPreviewSnapshot(projectId: string, state: StudioState): StudioState {
  const snapshot = normalizeStudioState({
    ...state,
    document: {
      ...state.document,
      id: projectId,
    },
    ui: {
      ...state.ui,
      activeProjectId: projectId,
    },
  });
  writeStorageItem(`${PROJECT_KEY_PREFIX}${projectId}`, JSON.stringify(snapshot));
  return snapshot;
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

async function loadPublicPreviewProject(projectId: string, token: string): Promise<StudioState | null> {
  const base = getRepositoryApiBase('smx-studio-v4:project-api-base').trim();
  if (!base) return null;
  try {
    const response = await fetchOptionalJson<{ state?: StudioState | null }>(
      `${base.replace(/\/$/, '')}/projects/${encodeURIComponent(projectId)}/preview/${encodeURIComponent(token)}`,
    );
    return response?.state ? normalizeStudioState(response.state) : null;
  } catch {
    return null;
  }
}

export async function prepareClientPreviewProjectState(state: StudioState): Promise<StudioState> {
  return prepareExportStateWithResolvedAssets(state).catch(() => state);
}

function buildPublicAssetPathMap(state: StudioState): Record<string, string> {
  const map: Record<string, string> = {};
  for (const widget of Object.values(state.document.widgets)) {
    const fontAssetSrc = typeof widget.props.fontAssetSrc === 'string' ? widget.props.fontAssetSrc.trim() : '';
    if (fontAssetSrc) {
      // fontAssetSrc is already the resolved public URL after prepareExportStateWithResolvedAssets.
      // Record identity mapping so buildChannelHtml can look it up via assetPathMap.
      map[fontAssetSrc] = fontAssetSrc;
    }
  }
  return map;
}

export async function loadClientPreviewProject(projectId: string, token: string): Promise<LoadedClientPreviewProject | null> {
  const loaded = await loadPublicPreviewProject(projectId, token)
    ?? await loadProject(projectId).catch(() => null);
  const state = loaded ?? readProjectFromLocalStorage(projectId);
  if (!state) return null;
  const preparedState = await prepareClientPreviewProjectState(state);
  const publicAssetPathMap = buildPublicAssetPathMap(preparedState);
  return {
    projectId,
    token,
    state: preparedState,
    publicAssetPathMap,
  };
}
