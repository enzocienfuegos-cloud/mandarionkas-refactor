import { describe, expect, it } from 'vitest';
import { buildTimelineDisplayRows } from '../../../timeline/timeline-utils';

describe('timeline display rows', () => {
  it('shows top-most root layers first in the timeline', () => {
    const rows = buildTimelineDisplayRows([
      {
        id: 'back',
        type: 'image',
        name: 'Back',
        sceneId: 'scene_1',
        zIndex: 0,
        frame: { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
        props: {},
        style: {},
        timeline: { startMs: 0, endMs: 1000 },
      },
      {
        id: 'front',
        type: 'text',
        name: 'Front',
        sceneId: 'scene_1',
        zIndex: 1,
        frame: { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
        props: {},
        style: {},
        timeline: { startMs: 0, endMs: 1000 },
      },
    ] as any, [], new Set());

    expect(rows.map((row) => row.widget.id)).toEqual(['front', 'back']);
  });

  it('shows top-most children first inside groups', () => {
    const rows = buildTimelineDisplayRows([
      {
        id: 'group_1',
        type: 'group',
        name: 'Group',
        sceneId: 'scene_1',
        zIndex: 2,
        frame: { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
        props: {},
        style: {},
        timeline: { startMs: 0, endMs: 1000 },
        childIds: ['child_back', 'child_front'],
      },
      {
        id: 'child_back',
        type: 'image',
        name: 'Child back',
        parentId: 'group_1',
        sceneId: 'scene_1',
        zIndex: 0,
        frame: { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
        props: {},
        style: {},
        timeline: { startMs: 0, endMs: 1000 },
      },
      {
        id: 'child_front',
        type: 'text',
        name: 'Child front',
        parentId: 'group_1',
        sceneId: 'scene_1',
        zIndex: 1,
        frame: { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
        props: {},
        style: {},
        timeline: { startMs: 0, endMs: 1000 },
      },
    ] as any, [], new Set());

    expect(rows.map((row) => row.widget.id)).toEqual(['group_1', 'child_front', 'child_back']);
  });

  it('keeps excluded layers in the list while removing only their time track', () => {
    const rows = buildTimelineDisplayRows([
      {
        id: 'visible',
        type: 'text',
        name: 'Visible',
        sceneId: 'scene_1',
        zIndex: 1,
        frame: { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
        props: {},
        style: {},
        timeline: { startMs: 0, endMs: 1000 },
      },
      {
        id: 'excluded',
        type: 'image',
        name: 'Excluded',
        sceneId: 'scene_1',
        zIndex: 0,
        frame: { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
        props: {},
        style: {},
        timeline: { startMs: 0, endMs: 1000, excluded: true },
      },
    ] as any, [], new Set());

    expect(rows.map((row) => row.widget.id)).toEqual(['excluded', 'visible']);
    expect(rows.find((row) => row.widget.id === 'excluded')?.widget.timeline.excluded).toBe(true);
  });
});
