import { readScopedStorageItem, writeScopedStorageItem } from '../../shared/browser/storage';

export const EDIT_MODE_WIREFRAME_STORAGE_KEY = 'smx.studio.stage.editModeWireframe.v1';

export function readEditModeWireframePreference(fallback = false): boolean {
  const raw = readScopedStorageItem(
    EDIT_MODE_WIREFRAME_STORAGE_KEY,
    fallback ? 'true' : 'false',
    'persistent',
  );
  return raw === 'true';
}

export function writeEditModeWireframePreference(enabled: boolean): void {
  writeScopedStorageItem(
    EDIT_MODE_WIREFRAME_STORAGE_KEY,
    enabled ? 'true' : 'false',
    'persistent',
  );
}
