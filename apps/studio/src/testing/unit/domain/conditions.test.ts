import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { resolveNextSceneId, sceneMatchesConditions, widgetMatchesConditions } from '../../../domain/document/resolvers';
import type { WidgetNode } from '../../../domain/document/types';

describe('conditions and scene flow', () => {
  it('evaluates widget conditions against active variant and feed record', () => {
    const state = createInitialState();
    state.ui.activeVariant = 'promo';
    state.ui.activeFeedSource = 'product';
    state.ui.activeFeedRecordId = 'product_clearance';

    const widget: WidgetNode = {
      id: 'widget_1',
      type: 'text',
      name: 'Promo headline',
      sceneId: state.document.scenes[0].id,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 100, height: 40, rotation: 0 },
      props: { text: 'Hello' },
      style: {},
      timeline: { startMs: 0, endMs: 1000 },
      conditions: {
        variants: ['promo'],
        records: ['product_clearance'],
        equals: { source: 'product', field: 'badge', value: 'Sale', operator: 'equals' },
      },
    };

    expect(widgetMatchesConditions(widget, state)).toBe(true);
    state.ui.activeVariant = 'alternate';
    expect(widgetMatchesConditions(widget, state)).toBe(false);
  });

  it('resolves next scene from branch rules before falling back to nextSceneId', () => {
    const state = createInitialState();
    const sceneA = state.document.scenes[0];
    const sceneB = { ...sceneA, id: 'scene_b', name: 'Scene B', order: 1, widgetIds: [] };
    const sceneC = {
      ...sceneA,
      id: 'scene_c',
      name: 'Scene C',
      order: 2,
      widgetIds: [],
      conditions: { equals: { source: 'custom', field: 'segment', value: 'B', operator: 'equals' } },
    };

    state.document.scenes = [
      {
        ...sceneA,
        flow: {
          nextSceneId: 'scene_b',
          branches: [
            { source: 'custom', field: 'headline', value: 'Alternate', operator: 'starts-with', targetSceneId: 'scene_c', label: 'Headline branch' },
          ],
        },
      },
      sceneB,
      sceneC,
    ];

    state.ui.activeFeedSource = 'custom';
    state.ui.activeFeedRecordId = 'custom_campaign_b';

    expect(resolveNextSceneId(state, sceneA.id)).toBe('scene_c');
    expect(sceneMatchesConditions(sceneC, state)).toBe(true);
  });
});
