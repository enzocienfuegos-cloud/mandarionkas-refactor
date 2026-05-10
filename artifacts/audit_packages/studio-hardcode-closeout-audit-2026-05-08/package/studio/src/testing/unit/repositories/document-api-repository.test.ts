import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { apiDocumentRepository } from '../../../repositories/document/api';

const DOCUMENT_API_BASE = 'https://docs.example.com';

describe('api document repository', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when no API base is configured', async () => {
    const state = createInitialState();
    await expect(apiDocumentRepository.saveAutosave(state)).rejects.toThrow('Document API unavailable');
    await expect(apiDocumentRepository.loadAutosave()).rejects.toThrow('Document API unavailable');
  });

  it('saves autosave via POST to /v1/documents/autosave', async () => {
    localStorage.setItem('smx-studio-v4:document-api-base', DOCUMENT_API_BASE);
    const state = createInitialState();
    state.document.name = 'Autosave Doc';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => null });
    vi.stubGlobal('fetch', fetchMock);

    await apiDocumentRepository.saveAutosave(state);
    expect(String(fetchMock.mock.calls[0][0])).toContain('https://docs.example.com/v1/documents/autosave');
    expect(fetchMock.mock.calls[0][1]?.method).toBe('POST');
  });

  it('uses configured API base for autosave lookups', async () => {
    localStorage.setItem('smx-studio-v4:document-api-base', DOCUMENT_API_BASE);
    const state = createInitialState();
    state.document.name = 'Remote Doc';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ state }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const loaded = await apiDocumentRepository.loadAutosave();
    expect(String(fetchMock.mock.calls[0][0])).toContain('https://docs.example.com/v1/documents/autosave');
    expect(loaded?.document.name).toBe('Remote Doc');
  });
});
