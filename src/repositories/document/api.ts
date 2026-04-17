import { getRepositoryApiBase } from '../api-config';
import { fetchOptionalJson, HttpError } from '../../shared/net/http-json';
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

function unwrapExists(response: { exists?: boolean } | boolean | null): boolean | null {
  if (response === null) return null;
  return typeof response === 'object' ? Boolean(response.exists) : Boolean(response);
}

function isMissingDocument(error: unknown): boolean {
  return error instanceof HttpError && error.status === 404;
}

export const apiDocumentRepository: DocumentRepository = {
  async saveAutosave(state) {
    await tryFetch('/documents/autosave', { method: 'POST', body: JSON.stringify({ state }) });
  },
  async saveManual(state) {
    await tryFetch('/documents/manual-save', { method: 'POST', body: JSON.stringify({ state }) });
  },
  async loadAutosave() {
    try {
      return unwrapState(await tryFetch<{ state?: StudioState | null } | StudioState>('/documents/autosave'));
    } catch (error) {
      if (isMissingDocument(error)) return null;
      throw error;
    }
  },
  async loadManual() {
    try {
      return unwrapState(await tryFetch<{ state?: StudioState | null } | StudioState>('/documents/manual-save'));
    } catch (error) {
      if (isMissingDocument(error)) return null;
      throw error;
    }
  },
  async clearAutosave() {
    await tryFetch('/documents/autosave', { method: 'DELETE' });
  },
  async clearManual() {
    await tryFetch('/documents/manual-save', { method: 'DELETE' });
  },
  async hasAutosave() {
    try {
      return unwrapExists(await tryFetch<{ exists?: boolean } | boolean>('/documents/autosave/exists')) ?? false;
    } catch (error) {
      if (isMissingDocument(error)) return false;
      throw error;
    }
  },
  async hasManual() {
    try {
      return unwrapExists(await tryFetch<{ exists?: boolean } | boolean>('/documents/manual-save/exists')) ?? false;
    } catch (error) {
      if (isMissingDocument(error)) return false;
      throw error;
    }
  },
};
