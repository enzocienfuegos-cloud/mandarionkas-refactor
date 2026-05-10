import { readScopedStorageItem, writeScopedStorageItem } from '../../shared/browser/storage';

const STORAGE_KEY = 'smx-studio-v4:project-folders';

export type ProjectFolderRecord = {
  id: string;
  clientId: string;
  name: string;
  createdAt: string;
  position: number;
};

type StoredState = {
  folders: ProjectFolderRecord[];
  assignments: Record<string, string | undefined>;
};

function readState(): StoredState {
  try {
    const raw = readScopedStorageItem(STORAGE_KEY);
    if (!raw) return { folders: [], assignments: {} };
    const parsed = JSON.parse(raw) as StoredState;
    return {
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
      assignments: parsed.assignments && typeof parsed.assignments === 'object' ? parsed.assignments : {},
    };
  } catch {
    return { folders: [], assignments: {} };
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
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

export function createProjectFolder(clientId: string, name: string): ProjectFolderRecord {
  const state = readState();
  const nextFolder: ProjectFolderRecord = {
    id: createId(),
    clientId,
    name: name.trim(),
    createdAt: new Date().toISOString(),
    position: state.folders.filter((folder) => folder.clientId === clientId).length,
  };
  writeState({ ...state, folders: [...state.folders, nextFolder] });
  return nextFolder;
}

export function assignProjectsToFolder(projectIds: string[], folderId?: string): void {
  const state = readState();
  const nextAssignments = { ...state.assignments };
  for (const projectId of projectIds) {
    if (folderId) {
      nextAssignments[projectId] = folderId;
    } else {
      delete nextAssignments[projectId];
    }
  }
  writeState({ ...state, assignments: nextAssignments });
}

export function getProjectFolderId(projectId: string): string | undefined {
  return readState().assignments[projectId];
}

export function getProjectFolderAssignments(): Record<string, string | undefined> {
  return readState().assignments;
}
