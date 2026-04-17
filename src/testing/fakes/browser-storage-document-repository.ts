import type { StudioState } from '../../domain/document/types';
import { normalizeStudioState } from '../../domain/document/normalize-state';
import { canUseBrowserStorage, readStorageItem, removeStorageItem, writeStorageItem } from '../browser/storage';
import type { DocumentRepository } from '../../repositories/types';

const AUTOSAVE_KEY = 'smx-studio-v4:autosave';
const SAVED_KEY = 'smx-studio-v4:saved';

function write(key: string, state: StudioState): void {
  if (!canUseBrowserStorage()) return;
  writeStorageItem(key, JSON.stringify(state));
}

function read(key: string): StudioState | null {
  if (!canUseBrowserStorage()) return null;
  const raw = readStorageItem(key, '');
  if (!raw) return null;
  try { return normalizeStudioState(JSON.parse(raw) as StudioState); } catch { return null; }
}

export const browserStorageDocumentRepository: DocumentRepository = {
  async saveAutosave(state) { write(AUTOSAVE_KEY, state); },
  async saveManual(state) { write(SAVED_KEY, state); },
  async loadAutosave() { return read(AUTOSAVE_KEY); },
  async loadManual() { return read(SAVED_KEY); },
  async clearAutosave() { if (canUseBrowserStorage()) removeStorageItem(AUTOSAVE_KEY); },
  async clearManual() { if (canUseBrowserStorage()) removeStorageItem(SAVED_KEY); },
  async hasAutosave() { return canUseBrowserStorage() && !!readStorageItem(AUTOSAVE_KEY, ''); },
  async hasManual() { return canUseBrowserStorage() && !!readStorageItem(SAVED_KEY, ''); },
};
