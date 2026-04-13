import type { StudioState } from '../../domain/document/types';
import { normalizeStudioState } from '../../domain/document/normalize-state';
import { canUseBrowserStorage, readStorageItem, writeStorageItem } from '../../shared/browser/storage';
import type { ProjectVersionRepository, ProjectVersionSummary } from '../types';

const versionIndexKey = (projectId: string) => `smx-studio-v4:project:${projectId}:versions:index`;
const versionSnapshotKey = (projectId: string, versionId: string) => `smx-studio-v4:project:${projectId}:version:${versionId}`;

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function readIndex(projectId: string): ProjectVersionSummary[] {
  if (!canUseBrowserStorage()) return [];
  const raw = readStorageItem(versionIndexKey(projectId), '');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ProjectVersionSummary[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(projectId: string, items: ProjectVersionSummary[]): void {
  if (!canUseBrowserStorage()) return;
  writeStorageItem(versionIndexKey(projectId), JSON.stringify(items));
}

export const localProjectVersionRepository: ProjectVersionRepository = {
  mode: 'local',
  async list(projectId) {
    return readIndex(projectId).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  },
  async save(projectId, state, note) {
    const versions = readIndex(projectId);
    const nextNumber = Math.max(0, ...versions.map((item) => item.versionNumber)) + 1;
    const versionId = createId('version');
    const savedAt = new Date().toISOString();
    const summary: ProjectVersionSummary = {
      id: versionId,
      projectId,
      projectName: state.document.name,
      versionNumber: nextNumber,
      savedAt,
      note: note?.trim() || undefined,
    };
    const snapshot: StudioState = normalizeStudioState({
      ...state,
      document: {
        ...state.document,
        id: projectId,
        version: nextNumber,
        metadata: {
          ...state.document.metadata,
          dirty: false,
          lastSavedAt: savedAt,
        },
      },
      ui: {
        ...state.ui,
        activeProjectId: projectId,
      },
    });
    if (canUseBrowserStorage()) {
      writeStorageItem(versionSnapshotKey(projectId, versionId), JSON.stringify(snapshot));
    }
    writeIndex(projectId, [summary, ...versions]);
    return summary;
  },
  async load(projectId, versionId) {
    if (!canUseBrowserStorage()) return null;
    const raw = readStorageItem(versionSnapshotKey(projectId, versionId), '');
    if (!raw) return null;
    try {
      return normalizeStudioState(JSON.parse(raw) as StudioState);
    } catch {
      return null;
    }
  },
};
