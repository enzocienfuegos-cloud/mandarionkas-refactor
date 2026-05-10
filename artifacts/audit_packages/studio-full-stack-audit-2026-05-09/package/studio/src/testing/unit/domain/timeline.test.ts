import { describe, expect, it } from 'vitest';
import {
  buildTimelineSnapTargets,
  getLiveWidgetFrame,
  getLiveWidgetOpacity,
  getTimelineGridStepMs,
  isWidgetVisibleAt,
  snapTimelineMs,
} from '../../../domain/document/timeline';

const widget = {
  id: 'widget_1',
  type: 'shape',
  name: 'Shape',
  sceneId: 'scene_1',
  zIndex: 1,
  frame: { x: 0, y: 0, width: 100, height: 50, rotation: 0 },
  style: { opacity: 1 },
  props: {},
  timeline: {
    startMs: 100,
    endMs: 900,
    keyframes: [
      { id: 'k1', property: 'x', atMs: 0, value: 0, easing: 'linear' },
      { id: 'k2', property: 'x', atMs: 1000, value: 100, easing: 'ease-in-out' },
      { id: 'k3', property: 'opacity', atMs: 0, value: 1, easing: 'linear' },
      { id: 'k4', property: 'opacity', atMs: 1000, value: 0.5, easing: 'linear' },
    ],
  },
} as any;

const peerWidget = {
  ...widget,
  id: 'widget_2',
  name: 'Peer',
  timeline: {
    startMs: 1200,
    endMs: 2200,
    keyframes: [{ id: 'k5', property: 'x', atMs: 1500, value: 10, easing: 'linear' }],
  },
} as any;

describe('timeline helpers', () => {
  it('interpolates live widget frame', () => {
    const frame = getLiveWidgetFrame(widget, 500);
    expect(frame.x).toBeGreaterThan(0);
    expect(frame.x).toBeLessThan(100);
  });

  it('interpolates opacity track', () => {
    const opacity = getLiveWidgetOpacity(widget, 500);
    expect(opacity).toBeLessThan(1);
    expect(opacity).toBeGreaterThan(0.5);
  });

  it('respects widget visibility timing', () => {
    expect(isWidgetVisibleAt(widget, 50)).toBe(false);
    expect(isWidgetVisibleAt(widget, 500)).toBe(true);
    expect(isWidgetVisibleAt(widget, 1000)).toBe(false);
  });

  it('derives grid step from zoom', () => {
    expect(getTimelineGridStepMs(0.5)).toBe(1000);
    expect(getTimelineGridStepMs(1)).toBe(500);
    expect(getTimelineGridStepMs(2)).toBe(250);
    expect(getTimelineGridStepMs(3)).toBe(100);
  });

  it('builds snap targets from widgets and playhead', () => {
    const targets = buildTimelineSnapTargets([widget, peerWidget], { excludeWidgetId: widget.id, playheadMs: 700 });
    expect(targets.some((target) => target.kind === 'playhead' && target.ms === 700)).toBe(true);
    expect(targets.some((target) => target.kind === 'start' && target.widgetId === peerWidget.id)).toBe(true);
    expect(targets.some((target) => target.kind === 'keyframe' && target.keyframeId === 'k5')).toBe(true);
    expect(targets.some((target) => target.widgetId === widget.id)).toBe(false);
  });

  it('prefers explicit targets over grid when both are in range', () => {
    const snap = snapTimelineMs(742, {
      minMs: 0,
      maxMs: 2000,
      stepMs: 500,
      thresholdMs: 80,
      targets: [{ ms: 750, kind: 'playhead', label: 'Playhead' }],
    });
    expect(snap.valueMs).toBe(750);
    expect(snap.target?.kind).toBe('playhead');
  });

  it('returns unclamped value when outside snap threshold', () => {
    const snap = snapTimelineMs(835, {
      minMs: 0,
      maxMs: 2000,
      stepMs: 500,
      thresholdMs: 50,
      targets: [{ ms: 900, kind: 'playhead', label: 'Playhead' }],
    });
    expect(snap.valueMs).toBe(835);
    expect(snap.snapped).toBe(false);
  });
});
