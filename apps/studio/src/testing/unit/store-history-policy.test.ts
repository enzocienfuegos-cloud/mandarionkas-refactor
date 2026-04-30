import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../../domain/document/factories';
import { replaceStudioState, studioStore } from '../../core/store/studio-store';

describe('studio store history policy', () => {
  beforeEach(() => {
    replaceStudioState(createInitialState());
  });

  it('does not push history entries for runtime-only ui commands', () => {
    const initialName = studioStore.getState().document.name;

    studioStore.dispatch({ type: 'SET_PREVIEW_MODE', previewMode: true });
    studioStore.dispatch({ type: 'SET_PLAYHEAD', playheadMs: 800 });
    studioStore.dispatch({ type: 'UNDO' });

    expect(studioStore.getState().document.name).toBe(initialName);
    expect(studioStore.getState().ui.previewMode).toBe(true);
    expect(studioStore.getState().ui.playheadMs).toBe(800);
  });

  it('resets history when a new state is loaded', () => {
    studioStore.dispatch({ type: 'UPDATE_DOCUMENT_NAME', name: 'Project A' });
    replaceStudioState({
      ...createInitialState(),
      document: {
        ...createInitialState().document,
        name: 'Project B',
      },
    });

    studioStore.dispatch({ type: 'UNDO' });

    expect(studioStore.getState().document.name).toBe('Project B');
  });
});
