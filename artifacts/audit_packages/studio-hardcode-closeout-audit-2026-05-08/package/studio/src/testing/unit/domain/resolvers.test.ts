import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { resolveWidgetSnapshot, resolveNextSceneId } from '../../../domain/document/resolvers';

describe('document resolvers', () => {
  it('applies bindings and variant overrides to widget snapshot', () => {
    const state = createInitialState();
    const widgetId = Object.keys(state.document.widgets)[0] ?? 'widget_test';
    state.document.feeds.custom = [{ id: 'record_1', values: { title: 'Bound Title', color: '#ff0000' } }];
    state.ui.activeFeedSource = 'custom';
    state.ui.activeFeedRecordId = 'record_1';
    state.ui.activeVariant = 'promo';
    state.document.widgets[widgetId] = {
      id: widgetId,
      type: 'text',
      name: 'Headline',
      sceneId: state.document.scenes[0].id,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 100, height: 20, rotation: 0 },
      style: { color: '#111111' },
      props: { text: 'Default' },
      bindings: {
        text: { source: 'custom', field: 'title', fallback: 'Fallback' },
        'style.color': { source: 'custom', field: 'color', fallback: '#000000' },
      },
      variants: {
        promo: { props: { badge: 'SALE' }, style: { fontWeight: 700 } },
      },
      timeline: { startMs: 0, endMs: 1000 },
    };

    const snapshot = resolveWidgetSnapshot(state.document.widgets[widgetId], state);
    expect(snapshot.props.text).toBe('Bound Title');
    expect(snapshot.props.badge).toBe('SALE');
    expect(snapshot.style.color).toBe('#ff0000');
    expect(snapshot.style.fontWeight).toBe(700);
  });

  it('resolves next scene using branch rule before sequential fallback', () => {
    const state = createInitialState();
    state.document.feeds.custom = [{ id: 'record_1', values: { segment: 'vip' } }];
    state.ui.activeFeedSource = 'custom';
    state.ui.activeFeedRecordId = 'record_1';

    const first = state.document.scenes[0];
    const second = { ...first, id: 'scene_2', name: 'Scene 2', order: 1, widgetIds: [] };
    const third = { ...first, id: 'scene_3', name: 'Scene 3', order: 2, widgetIds: [] };
    state.document.scenes = [
      {
        ...first,
        flow: {
          branches: [
            { source: 'custom', field: 'segment', operator: 'equals', value: 'vip', targetSceneId: 'scene_3' },
          ],
        },
      },
      second,
      third,
    ];

    expect(resolveNextSceneId(state, first.id)).toBe('scene_3');
  });
});
