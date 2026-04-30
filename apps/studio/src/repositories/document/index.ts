import type { StudioState } from '../../domain/document/types';
import { setDocumentRepositoryMode } from '../mode';
import { getRepositoryServices } from '../services';

export { setDocumentRepositoryMode };

export function getDocumentRepository() {
  return getRepositoryServices().documents;
}

export async function saveAutosaveDraft(state: StudioState): Promise<void> { return getDocumentRepository().saveAutosave(state); }
export async function saveManualSnapshot(state: StudioState): Promise<void> { return getDocumentRepository().saveManual(state); }
export async function loadAutosaveDraft(): Promise<StudioState | null> { return getDocumentRepository().loadAutosave(); }
export async function loadManualSnapshot(): Promise<StudioState | null> { return getDocumentRepository().loadManual(); }
export async function clearAutosaveDraft(): Promise<void> { return getDocumentRepository().clearAutosave(); }
export async function hasAutosaveDraft(): Promise<boolean> { return getDocumentRepository().hasAutosave(); }
export async function hasManualSnapshot(): Promise<boolean> { return getDocumentRepository().hasManual(); }
