import type { StudioState } from '../../domain/document/types';
import { normalizeStudioState } from '../../domain/document/normalize-state';
import type { ProjectAccessScope } from '../../types/contracts/access-scopes';
import type { PlatformRepositoryContext } from '../../platform/runtime';
import { getRepositoryContext } from '../context';
import { canUseBrowserStorage, readStorageItem, removeStorageItem, writeStorageItem } from '../../shared/browser/storage';
import type { ProjectRepository, ProjectSummary } from '../types';

const PROJECT_INDEX_KEY = 'smx-studio-v4:projects:index';
const projectKey = (projectId: string) => `smx-studio-v4:project:${projectId}`;

function createId(prefix: string): string { return `${prefix}_${Math.random().toString(36).slice(2, 9)}`; }

function readIndex(): ProjectSummary[] {
  if (!canUseBrowserStorage()) return [];
  const raw = readStorageItem(PROJECT_INDEX_KEY, '');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ProjectSummary[];
    return Array.isArray(parsed)
      ? parsed.map((item) => ({ ...item, accessScope: item.accessScope ?? 'client', archivedAt: item.archivedAt }))
      : [];
  } catch {
    return [];
  }
}

function writeIndex(items: ProjectSummary[]): void {
  if (!canUseBrowserStorage()) return;
  writeStorageItem(PROJECT_INDEX_KEY, JSON.stringify(items));
}

function canViewProject(item: ProjectSummary, ctx: PlatformRepositoryContext): boolean {
  if (item.clientId !== ctx.clientId) return false;
  return item.ownerUserId === ctx.ownerUserId || item.accessScope === 'client' || (item.accessScope === 'reviewers' && ctx.currentUserRole === 'reviewer') || ctx.can('projects:view-client');
}

function canManageProject(item: ProjectSummary, ctx: PlatformRepositoryContext): boolean {
  return item.clientId === ctx.clientId && (item.ownerUserId === ctx.ownerUserId || ctx.can('projects:delete'));
}

function buildSummary(id: string, state: StudioState, ctx: PlatformRepositoryContext, existing?: ProjectSummary): ProjectSummary {
  return {
    id,
    name: state.document.name,
    updatedAt: state.document.metadata.lastSavedAt ?? new Date().toISOString(),
    clientId: ctx.clientId,
    ownerUserId: existing?.ownerUserId ?? ctx.ownerUserId,
    ownerName: existing?.ownerName,
    brandId: state.document.metadata.platform?.brandId,
    brandName: state.document.metadata.platform?.brandName,
    campaignName: state.document.metadata.platform?.campaignName,
    accessScope: (state.document.metadata.platform?.accessScope ?? (ctx.can('projects:share-client') ? 'client' : 'private')) as ProjectAccessScope,
    archivedAt: existing?.archivedAt,
    canvasPresetId: state.document.canvas.presetId,
    sceneCount: state.document.scenes.length,
    widgetCount: state.document.scenes.reduce((count, scene) => count + scene.widgetIds.length, 0),
  };
}

export const localProjectRepository: ProjectRepository = {
  mode: 'local',
  async list() {
    const ctx = getRepositoryContext();
    return readIndex().filter((item) => canViewProject(item, ctx)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async save(state: StudioState, projectId?: string) {
    const ctx = getRepositoryContext();
    if (!ctx.can('projects:save')) throw new Error('You do not have permission to save projects.');
    const id = projectId ?? createId('project');
    const existing = readIndex().find((item) => item.id === id);
    const snapshot = normalizeStudioState({
      ...state,
      document: {
        ...state.document,
        id,
        metadata: {
          ...state.document.metadata,
          dirty: false,
          lastSavedAt: new Date().toISOString(),
          platform: {
            ...(state.document.metadata.platform ?? {}),
            clientId: ctx.clientId,
            clientName: ctx.clientName ?? state.document.metadata.platform?.clientName,
            accessScope: state.document.metadata.platform?.accessScope ?? (ctx.can('projects:share-client') ? 'client' : 'private'),
          },
        },
      },
    });
    if (canUseBrowserStorage()) writeStorageItem(projectKey(id), JSON.stringify(snapshot));
    const nextSummary = buildSummary(id, snapshot, ctx, existing);
    const rest = readIndex().filter((item) => item.id !== id);
    writeIndex([nextSummary, ...rest]);
    return nextSummary;
  },
  async load(projectId: string) {
    if (!canUseBrowserStorage()) return null;
    const ctx = getRepositoryContext();
    const summary = readIndex().find((item) => item.id === projectId);
    if (!summary || !canViewProject(summary, ctx)) return null;
    const raw = readStorageItem(projectKey(projectId), '');
    if (!raw) return null;
    try { return normalizeStudioState(JSON.parse(raw) as StudioState); } catch { return null; }
  },
  async delete(projectId: string) {
    if (!canUseBrowserStorage()) return;
    const ctx = getRepositoryContext();
    const summary = readIndex().find((item) => item.id === projectId);
    if (!summary || !canManageProject(summary, ctx)) return;
    removeStorageItem(projectKey(projectId));
    writeIndex(readIndex().filter((item) => item.id !== projectId));
  },
  async duplicate(projectId: string) {
    const ctx = getRepositoryContext();
    const summary = readIndex().find((item) => item.id === projectId);
    if (!summary || !canViewProject(summary, ctx)) throw new Error('Project not found');
    const raw = readStorageItem(projectKey(projectId), '');
    if (!raw) throw new Error('Project state missing');
    const loaded = normalizeStudioState(JSON.parse(raw) as StudioState);
    const duplicateId = createId('project');
    const duplicatedState = normalizeStudioState({
      ...loaded,
      document: {
        ...loaded.document,
        id: duplicateId,
        name: `${loaded.document.name} Copy`,
        metadata: {
          ...loaded.document.metadata,
          dirty: false,
          lastSavedAt: new Date().toISOString(),
        },
      },
      ui: { ...loaded.ui, activeProjectId: duplicateId },
    });
    writeStorageItem(projectKey(duplicateId), JSON.stringify(duplicatedState));
    const duplicateSummary = buildSummary(duplicateId, duplicatedState, ctx, {
      ...summary,
      ownerUserId: ctx.ownerUserId,
      archivedAt: undefined,
    });
    duplicateSummary.name = `${summary.name} Copy`;
    const rest = readIndex();
    writeIndex([duplicateSummary, ...rest]);
    return duplicateSummary;
  },
  async archive(projectId: string) {
    const ctx = getRepositoryContext();
    const items = readIndex();
    const summary = items.find((item) => item.id === projectId);
    if (!summary || !canManageProject(summary, ctx)) return;
    writeIndex(items.map((item) => item.id === projectId ? { ...item, archivedAt: new Date().toISOString() } : item));
  },
  async restore(projectId: string) {
    const ctx = getRepositoryContext();
    const items = readIndex();
    const summary = items.find((item) => item.id === projectId);
    if (!summary || !canManageProject(summary, ctx)) return;
    writeIndex(items.map((item) => item.id === projectId ? { ...item, archivedAt: undefined, updatedAt: new Date().toISOString() } : item));
  },
  async changeOwner(projectId: string, ownerUserId: string, ownerName?: string) {
    const ctx = getRepositoryContext();
    const items = readIndex();
    const summary = items.find((item) => item.id === projectId);
    if (!summary || !canManageProject(summary, ctx)) return;
    writeIndex(items.map((item) => item.id === projectId ? { ...item, ownerUserId, ownerName, updatedAt: new Date().toISOString() } : item));
  },
};
