import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { documentSceneReducer } from '../../../core/store/reducers/document-scene-reducer';
import { normalizeStudioState } from '../../../domain/document/normalize-state';
import { configureRepositoryServices, resetRepositoryServices } from '../../../repositories/services';
import { createInMemoryRepositoryServices } from '../../fakes/in-memory-repositories';
import { loadProject, saveProject } from '../../../repositories/project';

describe('scene persistence roundtrip', () => {
  beforeEach(() => {
    const services = createInMemoryRepositoryServices();
    configureRepositoryServices(() => services);
  });

  afterEach(() => {
    resetRepositoryServices();
  });

  it('preserves multiple scenes and their ids through save/load', async () => {
    let state = createInitialState();
    state = documentSceneReducer(state, { type: 'ADD_SCENE' });
    state = documentSceneReducer(state, { type: 'ADD_SCENE' });
    const summary = await saveProject(state);
    const loaded = await loadProject(summary.id);

    expect(loaded?.document.scenes).toHaveLength(3);
    expect(loaded?.document.scenes.map((scene) => scene.id).sort()).toEqual(
      state.document.scenes.map((scene) => scene.id).sort(),
    );
  });

  it('normalizeStudioState does not drop scenes', () => {
    let state = createInitialState();
    state = documentSceneReducer(state, { type: 'ADD_SCENE' });

    const normalized = normalizeStudioState(state);

    expect(normalized.document.scenes).toHaveLength(2);
  });

  it('preserves widgetIds across save/load when scenes share layers', async () => {
    let state = createInitialState();
    state.document.scenes[0].widgetIds = ['widget_a', 'widget_b'];
    state = documentSceneReducer(state, { type: 'ADD_SCENE_FROM_CURRENT' });

    const summary = await saveProject(state);
    const loaded = await loadProject(summary.id);

    expect(loaded?.document.scenes[0]?.widgetIds).toEqual(['widget_a', 'widget_b']);
    expect(loaded?.document.scenes[1]?.widgetIds).toEqual(['widget_a', 'widget_b']);
  });
});
