import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { persistClientPreviewSnapshot } from '../../../features/client-preview/project-loader';

describe('client preview project loader', () => {
  it('normalizes legacy motion into formal motion fields before persisting preview snapshots', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;

    state.document.widgets.cta_1 = {
      id: 'cta_1',
      type: 'cta',
      name: 'CTA',
      sceneId,
      zIndex: 1,
      frame: { x: 24, y: 180, width: 160, height: 44, rotation: 0 },
      style: {
        animationPreset: 'appear',
        animationDurationMs: 720,
        animationDelayMs: 80,
        animationDistancePx: 18,
        animationIntensity: 0.5,
        animationRepeatMode: 'once',
        hoverMotionPreset: 'lift',
        hoverMotionDurationMs: 260,
        hoverMotionDistancePx: 10,
        hoverMotionScale: 1.05,
      },
      props: { text: 'Shop now', url: 'https://example.com' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('cta_1');

    const snapshot = persistClientPreviewSnapshot('project_123', state);
    const widget = snapshot.document.widgets.cta_1;

    expect(widget.motion).toEqual({
      templateId: 'appear',
      config: {
        durationMs: 720,
        delayMs: 80,
        distancePx: 18,
        intensity: 0.5,
        repeatMode: 'once',
      },
    });
    expect(widget.hoverMotion).toEqual({
      templateId: 'lift',
      config: {
        durationMs: 260,
        distancePx: 10,
        scale: 1.05,
      },
    });
  });
});
