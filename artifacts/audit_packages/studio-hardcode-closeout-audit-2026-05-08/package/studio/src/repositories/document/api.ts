import { getRepositoryApiBase } from '../api-config';
import { fetchOptionalJson } from '../../shared/net/http-json';
import type { DocumentRepository } from '../types';
import type { StudioState } from '../../domain/document/types';

function getBaseUrl(): string {
  return getRepositoryApiBase('smx-studio-v4:document-api-base');
}

async function tryFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const base = getBaseUrl().trim();
  if (!base) throw new Error('Document API unavailable');
  return fetchOptionalJson<T>(`${base.replace(/\/$/, '')}${path}`, init);
}

function unwrapState(response: { state?: StudioState | null } | StudioState | null): StudioState | null {
  if (!response) return null;
  if (typeof response === 'object' && 'state' in response) {
    return response.state ?? null;
  }
  return response as StudioState;
}

function unwrapExists(response: { exists?: boolean } | boolean | null): boolean {
  if (response === null) return false;
  return typeof response === 'object' ? Boolean(response.exists) : Boolean(response);
}

export const apiDocumentRepository: DocumentRepository = {
  mode: 'api',
  async saveAutosave(state) {
    await tryFetch('/documents/autosave', { method: 'POST', body: JSON.stringify({ state }) });
  },
  async saveManual(state) {
    await tryFetch('/documents/manual-save', { method: 'POST', body: JSON.stringify({ state }) });
  },
  async loadAutosave() {
    const response = await tryFetch<{ state?: StudioState | null } | StudioState>('/documents/autosave');
    return unwrapState(response);
  },
  async loadManual() {
    const response = await tryFetch<{ state?: StudioState | null } | StudioState>('/documents/manual-save');
    return unwrapState(response);
  },
  async clearAutosave() {
    await tryFetch<null>('/documents/autosave', { method: 'DELETE' });
  },
  async clearManual() {
    await tryFetch<null>('/documents/manual-save', { method: 'DELETE' });
  },
  async hasAutosave() {
    const response = await tryFetch<{ exists?: boolean } | boolean>('/documents/autosave/exists');
    return unwrapExists(response);
  },
  async hasManual() {
    const response = await tryFetch<{ exists?: boolean } | boolean>('/documents/manual-save/exists');
    return unwrapExists(response);
  },
};
