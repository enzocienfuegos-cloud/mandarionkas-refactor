import type { AssetFolder, AssetRecord } from '../../assets/types';
import { normalizeStudioState } from '../../domain/document/normalize-state';
import type { StudioState } from '../../domain/document/types';
import type { RepositoryServices } from '../../repositories/services';
import type { ProjectSummary, ProjectVersionSummary } from '../../repositories/types';

function cloneState(state: StudioState): StudioState {
  return normalizeStudioState(JSON.parse(JSON.stringify(state)) as StudioState);
}

function buildProjectSummary(state: StudioState, projectId: string): ProjectSummary {
  const platform = state.document.metadata.platform ?? {};
  return {
    id: projectId,
    name: state.document.name || 'Untitled project',
    updatedAt: new Date().toISOString(),
    clientId: platform.clientId ?? 'memory-client',
    ownerUserId: 'memory-user',
    brandId: platform.brandId,
    brandName: platform.brandName,
    campaignName: platform.campaignName,
    accessScope: platform.accessScope,
  };
}

export function createInMemoryRepositoryServices(): RepositoryServices {
  let autosave: StudioState | null = null;
  let manual: StudioState | null = null;
  const projects = new Map<string, StudioState>();
  const projectSummaries = new Map<string, ProjectSummary>();
  const assets = new Map<string, AssetRecord>();
  const assetFolders = new Map<string, AssetFolder>();
  const projectVersions = new Map<string, ProjectVersionSummary[]>();
  const projectVersionSnapshots = new Map<string, StudioState>();
  let assetCounter = 0;
  let projectCounter = 0;
  let versionCounter = 0;

  return {
    documents: {
      async saveAutosave(state) {
        autosave = cloneState(state);
      },
      async saveManual(state) {
        manual = cloneState(state);
      },
      async loadAutosave() {
        return autosave ? cloneState(autosave) : null;
      },
      async loadManual() {
        return manual ? cloneState(manual) : null;
      },
      async clearAutosave() {
        autosave = null;
      },
      async clearManual() {
        manual = null;
      },
      async hasAutosave() {
        return Boolean(autosave);
      },
      async hasManual() {
        return Boolean(manual);
      },
    },
    projects: {
      async list() {
        return [...projectSummaries.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      },
      async save(state, projectId) {
        const id = projectId ?? `memory-project-${++projectCounter}`;
        const snapshot = cloneState(state);
        projects.set(id, snapshot);
        const summary = buildProjectSummary(snapshot, id);
        projectSummaries.set(id, summary);
        return summary;
      },
      async load(projectId) {
        const snapshot = projects.get(projectId);
        return snapshot ? cloneState(snapshot) : null;
      },
      async delete(projectId) {
        projects.delete(projectId);
        projectSummaries.delete(projectId);
      },
    },
    projectVersions: {
      async list(projectId) {
        return [...(projectVersions.get(projectId) ?? [])].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      },
      async save(projectId, state, note) {
        const versions = projectVersions.get(projectId) ?? [];
        const summary: ProjectVersionSummary = {
          id: `memory-version-${++versionCounter}`,
          projectId,
          projectName: state.document.name || 'Untitled project',
          versionNumber: versions.length + 1,
          savedAt: new Date().toISOString(),
          note: note?.trim() || undefined,
        };
        projectVersions.set(projectId, [summary, ...versions]);
        projectVersionSnapshots.set(`${projectId}:${summary.id}`, cloneState({ ...state, document: { ...state.document, id: projectId, version: summary.versionNumber } }));
        return summary;
      },
      async load(projectId, versionId) {
        const snapshot = projectVersionSnapshots.get(`${projectId}:${versionId}`);
        return snapshot ? cloneState(snapshot) : null;
      },
    },
    assets: {
      async list() {
        return [...assets.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      },
      async save(input) {
        const id = `memory-asset-${++assetCounter}`;
        const now = new Date().toISOString();
        const record: AssetRecord = {
          ...input,
          id,
          createdAt: now,
          clientId: 'memory-client',
          ownerUserId: 'memory-user',
        };
        assets.set(id, record);
        return { ...record };
      },
      async remove(assetId) {
        assets.delete(assetId);
      },
      async rename(assetId, name) {
        const current = assets.get(assetId);
        if (!current) return;
        assets.set(assetId, { ...current, name });
      },
      async move(assetId, folderId) {
        const current = assets.get(assetId);
        if (!current) return;
        assets.set(assetId, { ...current, folderId });
      },
      async updateQuality(assetId, qualityPreference) {
        const current = assets.get(assetId);
        if (!current) return;
        assets.set(assetId, { ...current, qualityPreference });
      },
      async reprocess(assetId) {
        const current = assets.get(assetId);
        if (!current) return undefined;
        const next = { ...current, processingStatus: 'queued' as const, processingMessage: undefined };
        assets.set(assetId, next);
        return { ...next };
      },
      async get(assetId) {
        const record = assetId ? assets.get(assetId) : undefined;
        return record ? { ...record } : undefined;
      },
      async listFolders() {
        return [...assetFolders.values()];
      },
      async createFolder(name, parentId) {
        const folder: AssetFolder = {
          id: `memory-folder-${++assetCounter}`,
          name,
          parentId,
          createdAt: new Date().toISOString(),
          clientId: 'memory-client',
          ownerUserId: 'memory-user',
        };
        assetFolders.set(folder.id, folder);
        return { ...folder };
      },
      async renameFolder(folderId, name) {
        const current = assetFolders.get(folderId);
        if (!current) return undefined;
        const next = { ...current, name };
        assetFolders.set(folderId, next);
        return { ...next };
      },
      async deleteFolder(folderId) {
        assetFolders.delete(folderId);
        for (const [assetId, asset] of assets.entries()) {
          if (asset.folderId === folderId) {
            assets.set(assetId, { ...asset, folderId: undefined });
          }
        }
      },
    },
  };
}
