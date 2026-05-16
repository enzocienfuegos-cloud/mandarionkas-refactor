import { describe, expect, it } from 'vitest';
import { resolveMotionCurrentTime } from '../../../motion/motion-engine';

describe('resolveMotionCurrentTime', () => {
  it('returns 0 before the delay for entrance category', () => {
    const result = resolveMotionCurrentTime({
      playheadMs: 100,
      timeline: { startMs: 0, endMs: 5000, keyframes: [] },
      config: { durationMs: 700, delayMs: 300 },
      category: 'entrance',
    });
    expect(result).toBe(0);
  });

  it('returns playhead minus delay for entrance after the delay', () => {
    const result = resolveMotionCurrentTime({
      playheadMs: 500,
      timeline: { startMs: 0, endMs: 5000, keyframes: [] },
      config: { durationMs: 700, delayMs: 300 },
      category: 'entrance',
    });
    expect(result).toBe(200);
  });

  it('clamps entrance at duration', () => {
    const result = resolveMotionCurrentTime({
      playheadMs: 5000,
      timeline: { startMs: 0, endMs: 10000, keyframes: [] },
      config: { durationMs: 700, delayMs: 0 },
      category: 'entrance',
    });
    expect(result).toBe(700);
  });

  it('returns raw post-delay time for loop without manual modulo', () => {
    const result = resolveMotionCurrentTime({
      playheadMs: 47230,
      timeline: { startMs: 0, endMs: 60000, keyframes: [] },
      config: { durationMs: 3000, delayMs: 0 },
      category: 'loop',
    });
    expect(result).toBe(47230);
  });

  it('returns 0 for loop during delay period', () => {
    const result = resolveMotionCurrentTime({
      playheadMs: 100,
      timeline: { startMs: 0, endMs: 5000, keyframes: [] },
      config: { durationMs: 3000, delayMs: 200 },
      category: 'loop',
    });
    expect(result).toBe(0);
  });

  it('returns playhead minus anchor for exit category', () => {
    const result = resolveMotionCurrentTime({
      playheadMs: 4500,
      timeline: { startMs: 0, endMs: 5000, keyframes: [] },
      config: { durationMs: 700, delayMs: 0 },
      category: 'exit',
    });
    expect(result).toBe(200);
  });
});
