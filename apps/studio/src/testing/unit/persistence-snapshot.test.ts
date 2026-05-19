import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../domain/document/factories';
import { arePersistenceSnapshotsEqual, createPersistenceSnapshot } from '../../core/persistence/persistence-snapshot';
import { reduceBySlices } from '../../core/store/reducers';

describe('persistence snapshot', () => {
  it('drops transient runtime ui before persistence', () => {
    let state = createInitialState();
    state = reduceBySlices(state, { type: 'SET_PREVIEW_MODE', previewMode: true });
    state = reduceBySlices(state, { type: 'SET_PREVIEW_CONTEXT', previewContext: 'iphone14' });
    state = reduceBySlices(state, { type: 'SET_PLAYING', isPlaying: true });
    state = reduceBySlices(state, { type: 'SET_PLAYHEAD', playheadMs: 920 });
    state = reduceBySlices(state, { type: 'SET_HOVERED_WIDGET', widgetId: 'widget_1' });
    state = reduceBySlices(state, { type: 'SET_ACTIVE_WIDGET', widgetId: 'widget_2' });
    state = reduceBySlices(state, { type: 'SET_INSPECTOR_FOCUS', widgetId: 'widget_1', tab: 'behavior', keyframeId: 'kf_1' });

    const snapshot = createPersistenceSnapshot(state);

    expect(snapshot.ui.previewMode).toBe(false);
    expect(snapshot.ui.previewContext).toBe('iphone14');
    expect(snapshot.ui.isPlaying).toBe(false);
    expect(snapshot.ui.playheadMs).toBe(0);
    expect(snapshot.ui.hoveredWidgetId).toBeUndefined();
    expect(snapshot.ui.activeWidgetId).toBeUndefined();
    expect(snapshot.ui.inspectorFocus).toBeUndefined();
  });

  it('keeps the persistence snapshot stable across runtime-only changes', () => {
    const base = createInitialState();
    let runtimeChanged = reduceBySlices(base, { type: 'SET_PREVIEW_MODE', previewMode: true });
    runtimeChanged = reduceBySlices(runtimeChanged, { type: 'SET_PLAYHEAD', playheadMs: 1200 });
    runtimeChanged = reduceBySlices(runtimeChanged, { type: 'SET_HOVERED_WIDGET', widgetId: 'widget_1' });

    expect(arePersistenceSnapshotsEqual(runtimeChanged, base)).toBe(true);
  });

  it('treats preview frame selection as persistent project state', () => {
    const base = createInitialState();
    const withFrame = reduceBySlices(base, { type: 'SET_PREVIEW_CONTEXT', previewContext: 'article' });

    expect(arePersistenceSnapshotsEqual(withFrame, base)).toBe(false);
    expect(createPersistenceSnapshot(withFrame).ui.previewContext).toBe('article');
  });
});
