import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { buildResolvedWidgetsById } from '../../../domain/document/canvas-variants';
import { reduceBySlices } from '../../../core/store/reducers';

describe('widget reducer slices', () => {
  it('creates and selects a widget', () => {
    let state = createInitialState();
    state = reduceBySlices(state, { type: 'CREATE_WIDGET', widgetType: 'text' });
    const ids = Object.keys(state.document.widgets);
    expect(ids).toHaveLength(1);
    expect(state.document.selection.widgetIds).toEqual(ids);
    expect(state.document.scenes[0].widgetIds).toEqual(ids);
  });

  it('creates a widget at a dropped point and clamps it into the canvas', () => {
    let state = createInitialState();
    state = reduceBySlices(state, { type: 'CREATE_WIDGET', widgetType: 'text', placement: { x: 15, y: 20, anchor: 'center' } });
    const widget = Object.values(state.document.widgets)[0];
    expect(widget.frame.x).toBe(0);
    expect(widget.frame.y).toBe(0);

    state = createInitialState();
    state = reduceBySlices(state, { type: 'CREATE_WIDGET', widgetType: 'text', placement: { x: 2000, y: 2000, anchor: 'center' } });
    const clamped = Object.values(state.document.widgets)[0];
    expect(clamped.frame.x + clamped.frame.width).toBeLessThanOrEqual(state.document.canvas.width);
    expect(clamped.frame.y + clamped.frame.height).toBeLessThanOrEqual(state.document.canvas.height);
  });

  it('duplicates selected widgets', () => {
    let state = createInitialState();
    state = reduceBySlices(state, { type: 'CREATE_WIDGET', widgetType: 'image' });
    const originalId = Object.keys(state.document.widgets)[0];
    state = reduceBySlices(state, { type: 'SELECT_WIDGETS', widgetIds: [originalId], primaryWidgetId: originalId });
    state = reduceBySlices(state, { type: 'DUPLICATE_SELECTED_WIDGETS' });
    expect(Object.keys(state.document.widgets)).toHaveLength(2);
  });

  it('groups selected widgets', () => {
    let state = createInitialState();
    state = reduceBySlices(state, { type: 'CREATE_WIDGET', widgetType: 'text' });
    state = reduceBySlices(state, { type: 'CREATE_WIDGET', widgetType: 'shape' });
    const ids = Object.keys(state.document.widgets);
    state = reduceBySlices(state, { type: 'SELECT_WIDGETS', widgetIds: ids, primaryWidgetId: ids[0] });
    state = reduceBySlices(state, { type: 'GROUP_SELECTED_WIDGETS' });

    const groups = Object.values(state.document.widgets).filter((widget) => widget.type === 'group');
    expect(groups).toHaveLength(1);
    expect(groups[0].childIds?.length).toBe(2);
  });

  it('stores local frame overrides on non-master canvas variants', () => {
    let state = createInitialState({ canvasPresetId: 'wide-skyscraper' });
    state = reduceBySlices(state, { type: 'CREATE_WIDGET', widgetType: 'text' });
    const widgetId = Object.keys(state.document.widgets)[0];
    const masterX = state.document.widgets[widgetId].frame.x;

    state = reduceBySlices(state, { type: 'ADD_CANVAS_VARIANT', presetId: 'leaderboard' });
    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_FRAME', widgetId, patch: { x: masterX + 120 } });

    const activeVariantId = state.document.activeCanvasVariantId;
    expect(state.document.widgets[widgetId].frame.x).toBe(masterX);
    expect(state.document.widgetOverrides[activeVariantId]?.[widgetId]?.frame).toMatchObject({ x: masterX + 120 });
    expect(buildResolvedWidgetsById(state.document)[widgetId]?.frame.x).toBe(masterX + 120);
  });

  it('keeps master frame edits propagating to variants without local overrides', () => {
    let state = createInitialState({ canvasPresetId: 'wide-skyscraper' });
    state = reduceBySlices(state, { type: 'CREATE_WIDGET', widgetType: 'text' });
    const widgetId = Object.keys(state.document.widgets)[0];

    state = reduceBySlices(state, { type: 'ADD_CANVAS_VARIANT', presetId: 'leaderboard' });
    const variantId = state.document.activeCanvasVariantId;
    const masterId = state.document.canvasVariants.find((variant) => variant.isMaster)?.id ?? '';
    state = reduceBySlices(state, { type: 'SELECT_CANVAS_VARIANT', variantId: masterId });
    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_FRAME', widgetId, patch: { x: 222 } });
    state = reduceBySlices(state, { type: 'SELECT_CANVAS_VARIANT', variantId });

    expect(state.document.widgetOverrides[variantId]?.[widgetId]?.frame).toBeUndefined();
    expect(buildResolvedWidgetsById(state.document)[widgetId]?.frame.x).toBe(222);
  });

  it('clears a local frame override when the variant is reset back to the master values', () => {
    let state = createInitialState({ canvasPresetId: 'wide-skyscraper' });
    state = reduceBySlices(state, { type: 'CREATE_WIDGET', widgetType: 'text' });
    const widgetId = Object.keys(state.document.widgets)[0];
    const masterFrame = { ...state.document.widgets[widgetId].frame };

    state = reduceBySlices(state, { type: 'ADD_CANVAS_VARIANT', presetId: 'leaderboard' });
    const variantId = state.document.activeCanvasVariantId;
    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_FRAME', widgetId, patch: { x: masterFrame.x + 64, y: masterFrame.y + 40 } });
    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_FRAME', widgetId, patch: masterFrame });

    expect(state.document.widgetOverrides[variantId]?.[widgetId]?.frame).toBeUndefined();
    expect(buildResolvedWidgetsById(state.document)[widgetId]?.frame.x).toBe(masterFrame.x);
    expect(buildResolvedWidgetsById(state.document)[widgetId]?.frame.y).toBe(masterFrame.y);
  });

  it('stores local style overrides on non-master canvas variants', () => {
    let state = createInitialState({ canvasPresetId: 'wide-skyscraper' });
    state = reduceBySlices(state, { type: 'CREATE_WIDGET', widgetType: 'text' });
    const widgetId = Object.keys(state.document.widgets)[0];
    const masterOpacity = Number(state.document.widgets[widgetId].style.opacity ?? 1);

    state = reduceBySlices(state, { type: 'ADD_CANVAS_VARIANT', presetId: 'leaderboard' });
    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_STYLE', widgetId, patch: { opacity: 0.42 } });

    const activeVariantId = state.document.activeCanvasVariantId;
    expect(Number(state.document.widgets[widgetId].style.opacity ?? 1)).toBe(masterOpacity);
    expect(state.document.widgetOverrides[activeVariantId]?.[widgetId]?.style).toMatchObject({ opacity: 0.42 });
    expect(Number(buildResolvedWidgetsById(state.document)[widgetId]?.style.opacity ?? 1)).toBe(0.42);
  });

  it('keeps master style edits propagating to variants without local overrides', () => {
    let state = createInitialState({ canvasPresetId: 'wide-skyscraper' });
    state = reduceBySlices(state, { type: 'CREATE_WIDGET', widgetType: 'text' });
    const widgetId = Object.keys(state.document.widgets)[0];

    state = reduceBySlices(state, { type: 'ADD_CANVAS_VARIANT', presetId: 'leaderboard' });
    const variantId = state.document.activeCanvasVariantId;
    const masterId = state.document.canvasVariants.find((variant) => variant.isMaster)?.id ?? '';
    state = reduceBySlices(state, { type: 'SELECT_CANVAS_VARIANT', variantId: masterId });
    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_STYLE', widgetId, patch: { opacity: 0.33 } });
    state = reduceBySlices(state, { type: 'SELECT_CANVAS_VARIANT', variantId });

    expect(state.document.widgetOverrides[variantId]?.[widgetId]?.style).toBeUndefined();
    expect(Number(buildResolvedWidgetsById(state.document)[widgetId]?.style.opacity ?? 1)).toBe(0.33);
  });

  it('stores local props overrides on non-master canvas variants and clears them when reset to master', () => {
    let state = createInitialState({ canvasPresetId: 'wide-skyscraper' });
    state = reduceBySlices(state, { type: 'CREATE_WIDGET', widgetType: 'text' });
    const widgetId = Object.keys(state.document.widgets)[0];
    const masterLockAspectRatio = state.document.widgets[widgetId].props.lockAspectRatio;

    state = reduceBySlices(state, { type: 'ADD_CANVAS_VARIANT', presetId: 'leaderboard' });
    const variantId = state.document.activeCanvasVariantId;
    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_PROPS', widgetId, patch: { lockAspectRatio: !Boolean(masterLockAspectRatio) } });

    expect(state.document.widgets[widgetId].props.lockAspectRatio).toBe(masterLockAspectRatio);
    expect(state.document.widgetOverrides[variantId]?.[widgetId]?.props).toMatchObject({ lockAspectRatio: !Boolean(masterLockAspectRatio) });
    expect(Boolean(buildResolvedWidgetsById(state.document)[widgetId]?.props.lockAspectRatio)).toBe(!Boolean(masterLockAspectRatio));

    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_PROPS', widgetId, patch: { lockAspectRatio: masterLockAspectRatio } });
    expect(state.document.widgetOverrides[variantId]?.[widgetId]?.props).toBeUndefined();
    expect(buildResolvedWidgetsById(state.document)[widgetId]?.props.lockAspectRatio).toBe(masterLockAspectRatio);
  });

  it('converts a single widget into a shared layer across scenes', () => {
    let state = createInitialState();
    state = reduceBySlices(state, { type: 'ADD_SCENE' });
    const secondSceneId = state.document.scenes[1].id;
    state = reduceBySlices(state, { type: 'SELECT_SCENE', sceneId: state.document.scenes[0].id });
    state = reduceBySlices(state, { type: 'CREATE_WIDGET', widgetType: 'text' });
    const widgetId = Object.keys(state.document.widgets)[0];

    state = reduceBySlices(state, { type: 'CONVERT_WIDGET_TO_SHARED_LAYER', widgetId });

    const sharedLayer = Object.values(state.document.sharedLayers)[0];
    expect(sharedLayer).toBeTruthy();
    expect(state.document.widgets[widgetId]?.sharedLayerId).toBe(sharedLayer?.id);
    const sceneTwoWidgetId = sharedLayer?.sceneWidgetIds[secondSceneId];
    expect(sceneTwoWidgetId).toBeTruthy();
    expect(state.document.scenes[1].widgetIds.includes(sceneTwoWidgetId ?? '')).toBe(true);
    expect(state.document.widgets[sceneTwoWidgetId ?? '']?.sharedLayerId).toBe(sharedLayer?.id);
  });

  it('propagates shared layer base edits into other scenes', () => {
    let state = createInitialState();
    state = reduceBySlices(state, { type: 'ADD_SCENE' });
    const secondSceneId = state.document.scenes[1].id;
    state = reduceBySlices(state, { type: 'SELECT_SCENE', sceneId: state.document.scenes[0].id });
    state = reduceBySlices(state, { type: 'CREATE_WIDGET', widgetType: 'text' });
    const widgetId = Object.keys(state.document.widgets)[0];

    state = reduceBySlices(state, { type: 'CONVERT_WIDGET_TO_SHARED_LAYER', widgetId });
    const sharedLayer = Object.values(state.document.sharedLayers)[0];
    const sceneTwoWidgetId = sharedLayer?.sceneWidgetIds[secondSceneId] ?? '';

    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_PROPS', widgetId, patch: { text: 'Shared headline' } });
    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_STYLE', widgetId, patch: { color: '#ff0000' } });

    const resolvedWidgets = buildResolvedWidgetsById(state.document);
    expect(resolvedWidgets[widgetId]?.props.text).toBe('Shared headline');
    expect(resolvedWidgets[sceneTwoWidgetId]?.props.text).toBe('Shared headline');
    expect(resolvedWidgets[sceneTwoWidgetId]?.style.color).toBe('#ff0000');
  });

  it('stores per-scene overrides when editing a shared layer clone', () => {
    let state = createInitialState();
    state = reduceBySlices(state, { type: 'ADD_SCENE' });
    const secondSceneId = state.document.scenes[1].id;
    state = reduceBySlices(state, { type: 'SELECT_SCENE', sceneId: state.document.scenes[0].id });
    state = reduceBySlices(state, { type: 'CREATE_WIDGET', widgetType: 'text' });
    const widgetId = Object.keys(state.document.widgets)[0];

    state = reduceBySlices(state, { type: 'CONVERT_WIDGET_TO_SHARED_LAYER', widgetId });
    const sharedLayer = Object.values(state.document.sharedLayers)[0];
    const sceneTwoWidgetId = sharedLayer?.sceneWidgetIds[secondSceneId] ?? '';

    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_FRAME', widgetId: sceneTwoWidgetId, patch: { x: 140 } });
    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_STYLE', widgetId: sceneTwoWidgetId, patch: { color: '#00ff00' } });
    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_PROPS', widgetId: sceneTwoWidgetId, patch: { text: 'Scene override' } });

    const nextSharedLayer = state.document.sharedLayers[sharedLayer?.id ?? ''];
    expect(nextSharedLayer?.perSceneOverrides[secondSceneId]?.frame).toMatchObject({ x: 140 });
    expect(nextSharedLayer?.perSceneOverrides[secondSceneId]?.style).toMatchObject({ color: '#00ff00' });
    expect(nextSharedLayer?.perSceneOverrides[secondSceneId]?.props).toMatchObject({ text: 'Scene override' });
    expect(state.document.widgets[widgetId]?.props.text).not.toBe('Scene override');

    const resolvedWidgets = buildResolvedWidgetsById(state.document);
    expect(resolvedWidgets[sceneTwoWidgetId]?.frame.x).toBe(140);
    expect(resolvedWidgets[sceneTwoWidgetId]?.style.color).toBe('#00ff00');
    expect(resolvedWidgets[sceneTwoWidgetId]?.props.text).toBe('Scene override');
  });

  it('clears per-scene shared layer overrides when they match the base widget again', () => {
    let state = createInitialState();
    state = reduceBySlices(state, { type: 'ADD_SCENE' });
    const secondSceneId = state.document.scenes[1].id;
    state = reduceBySlices(state, { type: 'SELECT_SCENE', sceneId: state.document.scenes[0].id });
    state = reduceBySlices(state, { type: 'CREATE_WIDGET', widgetType: 'text' });
    const widgetId = Object.keys(state.document.widgets)[0];

    state = reduceBySlices(state, { type: 'CONVERT_WIDGET_TO_SHARED_LAYER', widgetId });
    const sharedLayer = Object.values(state.document.sharedLayers)[0];
    const sceneTwoWidgetId = sharedLayer?.sceneWidgetIds[secondSceneId] ?? '';
    const baseWidget = state.document.widgets[widgetId];

    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_FRAME', widgetId: sceneTwoWidgetId, patch: { x: baseWidget.frame.x + 20 } });
    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_STYLE', widgetId: sceneTwoWidgetId, patch: { color: '#00ff00' } });
    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_PROPS', widgetId: sceneTwoWidgetId, patch: { text: 'Scene override' } });

    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_FRAME', widgetId: sceneTwoWidgetId, patch: { x: baseWidget.frame.x } });
    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_STYLE', widgetId: sceneTwoWidgetId, patch: { color: baseWidget.style.color } });
    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_PROPS', widgetId: sceneTwoWidgetId, patch: { text: baseWidget.props.text } });

    expect(state.document.sharedLayers[sharedLayer?.id ?? '']?.perSceneOverrides[secondSceneId]).toBeUndefined();
  });
});
