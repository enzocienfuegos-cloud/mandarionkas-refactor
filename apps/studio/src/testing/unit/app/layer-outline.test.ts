import { describe, expect, it } from 'vitest';
import { buildLayerOutline, flattenVisibleLayerIds, getWidgetReorderSteps } from '../../../app/shell/left-rail/layer-outline';
import { createInitialState } from '../../../domain/document/factories';

describe('layer outline helpers', () => {
  it('builds a hierarchical outline from scene widget ids and parent links', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    const group = {
      id: 'group_1',
      type: 'group',
      name: 'Group',
      sceneId,
      zIndex: 2,
      frame: { x: 0, y: 0, width: 100, height: 100, rotation: 0 },
      props: {},
      style: {},
      timeline: { startMs: 0, endMs: 1000 },
      childIds: ['text_1'],
    } as const;
    const text = {
      id: 'text_1',
      type: 'text',
      name: 'Headline',
      sceneId,
      zIndex: 1,
      parentId: 'group_1',
      frame: { x: 0, y: 0, width: 100, height: 50, rotation: 0 },
      props: {},
      style: {},
      timeline: { startMs: 0, endMs: 1000 },
    } as const;
    const image = {
      id: 'image_1',
      type: 'image',
      name: 'Hero',
      sceneId,
      zIndex: 0,
      frame: { x: 0, y: 0, width: 100, height: 50, rotation: 0 },
      props: {},
      style: {},
      timeline: { startMs: 0, endMs: 1000 },
    } as const;

    const outline = buildLayerOutline(
      { widgetIds: ['image_1', 'group_1', 'text_1'] },
      { image_1: image, group_1: group, text_1: text },
    );

    expect(outline.map((item) => item.widget.id)).toEqual(['group_1', 'image_1']);
    expect(outline[0]?.children.map((item) => item.widget.id)).toEqual(['text_1']);
  });

  it('flattens only expanded items into visible order', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    const outline = buildLayerOutline(
      { widgetIds: ['group_1', 'text_1', 'image_1'] },
      {
        group_1: {
          id: 'group_1',
          type: 'group',
          name: 'Group',
          sceneId,
          zIndex: 2,
          frame: { x: 0, y: 0, width: 100, height: 100, rotation: 0 },
          props: {},
          style: {},
          timeline: { startMs: 0, endMs: 1000 },
          childIds: ['text_1'],
        },
        text_1: {
          id: 'text_1',
          type: 'text',
          name: 'Headline',
          sceneId,
          zIndex: 1,
          parentId: 'group_1',
          frame: { x: 0, y: 0, width: 100, height: 50, rotation: 0 },
          props: {},
          style: {},
          timeline: { startMs: 0, endMs: 1000 },
        },
        image_1: {
          id: 'image_1',
          type: 'image',
          name: 'Hero',
          sceneId,
          zIndex: 0,
          frame: { x: 0, y: 0, width: 100, height: 50, rotation: 0 },
          props: {},
          style: {},
          timeline: { startMs: 0, endMs: 1000 },
        },
      },
    );

    expect(flattenVisibleLayerIds(outline, new Set())).toEqual(['image_1', 'group_1', 'text_1']);
    expect(flattenVisibleLayerIds(outline, new Set(['group_1']))).toEqual(['image_1', 'group_1']);
  });

  it('returns reorder steps that place the dragged widget before the drop target', () => {
    expect(getWidgetReorderSteps(['a', 'b', 'c', 'd'], 'a', 'd')).toEqual(['forward', 'forward', 'forward']);
    expect(getWidgetReorderSteps(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['backward']);
    expect(getWidgetReorderSteps(['a', 'b', 'c'], 'b', 'b')).toEqual([]);
  });
});
