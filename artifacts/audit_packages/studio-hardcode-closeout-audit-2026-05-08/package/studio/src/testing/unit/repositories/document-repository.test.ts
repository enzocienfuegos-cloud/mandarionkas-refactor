import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { apiDocumentRepository } from '../../../repositories/document/api';

const DOCUMENT_API_BASE = 'https://docs.example.com';

describe('api document repository', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    localStorage.setItem('smx-studio-v4:document-api-base', DOCUMENT_API_BASE);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves autosave state via POST and loads it back via GET', async () => {
    const state = createInitialState();
    state.document.name = 'Repository Test';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => null });
    await apiDocumentRepository.saveAutosave(state);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v1/documents/autosave');
    expect(fetchMock.mock.calls[0][1]?.method).toBe('POST');

    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ state }) });
    const loaded = await apiDocumentRepository.loadAutosave();
    expect(loaded?.document.name).toBe('Repository Test');
  });

  it('clears autosave via DELETE', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => null });
    vi.stubGlobal('fetch', fetchMock);
    await apiDocumentRepository.clearAutosave();
    expect(fetchMock.mock.calls[0][1]?.method).toBe('DELETE');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v1/documents/autosave');
  });
});
