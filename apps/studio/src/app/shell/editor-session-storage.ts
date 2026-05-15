import { readScopedStorageItem, writeScopedStorageItem } from '../../shared/browser/storage';

const EDITOR_SESSION_STORAGE_KEY = 'smx-studio-v4:editor-session';

export type EditorSessionSnapshot = {
  projectId?: string;
  clientId?: string;
  canvasVariantId?: string;
};

export function readEditorSessionSnapshot(): EditorSessionSnapshot | null {
  const raw = readScopedStorageItem(EDITOR_SESSION_STORAGE_KEY, '');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as EditorSessionSnapshot;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      projectId: typeof parsed.projectId === 'string' && parsed.projectId.trim() ? parsed.projectId : undefined,
      clientId: typeof parsed.clientId === 'string' && parsed.clientId.trim() ? parsed.clientId : undefined,
      canvasVariantId: typeof parsed.canvasVariantId === 'string' && parsed.canvasVariantId.trim() ? parsed.canvasVariantId : undefined,
    };
  } catch {
    return null;
  }
}

export function writeEditorSessionSnapshot(snapshot: EditorSessionSnapshot): void {
  writeScopedStorageItem(EDITOR_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
}
