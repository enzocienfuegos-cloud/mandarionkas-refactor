import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
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
});
