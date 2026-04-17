import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { apiDocumentRepository } from '../../../repositories/document/api';

const fetchMock = vi.fn();

describe('api document repository', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to local autosave when no API base exists', async () => {
    const state = createInitialState();
    state.document.name = 'Autosave Local';
    await apiDocumentRepository.saveAutosave(state);
    const loaded = await apiDocumentRepository.loadAutosave();
    expect(loaded?.document.name).toBe('Autosave Local');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses configured API base for autosave lookups', async () => {
    localStorage.setItem('smx-studio-v4:document-api-base', 'https://docs.example.com');
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ document: { name: 'Remote Doc' }, ui: {} }) });

    const loaded = await apiDocumentRepository.loadAutosave();
    expect(String(fetchMock.mock.calls[0][0])).toContain('https://docs.example.com/documents/autosave');
    expect((loaded as any)?.document?.name).toBe('Remote Doc');
  });
});
