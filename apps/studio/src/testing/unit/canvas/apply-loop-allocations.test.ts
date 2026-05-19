import { describe, expect, it } from 'vitest';
import { getLiveWidgetFrame } from '../../../domain/document/timeline';
import type { WidgetNode } from '../../../domain/document/types';

function createWidget(overrides: Partial<WidgetNode> = {}): WidgetNode {
  return {
    id: 'widget_1',
    type: 'shape',
    name: 'Shape',
    sceneId: 'scene_1',
    zIndex: 1,
    frame: { x: 0, y: 0, width: 100, height: 50, rotation: 0 },
    style: { opacity: 1 },
    props: {},
    timeline: {
      startMs: 0,
      endMs: 2000,
      keyframes: [],
    },
    ...overrides,
  };
}

describe('getLiveWidgetFrame allocation behavior', () => {
  it('returns the same frame reference when the widget has no keyframes', () => {
    const widget = createWidget();

    expect(getLiveWidgetFrame(widget, 0)).toBe(widget.frame);
    expect(getLiveWidgetFrame(widget, 500)).toBe(widget.frame);
  });

  it('returns the same frame reference when keyframes do not change frame values at the playhead', () => {
    const widget = createWidget({
      timeline: {
        startMs: 0,
        endMs: 2000,
        keyframes: [{ id: 'opacity_1', property: 'opacity', atMs: 500, value: 0.5, easing: 'linear' }],
      },
    });

    expect(getLiveWidgetFrame(widget, 250)).toBe(widget.frame);
  });

  it('reuses cached tracks across repeated calls', () => {
    const widget = createWidget({
      timeline: {
        startMs: 0,
        endMs: 2000,
        keyframes: [
          { id: 'x_1', property: 'x', atMs: 0, value: 0, easing: 'linear' },
          { id: 'x_2', property: 'x', atMs: 1000, value: 100, easing: 'linear' },
          { id: 'y_1', property: 'y', atMs: 500, value: 50, easing: 'linear' },
        ],
      },
    });

    const start = performance.now();
    for (let index = 0; index < 1000; index += 1) {
      getLiveWidgetFrame(widget, index);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  });
});
