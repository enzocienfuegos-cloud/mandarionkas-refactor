import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { documentSceneReducer } from '../../../core/store/reducers/document-scene-reducer';

describe('REORDER_SCENES', () => {
  function setupThreeScenes() {
    let state = createInitialState();
    state = documentSceneReducer(state, { type: 'ADD_SCENE' });
    state = documentSceneReducer(state, { type: 'ADD_SCENE' });
    return state;
  }

  it('moves scene from index 0 to index 2', () => {
    let state = setupThreeScenes();
    const originalIds = state.document.scenes.map((scene) => scene.id);
    state = documentSceneReducer(state, { type: 'REORDER_SCENES', fromIndex: 0, toIndex: 2 });
    expect(state.document.scenes[2]?.id).toBe(originalIds[0]);
    expect(state.document.scenes.map((scene) => scene.order)).toEqual([0, 1, 2]);
  });

  it('no-ops when fromIndex equals toIndex', () => {
    const state = setupThreeScenes();
    expect(documentSceneReducer(state, { type: 'REORDER_SCENES', fromIndex: 1, toIndex: 1 })).toBe(state);
  });

  it('returns the same state when indices are out of bounds', () => {
    const state = setupThreeScenes();
    expect(documentSceneReducer(state, { type: 'REORDER_SCENES', fromIndex: 5, toIndex: 0 })).toBe(state);
  });
});

describe('ADD_SCENE_FROM_CURRENT', () => {
  it('copies widgetIds from the current scene', () => {
    let state = createInitialState();
    state.document.scenes[0].widgetIds = ['w1', 'w2'];
    state = documentSceneReducer(state, { type: 'ADD_SCENE_FROM_CURRENT' });
    expect(state.document.scenes).toHaveLength(2);
    expect(state.document.scenes[1]?.widgetIds).toEqual(['w1', 'w2']);
  });
});
