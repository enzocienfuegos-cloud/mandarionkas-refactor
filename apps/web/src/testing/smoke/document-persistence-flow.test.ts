import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../../domain/document/factories';
import { reduceBySlices } from '../../core/store/reducers';
import { localDocumentRepository } from '../../repositories/document/local';


describe('document persistence smoke path', () => {
  beforeEach(async () => {
    globalThis.localStorage.clear();
    await localDocumentRepository.clearAutosave();
  });

  it('autosaves a document, reloads it, and clears the draft', async () => {
    let state = createInitialState();
    state = reduceBySlices(state, { type: 'UPDATE_DOCUMENT_NAME', name: 'Autosave Smoke' });
    state = reduceBySlices(state, { type: 'CREATE_WIDGET', widgetType: 'text' });

    const textId = state.document.selection.primaryWidgetId!;
    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_PROPS', widgetId: textId, patch: { text: 'Draft text' } });

    await localDocumentRepository.saveAutosave(state);
    expect(await localDocumentRepository.hasAutosave()).toBe(true);

    const loaded = await localDocumentRepository.loadAutosave();
    expect(loaded?.document.name).toBe('Autosave Smoke');
    expect(Object.keys(loaded?.document.widgets ?? {})).toHaveLength(1);

    await localDocumentRepository.clearAutosave();
    expect(await localDocumentRepository.hasAutosave()).toBe(false);
  });
});
