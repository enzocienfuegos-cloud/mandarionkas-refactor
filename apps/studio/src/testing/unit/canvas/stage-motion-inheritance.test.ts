import { describe, expect, it } from 'vitest';
import type { WidgetNode } from '../../../domain/document/types';
import { resolveInheritedMotionFrame, resolveInheritedOpacity, isVisibleWithinParentTimeline } from '../../../canvas/stage/components/stage-motion-inheritance';
import { getLiveWidgetFrame } from '../../../domain/document/timeline';

function createWidget(overrides: Partial<WidgetNode> & Pick<WidgetNode, 'id' | 'type'>): WidgetNode {
  return {
    id: overrides.id,
    type: overrides.type,
    name: overrides.name ?? overrides.id,
    sceneId: overrides.sceneId ?? 'scene_1',
    zIndex: overrides.zIndex ?? 1,
    frame: overrides.frame ?? { x: 0, y: 0, width: 120, height: 60, rotation: 0 },
    props: overrides.props ?? {},
    style: overrides.style ?? { opacity: 1 },
    timeline: overrides.timeline ?? { startMs: 0, endMs: 1500 },
    parentId: overrides.parentId,
    childIds: overrides.childIds,
    hidden: overrides.hidden,
    locked: overrides.locked,
    motion: overrides.motion,
    hoverMotion: overrides.hoverMotion,
    bindings: overrides.bindings,
    variants: overrides.variants,
    conditions: overrides.conditions,
    sharedLayerId: overrides.sharedLayerId,
  };
}

describe('stage motion inheritance', () => {
  it('offsets child frames by animated parent deltas so grouped layers move as one', () => {
    const group = createWidget({
      id: 'group_1',
      type: 'group',
      frame: { x: 100, y: 80, width: 240, height: 160, rotation: 0 },
      timeline: {
        startMs: 0,
        endMs: 1500,
        keyframes: [
          { id: 'gk_1', property: 'y', atMs: 0, value: 120, easing: 'ease-out', managedBy: 'motion:fade-up' },
          { id: 'gk_2', property: 'y', atMs: 700, value: 80, easing: 'ease-out', managedBy: 'motion:fade-up' },
        ],
      },
      childIds: ['text_1'],
    });
    const text = createWidget({
      id: 'text_1',
      type: 'text',
      parentId: 'group_1',
      frame: { x: 140, y: 120, width: 160, height: 40, rotation: 0 },
    });

    const frameAtStart = resolveInheritedMotionFrame({
      widget: text,
      widgetsById: { group_1: group, text_1: text },
      liveFrameById: {},
      playheadMs: 0,
      getLiveFrame: getLiveWidgetFrame,
      ownFrame: text.frame,
    });
    const frameAtEnd = resolveInheritedMotionFrame({
      widget: text,
      widgetsById: { group_1: group, text_1: text },
      liveFrameById: {},
      playheadMs: 700,
      getLiveFrame: getLiveWidgetFrame,
      ownFrame: text.frame,
    });

    expect(frameAtStart.y).toBe(160);
    expect(frameAtEnd.y).toBe(120);
  });

  it('multiplies child opacity by animated parent opacity so grouped layers fade together', () => {
    const group = createWidget({
      id: 'group_1',
      type: 'group',
      style: { opacity: 1 },
      timeline: {
        startMs: 0,
        endMs: 1500,
        keyframes: [
          { id: 'go_1', property: 'opacity', atMs: 0, value: 0.5, easing: 'linear', managedBy: 'motion:pulse' },
          { id: 'go_2', property: 'opacity', atMs: 400, value: 1, easing: 'linear', managedBy: 'motion:pulse' },
        ],
      },
      childIds: ['cta_1'],
    });
    const cta = createWidget({
      id: 'cta_1',
      type: 'cta',
      parentId: 'group_1',
      style: { opacity: 0.8 },
    });

    expect(resolveInheritedOpacity({
      widget: cta,
      widgetsById: { group_1: group, cta_1: cta },
      playheadMs: 0,
      ownOpacity: 0.8,
    })).toBeCloseTo(0.4);
  });

  it('treats child layers as invisible when their parent group is outside the timeline', () => {
    const group = createWidget({
      id: 'group_1',
      type: 'group',
      timeline: { startMs: 1000, endMs: 2000 },
      childIds: ['image_1'],
    });
    const image = createWidget({
      id: 'image_1',
      type: 'image',
      parentId: 'group_1',
    });

    expect(isVisibleWithinParentTimeline({
      widget: image,
      widgetsById: { group_1: group, image_1: image },
      isWidgetVisible: (widgetId) => widgetId !== 'group_1',
    })).toBe(false);
  });
});
