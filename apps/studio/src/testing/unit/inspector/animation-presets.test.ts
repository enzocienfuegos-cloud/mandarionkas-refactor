import { describe, expect, it } from 'vitest';
import type { WidgetNode } from '../../../domain/document/types';
import { applyAnimationPreset, getAnimationPresetConfig, getHoverMotionConfig, supportsAnimationPresets } from '../../../inspector/sections/animation-presets';

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

  it('reads adjustable motion settings from widget style and applies them to generated keyframes', () => {
    const widget = createWidget('text');
    widget.style.animationDurationMs = 1200;
    widget.style.animationDelayMs = 180;
    widget.style.animationDistancePx = 36;
    widget.style.animationIntensity = 0.8;

    const config = getAnimationPresetConfig(widget);
    const { keyframes, stylePatch } = applyAnimationPreset(widget, 'fade-up');

    expect(config.durationMs).toBe(1200);
    expect(config.delayMs).toBe(180);
    expect(config.distancePx).toBe(36);
    expect(config.intensity).toBe(0.8);
    expect(stylePatch.animationDurationMs).toBe(1200);
    expect(stylePatch.animationDelayMs).toBe(180);
    expect(stylePatch.animationDistancePx).toBe(36);
    expect(keyframes.find((item) => item.property === 'opacity')?.atMs).toBe(480);
    expect(keyframes.find((item) => item.property === 'y')?.value).toBe(116);
  });

  it('reads hover motion settings with safe defaults', () => {
    const widget = createWidget('image');

    expect(getHoverMotionConfig(widget)).toEqual({
      preset: 'none',
      durationMs: 240,
      distancePx: 12,
      scale: 1.04,
    });

    widget.style.hoverMotionPreset = 'zoom';
    widget.style.hoverMotionDurationMs = 420;
    widget.style.hoverMotionDistancePx = 22;
    widget.style.hoverMotionScale = 1.12;

    expect(getHoverMotionConfig(widget)).toEqual({
      preset: 'zoom',
      durationMs: 420,
      distancePx: 22,
      scale: 1.12,
    });
  });
});
