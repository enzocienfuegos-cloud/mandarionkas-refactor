import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { localDocumentRepository } from '../../../repositories/document/local';

describe('local document repository', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('saves and loads autosave state', async () => {
    const state = createInitialState();
    state.document.name = 'Autosave Test';

    await localDocumentRepository.saveAutosave(state);
    expect(await localDocumentRepository.hasAutosave()).toBe(true);

    const loaded = await localDocumentRepository.loadAutosave();
    expect(loaded?.document.name).toBe('Autosave Test');

    await localDocumentRepository.clearAutosave();
    expect(await localDocumentRepository.hasAutosave()).toBe(false);
  });
});
