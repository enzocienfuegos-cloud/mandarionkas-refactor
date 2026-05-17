import { describe, expect, it } from 'vitest';
import type { WidgetFrame, WidgetTimeline } from '../../../domain/document/types';
import { getMotionTemplate } from '../../../motion/motion-registry';

const frame: WidgetFrame = { x: 40, y: 80, width: 220, height: 80, rotation: 0 };
const timeline: WidgetTimeline = { startMs: 300, endMs: 2300 };

describe('motion templates build timeline keyframes', () => {
  it('builds appear opacity keyframes', () => {
    const template = getMotionTemplate('appear');
    const keyframes = template?.buildKeyframes({ durationMs: 700, delayMs: 100 }, frame, timeline) ?? [];

    expect(keyframes).toEqual([
      expect.objectContaining({ property: 'opacity', atMs: 400, value: 0 }),
      expect.objectContaining({ property: 'opacity', atMs: 1100, value: 1 }),
    ]);
  });

  it('builds fade-up with opacity and y tracks', () => {
    const template = getMotionTemplate('fade-up');
    const keyframes = template?.buildKeyframes({ durationMs: 700, delayMs: 0, distancePx: 24 }, frame, timeline) ?? [];

    expect(keyframes).toEqual(expect.arrayContaining([
      expect.objectContaining({ property: 'opacity', atMs: 300, value: 0 }),
      expect.objectContaining({ property: 'opacity', atMs: 1000, value: 1 }),
      expect.objectContaining({ property: 'y', atMs: 300, value: 104 }),
      expect.objectContaining({ property: 'y', atMs: 1000, value: 80 }),
    ]));
  });

  it('builds fade-out anchored to the end of the widget timeline', () => {
    const template = getMotionTemplate('fade-out');
    const keyframes = template?.buildKeyframes({ durationMs: 500 }, frame, timeline) ?? [];

    expect(keyframes).toEqual([
      expect.objectContaining({ property: 'opacity', atMs: 1800, value: 1 }),
      expect.objectContaining({ property: 'opacity', atMs: 2300, value: 0 }),
    ]);
  });

  it('builds pulse as finite opacity cycles across the widget timeline', () => {
    const template = getMotionTemplate('pulse');
    const keyframes = template?.buildKeyframes({ durationMs: 900, delayMs: 100, intensity: 0.55 }, frame, timeline) ?? [];

    expect(keyframes.length).toBeGreaterThan(3);
    expect(keyframes.every((keyframe) => keyframe.property === 'opacity')).toBe(true);
    expect(keyframes[0]?.atMs).toBe(400);
    expect(keyframes.at(-1)?.atMs).toBeLessThanOrEqual(2300);
  });

  it('builds float as compositor transform motion instead of timeline y cycles', () => {
    const template = getMotionTemplate('float');
    const keyframes = template?.buildKeyframes({ durationMs: 1200, delayMs: 0, distancePx: 8 }, frame, timeline) ?? [];
    const compositorMotion = template?.buildCompositorMotion?.({ durationMs: 1200, delayMs: 25, distancePx: 8 });

    expect(keyframes).toEqual([]);
    expect(compositorMotion?.willChange).toBe('transform');
    expect(compositorMotion?.options).toEqual(expect.objectContaining({
      duration: 1200,
      delay: 25,
      easing: 'cubic-bezier(0.45, 0, 0.55, 1)',
      iterations: 'infinite',
    }));
    expect(compositorMotion?.keyframes).toEqual([
      expect.objectContaining({ transform: 'translate3d(0, 0, 0)', offset: 0 }),
      expect.objectContaining({ transform: 'translate3d(0, -8px, 0)', offset: 0.25 }),
      expect.objectContaining({ transform: 'translate3d(0, 0, 0)', offset: 0.5 }),
      expect.objectContaining({ transform: 'translate3d(0, 8px, 0)', offset: 0.75 }),
      expect.objectContaining({ transform: 'translate3d(0, 0, 0)', offset: 1 }),
    ]);
  });
});
