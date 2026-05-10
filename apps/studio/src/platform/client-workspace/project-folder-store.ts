import { readScopedStorageItem, writeScopedStorageItem } from '../../shared/browser/storage';

const STORAGE_KEY = 'smx-studio-v4:project-folders';
export const WORKSPACE_VIEW_MODE_STORAGE_KEY = 'smx:workspace:view-mode';

export type ProjectFolderRecord = {
  id: string;
  clientId: string;
  name: string;
  createdAt: string;
  projectIds: string[];
};

export type ProjectWorkflowStatus = 'draft' | 'review' | 'ready' | 'exported';

export type ProjectWorkflowStatusRecord = {
  value: ProjectWorkflowStatus;
  updatedAt: string;
};

type StoredState = {
  folders: ProjectFolderRecord[];
  statuses: Record<string, ProjectWorkflowStatusRecord | undefined>;
};

type LegacyStoredState = {
  folders?: Array<ProjectFolderRecord & { position?: number }>;
  assignments?: Record<string, string | undefined>;
  statuses?: Record<string, ProjectWorkflowStatusRecord | ProjectWorkflowStatus | undefined>;
};

function normalizeStatuses(
  input: LegacyStoredState['statuses'],
): Record<string, ProjectWorkflowStatusRecord | undefined> {
  if (!input || typeof input !== 'object') return {};
  const normalized: Record<string, ProjectWorkflowStatusRecord | undefined> = {};
  for (const [projectId, value] of Object.entries(input)) {
    if (!value) continue;
    if (typeof value === 'string') {
      normalized[projectId] = { value, updatedAt: new Date(0).toISOString() };
      continue;
    }
    if (typeof value === 'object' && typeof value.value === 'string' && typeof value.updatedAt === 'string') {
      normalized[projectId] = value;
    }
  }
  return normalized;
}

function migrateFolders(state: LegacyStoredState): ProjectFolderRecord[] {
  const folders = Array.isArray(state.folders) ? state.folders : [];
  const assignments = state.assignments && typeof state.assignments === 'object' ? state.assignments : {};
  return folders
    .map((folder) => {
      const projectIds = Array.isArray(folder.projectIds)
        ? folder.projectIds
        : Object.entries(assignments)
          .filter(([, assignedFolderId]) => assignedFolderId === folder.id)
          .map(([projectId]) => projectId);
      return {
        id: folder.id,
        clientId: folder.clientId,
        name: folder.name,
        createdAt: folder.createdAt,
        projectIds,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function readState(): StoredState {
  try {
    const raw = readScopedStorageItem(STORAGE_KEY);
    if (!raw) return { folders: [], statuses: {} };
    const parsed = JSON.parse(raw) as LegacyStoredState;
    return {
      folders: migrateFolders(parsed),
      statuses: normalizeStatuses(parsed.statuses),
    };
  } catch {
    return { folders: [], statuses: {} };
  }
}

function writeState(state: StoredState): void {
  writeScopedStorageItem(STORAGE_KEY, JSON.stringify(state));
}

function createId(): string {
  return `folder_${Math.random().toString(36).slice(2, 10)}`;
}

export function listProjectFolders(clientId?: string): ProjectFolderRecord[] {
  const state = readState();
  return state.folders
    .filter((folder) => !clientId || folder.clientId === clientId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function createProjectFolder(clientId: string, name: string): ProjectFolderRecord {
  const state = readState();
  const nextFolder: ProjectFolderRecord = {
    id: createId(),
    clientId,
    name: name.trim(),
    createdAt: new Date().toISOString(),
    projectIds: [],
  };
  writeState({ ...state, folders: [...state.folders, nextFolder] });
  return nextFolder;
}

export function assignProjectsToFolder(projectIds: string[], folderId?: string): void {
  const state = readState();
  const nextFolders = state.folders.map((folder) => ({
    ...folder,
    projectIds: folder.projectIds.filter((projectId) => !projectIds.includes(projectId)),
  }));
  if (folderId) {
    const targetFolder = nextFolders.find((folder) => folder.id === folderId);
    if (targetFolder) {
      targetFolder.projectIds = Array.from(new Set([...targetFolder.projectIds, ...projectIds]));
    }
  }
  writeState({ ...state, folders: nextFolders });
}

export function getProjectFolderId(projectId: string): string | undefined {
  return readState().folders.find((folder) => folder.projectIds.includes(projectId))?.id;
}

export function getProjectFolderAssignments(): Record<string, string | undefined> {
  return readState().folders.reduce<Record<string, string | undefined>>((assignments, folder) => {
    for (const projectId of folder.projectIds) {
      assignments[projectId] = folder.id;
    }
    return assignments;
  }, {});
}

export function getProjectWorkflowStatuses(): Record<string, ProjectWorkflowStatusRecord | undefined> {
  return readState().statuses;
}

export function setProjectWorkflowStatus(projectIds: string[], value: ProjectWorkflowStatus): void {
  if (!projectIds.length) return;
  const state = readState();
  const updatedAt = new Date().toISOString();
  const statuses = { ...state.statuses };
  for (const projectId of projectIds) {
    statuses[projectId] = { value, updatedAt };
  }
  writeState({ ...state, statuses });
}

export function markProjectExported(projectId: string): void {
  setProjectWorkflowStatus([projectId], 'exported');
}
