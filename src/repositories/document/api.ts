import { getRepositoryApiBase } from '../api-config';
import { fetchOptionalJson, HttpError } from '../../shared/net/http-json';
import type { DocumentRepository } from '../types';
import { localDocumentRepository } from './local';
import { readStorageItem, writeStorageItem } from '../../shared/browser/storage';
import type { StudioState } from '../../domain/document/types';

const AUTOSAVE_UNAVAILABLE_KEY = 'smx-studio-v4:document-api-autosave-unavailable';
const MANUAL_UNAVAILABLE_KEY = 'smx-studio-v4:document-api-manual-unavailable';

let autosaveApiUnavailable = readStorageItem(AUTOSAVE_UNAVAILABLE_KEY, '', 'sessionStorage') === 'true';
let manualSaveApiUnavailable = readStorageItem(MANUAL_UNAVAILABLE_KEY, '', 'sessionStorage') === 'true';

function getBaseUrl(): string {
  return getRepositoryApiBase('smx-studio-v4:document-api-base');
}

async function tryFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const base = getBaseUrl().trim();
  if (!base) return null;
  return fetchOptionalJson<T>(`${base.replace(/\/$/, '')}${path}`, init);
}

function unwrapState(response: { state?: StudioState | null } | StudioState | null): StudioState | null {
  if (!response) return null;
  if (typeof response === 'object' && 'state' in response) {
    return response.state ?? null;
  }
  return response as StudioState;
}

function unwrapExists(response: { exists?: boolean } | boolean | null): boolean | null {
  if (response === null) return null;
  return typeof response === 'object' ? Boolean(response.exists) : Boolean(response);
}

function shouldFallbackToLocal(error: unknown): boolean {
  return error instanceof HttpError && (error.status === 401 || error.status === 403 || error.status === 404);
}

function markDocumentCapabilityUnavailable(kind: 'autosave' | 'manual'): void {
  if (kind === 'autosave') {
    autosaveApiUnavailable = true;
    writeStorageItem(AUTOSAVE_UNAVAILABLE_KEY, 'true', 'sessionStorage');
  } else {
    manualSaveApiUnavailable = true;
    writeStorageItem(MANUAL_UNAVAILABLE_KEY, 'true', 'sessionStorage');
  }
}

function markDocumentCapabilityAvailable(kind: 'autosave' | 'manual'): void {
  if (kind === 'autosave') {
    autosaveApiUnavailable = false;
    writeStorageItem(AUTOSAVE_UNAVAILABLE_KEY, 'false', 'sessionStorage');
  } else {
    manualSaveApiUnavailable = false;
    writeStorageItem(MANUAL_UNAVAILABLE_KEY, 'false', 'sessionStorage');
  }
}

function isDocumentCapabilityUnavailable(kind: 'autosave' | 'manual'): boolean {
  return kind === 'autosave' ? autosaveApiUnavailable : manualSaveApiUnavailable;
}

export const apiDocumentRepository: DocumentRepository = {
  mode: 'api',
  async saveAutosave(state) {
    if (isDocumentCapabilityUnavailable('autosave')) {
      await localDocumentRepository.saveAutosave(state);
      return;
    }
    try {
      const response = await tryFetch('/documents/autosave', { method: 'POST', body: JSON.stringify({ state }) });
      markDocumentCapabilityAvailable('autosave');
      if (response === null) await localDocumentRepository.saveAutosave(state);
    } catch (error) {
      if (!shouldFallbackToLocal(error)) throw error;
      markDocumentCapabilityUnavailable('autosave');
      await localDocumentRepository.saveAutosave(state);
    }
  },
  async saveManual(state) {
    if (isDocumentCapabilityUnavailable('manual')) {
      await localDocumentRepository.saveManual(state);
      return;
    }
    try {
      const response = await tryFetch('/documents/manual-save', { method: 'POST', body: JSON.stringify({ state }) });
      markDocumentCapabilityAvailable('manual');
      if (response === null) await localDocumentRepository.saveManual(state);
    } catch (error) {
      if (!shouldFallbackToLocal(error)) throw error;
      markDocumentCapabilityUnavailable('manual');
      await localDocumentRepository.saveManual(state);
    }
  },
  async loadAutosave() {
    if (isDocumentCapabilityUnavailable('autosave')) {
      return await localDocumentRepository.loadAutosave();
    }
    try {
      const response = await tryFetch<{ state?: StudioState | null } | StudioState>('/documents/autosave');
      markDocumentCapabilityAvailable('autosave');
      return unwrapState(response) ?? await localDocumentRepository.loadAutosave();
    } catch (error) {
      if (!shouldFallbackToLocal(error)) throw error;
      markDocumentCapabilityUnavailable('autosave');
      return await localDocumentRepository.loadAutosave();
    }
  },
  async loadManual() {
    if (isDocumentCapabilityUnavailable('manual')) {
      return await localDocumentRepository.loadManual();
    }
    try {
      const response = await tryFetch<{ state?: StudioState | null } | StudioState>('/documents/manual-save');
      markDocumentCapabilityAvailable('manual');
      return unwrapState(response) ?? await localDocumentRepository.loadManual();
    } catch (error) {
      if (!shouldFallbackToLocal(error)) throw error;
      markDocumentCapabilityUnavailable('manual');
      return await localDocumentRepository.loadManual();
    }
  },
  async clearAutosave() {
    const base = getBaseUrl().trim();
    if (!base || isDocumentCapabilityUnavailable('autosave')) {
      await localDocumentRepository.clearAutosave();
      return;
    }
    try {
      await fetchOptionalJson<null>(`${base.replace(/\/$/, '')}/documents/autosave`, { method: 'DELETE' });
      markDocumentCapabilityAvailable('autosave');
    } catch (error) {
      if (!shouldFallbackToLocal(error)) throw error;
      markDocumentCapabilityUnavailable('autosave');
      await localDocumentRepository.clearAutosave();
    }
  },
  async hasAutosave() {
    if (isDocumentCapabilityUnavailable('autosave')) {
      return await localDocumentRepository.hasAutosave();
    }
    try {
      const response = await tryFetch<{ exists?: boolean } | boolean>('/documents/autosave/exists');
      markDocumentCapabilityAvailable('autosave');
      return unwrapExists(response) ?? await localDocumentRepository.hasAutosave();
    } catch (error) {
      if (!shouldFallbackToLocal(error)) throw error;
      markDocumentCapabilityUnavailable('autosave');
      return await localDocumentRepository.hasAutosave();
    }
  },
  async hasManual() {
    if (isDocumentCapabilityUnavailable('manual')) {
      return await localDocumentRepository.hasManual();
    }
    try {
      const response = await tryFetch<{ exists?: boolean } | boolean>('/documents/manual-save/exists');
      markDocumentCapabilityAvailable('manual');
      return unwrapExists(response) ?? await localDocumentRepository.hasManual();
    } catch (error) {
      if (!shouldFallbackToLocal(error)) throw error;
      markDocumentCapabilityUnavailable('manual');
      return await localDocumentRepository.hasManual();
    }
  },
};
