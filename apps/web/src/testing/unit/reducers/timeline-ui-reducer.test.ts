import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { timelineUiReducer } from '../../../core/store/reducers/timeline-ui-reducer';

function createStateWithWidget() {
  const base = createInitialState();
  const scene = base.document.scenes[0];
  const widget = {
    id: 'widget_1',
    type: 'shape',
    name: 'Shape',
    sceneId: scene.id,
    zIndex: 1,
    frame: { x: 0, y: 0, width: 120, height: 80, rotation: 0 },
    style: { opacity: 1 },
    props: {},
    timeline: {
      startMs: 200,
      endMs: 1200,
      keyframes: [{ id: 'kf_1', property: 'x', atMs: 250, value: 0, easing: 'linear' }],
    },
  } as const;

  return {
    ...base,
    document: {
      ...base.document,
      scenes: [{ ...scene, widgetIds: [widget.id] }],
      widgets: { [widget.id]: widget },
      selection: { ...base.document.selection, widgetIds: [widget.id], primaryWidgetId: widget.id },
    },
  };
}

describe('timelineUiReducer', () => {
  it('clamps playhead to scene duration', () => {
    const state = createInitialState();
    const next = timelineUiReducer(state, { type: 'SET_PLAYHEAD', playheadMs: 999999 });
    expect(next.ui.playheadMs).toBeLessThanOrEqual(next.document.scenes[0].durationMs);
  });

  it('turns off playback when preview mode is disabled', () => {
    const base = createInitialState();
    const state = { ...base, ui: { ...base.ui, isPlaying: true, activeWidgetId: 'w1' } };
    const next = timelineUiReducer(state, { type: 'SET_PREVIEW_MODE', previewMode: false });
    expect(next.ui.isPlaying).toBe(false);
    expect(next.ui.activeWidgetId).toBeUndefined();
  });

  it('clamps added keyframes to the scene duration', () => {
    const state = createStateWithWidget();
    const next = timelineUiReducer(state, { type: 'ADD_KEYFRAME', widgetId: 'widget_1', property: 'opacity', atMs: 999999 });
    const keyframes = next.document.widgets.widget_1.timeline.keyframes ?? [];
    expect(keyframes.some((keyframe) => keyframe.property === 'opacity' && keyframe.atMs === next.document.scenes[0].durationMs)).toBe(true);
  });

  it('clamps moved keyframes inside the scene range', () => {
    const state = createStateWithWidget();
    const next = timelineUiReducer(state, { type: 'UPDATE_KEYFRAME', widgetId: 'widget_1', keyframeId: 'kf_1', patch: { atMs: -250 } });
    expect(next.document.widgets.widget_1.timeline.keyframes?.[0].atMs).toBe(0);
  });
});
