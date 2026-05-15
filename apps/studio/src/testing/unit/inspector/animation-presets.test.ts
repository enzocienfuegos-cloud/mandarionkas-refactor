import { describe, expect, it } from 'vitest';
import type { WidgetNode } from '../../../domain/document/types';
import { applyAnimationPreset, supportsAnimationPresets } from '../../../inspector/sections/animation-presets';

function createWidget(type: WidgetNode['type']): WidgetNode {
  return {
    id: `${type}_1`,
    type,
    name: 'Widget',
    sceneId: 'scene_1',
    zIndex: 1,
    frame: { x: 40, y: 80, width: 220, height: 80, rotation: 0 },
    props: {},
    style: { opacity: 1 },
    timeline: { startMs: 300, endMs: 2000 },
  };
}

describe('animation presets', () => {
  it('supports presets for text, image, cta, buttons, and group widgets', () => {
    expect(supportsAnimationPresets(createWidget('text'))).toBe(true);
    expect(supportsAnimationPresets(createWidget('image'))).toBe(true);
    expect(supportsAnimationPresets(createWidget('cta'))).toBe(true);
    expect(supportsAnimationPresets(createWidget('buttons'))).toBe(true);
    expect(supportsAnimationPresets(createWidget('group'))).toBe(true);
    expect(supportsAnimationPresets(createWidget('scratch-reveal'))).toBe(false);
  });

  it('builds appear keyframes on the opacity track', () => {
    const { keyframes, stylePatch } = applyAnimationPreset(createWidget('text'), 'appear');

    expect(stylePatch.animationPreset).toBe('appear');
    expect(keyframes).toHaveLength(2);
    expect(keyframes.map((item) => item.property)).toEqual(['opacity', 'opacity']);
    expect(keyframes[0]?.value).toBe(0);
    expect(keyframes[1]?.value).toBe(1);
  });

  it('builds fade-up keyframes on opacity and y tracks', () => {
    const { keyframes } = applyAnimationPreset(createWidget('image'), 'fade-up');

    expect(keyframes.map((item) => item.property)).toEqual(['opacity', 'y', 'opacity', 'y']);
    expect(keyframes.find((item) => item.property === 'y')?.value).toBe(104);
  });

  it('builds pulse keyframes on the opacity track', () => {
    const { keyframes } = applyAnimationPreset(createWidget('cta'), 'pulse');

    expect(keyframes).toHaveLength(3);
    expect(keyframes.every((item) => item.property === 'opacity')).toBe(true);
    expect(keyframes[1]?.value).toBeLessThan(1);
  });

  it('builds fade-out keyframes toward the end of the widget timeline', () => {
    const { keyframes, stylePatch } = applyAnimationPreset(createWidget('group'), 'fade-out');

    expect(stylePatch.animationPreset).toBe('fade-out');
    expect(keyframes).toHaveLength(2);
    expect(keyframes.map((item) => item.property)).toEqual(['opacity', 'opacity']);
    expect(keyframes[0]?.atMs).toBeLessThan(keyframes[1]?.atMs ?? 0);
    expect(keyframes[1]?.value).toBe(0);
  });
});
