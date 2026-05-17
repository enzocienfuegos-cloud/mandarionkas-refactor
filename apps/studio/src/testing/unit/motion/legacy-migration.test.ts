import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { normalizeStudioState } from '../../../domain/document/normalize-state';
import type { WidgetNode } from '../../../domain/document/types';

describe('legacy motion migration', () => {
  it('normalizes legacy motion objects into formal slots and removes managed keyframes', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    const legacyMotion = {
      templateId: 'slide-in-left',
      config: { durationMs: 640, delayMs: 120, distancePx: 90 },
    };

    state.document.widgets.hero = {
      id: 'hero',
      type: 'image',
      name: 'Hero',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 200, height: 120, rotation: 0 },
      props: { src: 'hero.png', alt: 'Hero' },
      style: { animationPreset: 'fade-in' },
      // TODO(animation-engine): legacy fixtures intentionally bypass the formal motion slot shape.
      motion: legacyMotion as never,
      timeline: {
        startMs: 2000,
        endMs: 6000,
        keyframes: [
          { id: 'managed_1', atMs: 2120, property: 'opacity', value: 0, managedBy: 'motion:slide-in-left' },
        ],
      },
    } satisfies WidgetNode;
    state.document.scenes[0].widgetIds.push('hero');

    const normalized = normalizeStudioState(state);
    const widget = normalized.document.widgets.hero;

    expect(widget?.motion?.enter?.templateId).toBe('slide-in-left');
    expect(widget?.motion?.enter?.trigger).toBe('timeline');
    expect(widget?.timeline.keyframes?.some((keyframe) => keyframe.managedBy?.startsWith('motion:'))).toBe(false);
  });
});
