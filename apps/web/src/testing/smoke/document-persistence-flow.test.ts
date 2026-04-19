import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../domain/document/factories';
import { reduceBySlices } from '../../core/store/reducers';
import { apiDocumentRepository } from '../../repositories/document/api';

const DOCUMENT_API_BASE = 'https://api.test.smx.studio';

describe('document persistence smoke path', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    localStorage.setItem('smx-studio-v4:document-api-base', DOCUMENT_API_BASE);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('autosaves a document, reloads it, and clears the draft via API', async () => {
    let state = createInitialState();
    state = reduceBySlices(state, { type: 'UPDATE_DOCUMENT_NAME', name: 'Autosave Smoke' });
    state = reduceBySlices(state, { type: 'CREATE_WIDGET', widgetType: 'text' });
    const textId = state.document.selection.primaryWidgetId!;
    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_PROPS', widgetId: textId, patch: { text: 'Draft text' } });

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // saveAutosave
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => null });
    await apiDocumentRepository.saveAutosave(state);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v1/documents/autosave');

    // loadAutosave
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ state }),
    });
    const loaded = await apiDocumentRepository.loadAutosave();
    expect(loaded?.document.name).toBe('Autosave Smoke');
    expect(Object.keys(loaded?.document.widgets ?? {})).toHaveLength(1);

    // clearAutosave
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => null });
    await apiDocumentRepository.clearAutosave();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1]?.method).toBe('DELETE');
  });
});
