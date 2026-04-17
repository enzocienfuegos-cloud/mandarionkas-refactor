import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { browserStorageDocumentRepository } from '../../fakes/browser-storage-document-repository';

describe('browser storage document repository', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('saves and loads autosave state', async () => {
    const state = createInitialState();
    state.document.name = 'Autosave Test';

    await browserStorageDocumentRepository.saveAutosave(state);
    expect(await browserStorageDocumentRepository.hasAutosave()).toBe(true);

    const loaded = await browserStorageDocumentRepository.loadAutosave();
    expect(loaded?.document.name).toBe('Autosave Test');

    await browserStorageDocumentRepository.clearAutosave();
    expect(await browserStorageDocumentRepository.hasAutosave()).toBe(false);
  });
});
