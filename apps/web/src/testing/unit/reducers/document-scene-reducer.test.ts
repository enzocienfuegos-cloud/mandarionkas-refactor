import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { documentSceneReducer } from '../../../core/store/reducers/document-scene-reducer';

describe('documentSceneReducer', () => {
  it('adds a scene and selects it', () => {
    const state = createInitialState();
    const next = documentSceneReducer(state, { type: 'ADD_SCENE' });
    expect(next.document.scenes).toHaveLength(state.document.scenes.length + 1);
    expect(next.document.selection.activeSceneId).toBe(next.document.scenes.at(-1)?.id);
  });

  it('applies a canvas preset', () => {
    const state = createInitialState();
    const next = documentSceneReducer(state, { type: 'APPLY_CANVAS_PRESET', presetId: '300x250' });
    expect(next.document.canvas.width).toBe(300);
    expect(next.document.canvas.height).toBe(250);
    expect(next.document.canvas.presetId).toBe('medium-rectangle');
  });

  it('marks manual canvas size edits as custom', () => {
    const state = createInitialState({ canvasPresetId: 'leaderboard' });
    const next = documentSceneReducer(state, { type: 'UPDATE_CANVAS_SIZE', width: 728, height: 90 });
    expect(next.document.canvas.width).toBe(728);
    expect(next.document.canvas.height).toBe(90);
    expect(next.document.canvas.presetId).toBe('custom');
  });
});
