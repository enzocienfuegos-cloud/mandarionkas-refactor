import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../../domain/document/factories';
import { reduceBySlices } from '../../core/store/reducers';
import { browserStorageDocumentRepository } from '../fakes/browser-storage-document-repository';


describe('document persistence smoke path', () => {
  beforeEach(async () => {
    globalThis.localStorage.clear();
    await browserStorageDocumentRepository.clearAutosave();
  });

  it('autosaves a document, reloads it, and clears the draft', async () => {
    let state = createInitialState();
    state = reduceBySlices(state, { type: 'UPDATE_DOCUMENT_NAME', name: 'Autosave Smoke' });
    state = reduceBySlices(state, { type: 'CREATE_WIDGET', widgetType: 'text' });

    const textId = state.document.selection.primaryWidgetId!;
    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_PROPS', widgetId: textId, patch: { text: 'Draft text' } });

    await browserStorageDocumentRepository.saveAutosave(state);
    expect(await browserStorageDocumentRepository.hasAutosave()).toBe(true);

    const loaded = await browserStorageDocumentRepository.loadAutosave();
    expect(loaded?.document.name).toBe('Autosave Smoke');
    expect(Object.keys(loaded?.document.widgets ?? {})).toHaveLength(1);

    await browserStorageDocumentRepository.clearAutosave();
    expect(await browserStorageDocumentRepository.hasAutosave()).toBe(false);
  });
});
