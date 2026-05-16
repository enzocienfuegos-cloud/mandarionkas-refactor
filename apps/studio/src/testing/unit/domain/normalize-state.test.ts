import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { normalizeStudioState } from '../../../domain/document/normalize-state';
import { widgetSupportsHoverMotion, widgetSupportsMotion } from '../../../motion/motion-widget-compatibility';

describe('normalizeStudioState', () => {
  it('migrates legacy motion fields into formal widget motion state', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0]?.id ?? 'scene_1';

    state.document.widgets.hero = {
      id: 'hero',
      type: 'image',
      name: 'Hero',
      sceneId,
      zIndex: 1,
      frame: { x: 24, y: 32, width: 240, height: 140, rotation: 0 },
      props: { src: '' },
      style: {
        animationPreset: 'fade-up',
        animationDurationMs: 840,
        animationDelayMs: 120,
        animationDistancePx: 36,
        animationIntensity: 0.66,
        animationRepeatMode: 'repeat',
        hoverMotionPreset: 'zoom',
        hoverMotionDurationMs: 360,
        hoverMotionDistancePx: 18,
        hoverMotionScale: 1.08,
      },
      timeline: { startMs: 0, endMs: 15000 },
    };

    const normalized = normalizeStudioState(state);
    const widget = normalized.document.widgets.hero;

    expect(widget?.motion).toEqual({
      templateId: 'fade-up',
      config: {
        durationMs: 840,
        delayMs: 120,
        distancePx: 36,
        intensity: 0.66,
        repeatMode: 'repeat',
      },
    });
    expect(widget?.hoverMotion).toEqual({
      templateId: 'zoom',
      config: {
        durationMs: 360,
        distancePx: 18,
        scale: 1.08,
      },
    });
  });

  it('strips legacy motion-managed keyframes when motion is normalized', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0]?.id ?? 'scene_1';

    state.document.widgets.hero = {
      id: 'hero',
      type: 'image',
      name: 'Hero',
      sceneId,
      zIndex: 1,
      frame: { x: 24, y: 32, width: 240, height: 140, rotation: 0 },
      props: { src: '' },
      style: {
        animationPreset: 'fade-up',
      },
      timeline: {
        startMs: 0,
        endMs: 15000,
        keyframes: [
          { id: 'kf_opacity', property: 'opacity', atMs: 0, value: 0, easing: 'linear', managedBy: 'motion:appear' },
          { id: 'kf_y', property: 'y', atMs: 0, value: 48, easing: 'ease-out', managedBy: 'motion:fade-up' },
          { id: 'kf_x', property: 'x', atMs: 400, value: 42, easing: 'ease-out' },
        ],
      },
    };

    const normalized = normalizeStudioState(state);
    const keyframes = normalized.document.widgets.hero?.timeline.keyframes ?? [];

    expect(keyframes.length).toBeGreaterThan(1);
    expect(keyframes.some((keyframe) => keyframe.property === 'x' && !keyframe.managedBy)).toBe(true);
    expect(keyframes.some((keyframe) => keyframe.property === 'opacity' && keyframe.managedBy === 'motion:fade-up')).toBe(true);
    expect(keyframes.some((keyframe) => keyframe.property === 'y' && keyframe.managedBy === 'motion:fade-up')).toBe(true);
  });

  it('uses explicit widget capability flags for motion support', () => {
    expect(widgetSupportsMotion({ type: 'text' })).toBe(true);
    expect(widgetSupportsHoverMotion({ type: 'buttons' })).toBe(true);
    expect(widgetSupportsMotion({ type: 'scratch-reveal' })).toBe(false);
  });
});
