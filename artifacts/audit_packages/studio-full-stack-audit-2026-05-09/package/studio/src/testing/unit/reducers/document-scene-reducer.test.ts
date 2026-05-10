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
    expect(next.document.canvasVariants[0]?.label).toBe('300×250');
  });

  it('marks manual canvas size edits as custom', () => {
    const state = createInitialState({ canvasPresetId: 'leaderboard' });
    const next = documentSceneReducer(state, { type: 'UPDATE_CANVAS_SIZE', width: 728, height: 90 });
    expect(next.document.canvas.width).toBe(728);
    expect(next.document.canvas.height).toBe(90);
    expect(next.document.canvas.presetId).toBe('custom');
    expect(next.document.canvasVariants[0]?.label).toBe('728×90');
  });

  it('adds a second canvas variant and switches the active canvas to it', () => {
    const state = createInitialState({ canvasPresetId: 'wide-skyscraper' });
    const next = documentSceneReducer(state, { type: 'ADD_CANVAS_VARIANT', presetId: 'medium-rectangle' });
    expect(next.document.canvasVariants).toHaveLength(2);
    expect(next.document.canvas.width).toBe(300);
    expect(next.document.canvas.height).toBe(250);
    expect(next.document.canvasVariants.find((variant) => variant.id === next.document.activeCanvasVariantId)?.label).toBe('300×250');
  });

  it('switches between canvas variants without mutating the master dimensions', () => {
    const base = createInitialState({ canvasPresetId: 'wide-skyscraper' });
    const withVariant = documentSceneReducer(base, { type: 'ADD_CANVAS_VARIANT', presetId: 'leaderboard' });
    const masterId = withVariant.document.canvasVariants.find((variant) => variant.isMaster)?.id ?? withVariant.document.canvasVariants[0]?.id;
    const switchedBack = documentSceneReducer(withVariant, { type: 'SELECT_CANVAS_VARIANT', variantId: masterId });

    expect(switchedBack.document.canvas.width).toBe(300);
    expect(switchedBack.document.canvas.height).toBe(600);
    expect(switchedBack.document.activeCanvasVariantId).toBe(masterId);
  });

  it('duplicates a canvas variant and carries its local overrides forward', () => {
    let state = createInitialState({ canvasPresetId: 'wide-skyscraper' });
    state = documentSceneReducer(state, { type: 'ADD_CANVAS_VARIANT', presetId: 'leaderboard' });
    const sourceVariantId = state.document.activeCanvasVariantId;
    state = {
      ...state,
      document: {
        ...state.document,
        widgetOverrides: {
          ...state.document.widgetOverrides,
          [sourceVariantId]: {
            widget_demo: {
              frame: { x: 24 },
              style: { opacity: 0.5 },
            },
          },
        },
      },
    };

    const next = documentSceneReducer(state, { type: 'DUPLICATE_CANVAS_VARIANT', variantId: sourceVariantId });
    const duplicatedVariant = next.document.canvasVariants.at(-1);

    expect(duplicatedVariant?.label).toBe('970×250 Copy');
    expect(next.document.activeCanvasVariantId).toBe(duplicatedVariant?.id);
    expect(duplicatedVariant?.isMaster).toBe(false);
    expect(next.document.widgetOverrides[duplicatedVariant?.id ?? '']?.widget_demo?.frame).toEqual({ x: 24 });
    expect(next.document.widgetOverrides[duplicatedVariant?.id ?? '']?.widget_demo?.style).toEqual({ opacity: 0.5 });
  });

  it('promotes a variant to master and preserves a single master after deleting the old one', () => {
    let state = createInitialState({ canvasPresetId: 'wide-skyscraper' });
    state = documentSceneReducer(state, { type: 'ADD_CANVAS_VARIANT', presetId: 'leaderboard' });
    const promotedVariantId = state.document.activeCanvasVariantId;
    const masterVariantId = state.document.canvasVariants.find((variant) => variant.isMaster)?.id ?? '';

    state = documentSceneReducer(state, { type: 'SET_MASTER_CANVAS_VARIANT', variantId: promotedVariantId });
    expect(state.document.canvasVariants.find((variant) => variant.id === promotedVariantId)?.isMaster).toBe(true);
    expect(state.document.canvasVariants.find((variant) => variant.id === masterVariantId)?.isMaster).toBe(false);

    state = documentSceneReducer(state, { type: 'DELETE_CANVAS_VARIANT', variantId: masterVariantId });
    expect(state.document.canvasVariants).toHaveLength(1);
    expect(state.document.canvasVariants[0]?.id).toBe(promotedVariantId);
    expect(state.document.canvasVariants[0]?.isMaster).toBe(true);
  });

  it('offsets duplicated scene canvas positions to avoid overlap in story flow canvas', () => {
    const base = createInitialState();
    const sourceScene = {
      ...base.document.scenes[0],
      flow: {
        ...base.document.scenes[0].flow,
        canvas: { x: 120, y: 80 },
      },
    };
    const state = {
      ...base,
      document: {
        ...base.document,
        scenes: [sourceScene],
      },
    };

    const next = documentSceneReducer(state, { type: 'DUPLICATE_SCENE', sceneId: sourceScene.id });
    const clonedScene = next.document.scenes.at(-1);

    expect(clonedScene?.flow?.canvas).toEqual({ x: 160, y: 120 });
  });
});
