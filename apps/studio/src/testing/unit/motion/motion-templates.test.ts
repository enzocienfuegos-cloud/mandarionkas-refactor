import { describe, expect, it } from 'vitest';
import type { WidgetNode } from '../../../domain/document/types';
import { getMotionTemplate } from '../../../motion/motion-registry';

const widget: WidgetNode = {
  id: 'widget_1',
  type: 'text',
  name: 'Widget',
  sceneId: 'scene_1',
  zIndex: 1,
  frame: { x: 40, y: 80, width: 220, height: 80, rotation: 0 },
  props: { text: 'Preview' },
  style: { opacity: 1 },
  timeline: { startMs: 300, endMs: 2300 },
};

describe('motion templates build specs', () => {
  it('builds appear opacity spec', () => {
    const template = getMotionTemplate('appear');
    const spec = template?.buildSpec?.({ durationMs: 700, delayMs: 100 }, widget);

    expect(spec).toEqual({
      from: { opacity: 0 },
      to: { opacity: 1 },
      ease: 'expo.out',
      willChange: 'opacity',
    });
  });

  it('builds fade-up spec with opacity and y motion', () => {
    const template = getMotionTemplate('fade-up');
    const spec = template?.buildSpec?.({ durationMs: 700, delayMs: 0, distancePx: 24 }, widget);

    expect(spec).toEqual({
      from: { y: 24, opacity: 0 },
      to: { y: 0, opacity: 1 },
      ease: 'expo.out',
      willChange: 'transform, opacity',
    });
  });

  it('builds fade-out exit spec', () => {
    const template = getMotionTemplate('fade-out');
    const spec = template?.buildSpec?.({ durationMs: 500 }, widget);

    expect(spec).toEqual({
      from: { opacity: 1 },
      to: { opacity: 0 },
      ease: 'power2.in',
      willChange: 'opacity',
    });
  });

  it('builds pulse as an idle loop spec', () => {
    const template = getMotionTemplate('pulse');
    const spec = template?.buildSpec?.({ durationMs: 900, delayMs: 100, intensity: 0.55 }, widget);

    expect(template?.isLoop).toBe(true);
    expect(spec?.from).toEqual({ opacity: 1 });
    expect(spec?.to).toEqual({ opacity: 0.7525 });
    expect(spec?.ease).toBe('sine.inOut');
  });

  it('builds float idle spec and compositor transform motion', () => {
    const template = getMotionTemplate('float');
    const spec = template?.buildSpec?.({ durationMs: 1200, delayMs: 0, distancePx: 8 }, widget);
    const compositorMotion = template?.buildCompositorMotion?.({ durationMs: 1200, delayMs: 25, distancePx: 8 });

    expect(template?.isLoop).toBe(true);
    expect(spec).toEqual({
      from: { y: -8 },
      to: { y: 8 },
      ease: 'sine.inOut',
      willChange: 'transform',
    });
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
