import { describe, expect, it } from 'vitest';
import type { WidgetNode } from '../../../domain/document/types';
import { applyAnimationPreset, getAnimationPresetConfig, getHoverMotionConfig, supportsAnimationPresets } from '../../../inspector/sections/animation-presets';
import { stripMotionManagedKeyframes } from '../../../motion/motion-managed-keyframes';

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

  it('translates appear into managed timeline keyframes', () => {
    const { keyframes, stylePatch } = applyAnimationPreset(createWidget('text'), 'appear');

    expect(stylePatch.animationPreset).toBe('appear');
    expect(keyframes).toHaveLength(2);
    expect(keyframes.every((keyframe) => keyframe.managedBy === 'motion:appear')).toBe(true);
  });

  it('translates fade-up into managed timeline keyframes', () => {
    const { keyframes } = applyAnimationPreset(createWidget('image'), 'fade-up');

    expect(keyframes.some((keyframe) => keyframe.property === 'opacity')).toBe(true);
    expect(keyframes.some((keyframe) => keyframe.property === 'y')).toBe(true);
  });

  it('translates pulse into managed timeline keyframes', () => {
    const { keyframes } = applyAnimationPreset(createWidget('cta'), 'pulse');

    expect(keyframes.length).toBeGreaterThan(2);
    expect(keyframes.every((keyframe) => keyframe.property === 'opacity')).toBe(true);
  });

  it('replaces previous preset-managed tracks when switching templates', () => {
    const widget = createWidget('cta');
    widget.timeline.keyframes = [
      { id: 'kf_1', property: 'opacity', atMs: 300, value: 0.2, easing: 'linear', managedBy: 'motion:appear' },
      { id: 'kf_2', property: 'y', atMs: 500, value: 104, easing: 'ease-out', managedBy: 'motion:fade-up' },
      { id: 'kf_3', property: 'x', atMs: 500, value: 64, easing: 'ease-out' },
    ];
    const fadeUp = applyAnimationPreset(widget, 'fade-up');
    const widgetWithPreset: WidgetNode = {
      ...widget,
      style: { ...widget.style, ...fadeUp.stylePatch },
      timeline: { ...widget.timeline, keyframes: fadeUp.keyframes },
    };

    const pulse = applyAnimationPreset(widgetWithPreset, 'pulse');

    expect(pulse.keyframes.some((keyframe) => keyframe.property === 'x')).toBe(true);
    expect(pulse.keyframes.some((keyframe) => keyframe.property === 'opacity' && keyframe.managedBy === 'motion:pulse')).toBe(true);
    expect(pulse.keyframes.some((keyframe) => keyframe.property === 'y' && !keyframe.managedBy)).toBe(false);
  });

  it('strips only motion-managed tracks when removing a template', () => {
    const widget = createWidget('text');
    widget.timeline.keyframes = [
      { id: 'kf_1', property: 'opacity', atMs: 300, value: 0.2, easing: 'linear', managedBy: 'motion:appear' },
      { id: 'kf_2', property: 'y', atMs: 500, value: 104, easing: 'ease-out', managedBy: 'motion:fade-up' },
      { id: 'kf_3', property: 'opacity', atMs: 500, value: 0.8, easing: 'ease-out' },
      { id: 'kf_4', property: 'x', atMs: 500, value: 64, easing: 'ease-out' },
    ];

    const keyframes = stripMotionManagedKeyframes(widget.timeline.keyframes);

    expect(keyframes).toHaveLength(2);
    expect(keyframes.some((keyframe) => keyframe.property === 'opacity' && !keyframe.managedBy)).toBe(true);
    expect(keyframes.some((keyframe) => keyframe.property === 'x')).toBe(true);
  });

  it('translates fade-out into exit keyframes', () => {
    const { keyframes, stylePatch } = applyAnimationPreset(createWidget('group'), 'fade-out');

    expect(stylePatch.animationPreset).toBe('fade-out');
    expect(keyframes).toHaveLength(2);
    expect(keyframes[0]?.atMs).toBeGreaterThanOrEqual(300);
    expect(keyframes[1]?.atMs).toBe(2000);
  });

  it('reads adjustable motion settings from widget style and persists template config', () => {
    const widget = createWidget('text');
    widget.style.animationDurationMs = 1200;
    widget.style.animationDelayMs = 180;
    widget.style.animationDistancePx = 36;
    widget.style.animationIntensity = 0.8;
    widget.style.animationRepeatMode = 'repeat';

    const config = getAnimationPresetConfig(widget);
    const { keyframes, stylePatch } = applyAnimationPreset(widget, 'fade-up');

    expect(config.durationMs).toBe(1200);
    expect(config.delayMs).toBe(180);
    expect(config.distancePx).toBe(36);
    expect(config.intensity).toBe(0.8);
    expect(config.repeatMode).toBe('repeat');
    expect(stylePatch.animationDurationMs).toBe(1200);
    expect(stylePatch.animationDelayMs).toBe(180);
    expect(stylePatch.animationDistancePx).toBe(36);
    expect(stylePatch.animationRepeatMode).toBe('repeat');
    expect(keyframes.some((keyframe) => keyframe.property === 'y')).toBe(true);
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
