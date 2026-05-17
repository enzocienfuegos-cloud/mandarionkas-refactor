import { describe, expect, it } from 'vitest';
import { SCENE_CLOCK, clockLocalElapsedMs, createEventClock } from '../../../motion/animation-engine/clock';

describe('animation engine clock helpers', () => {
  it('exposes the shared scene clock as absolute scene time', () => {
    expect(SCENE_CLOCK).toEqual({
      kind: 'scene',
      trigger: 'timeline',
      startMode: 'absolute-scene-time',
      startedAtMs: 0,
    });
  });

  it('creates event clocks from local trigger zero', () => {
    expect(createEventClock('reveal', 8400)).toEqual({
      kind: 'event',
      trigger: 'reveal',
      startMode: 'trigger-local-zero',
      startedAtMs: 8400,
    });
    expect(createEventClock('scene-exit', 9200, 'exit')).toEqual({
      kind: 'exit',
      trigger: 'scene-exit',
      startMode: 'trigger-local-zero',
      startedAtMs: 9200,
    });
  });

  it('computes local elapsed time without going negative', () => {
    const revealClock = createEventClock('reveal', 5000);

    expect(clockLocalElapsedMs(revealClock, 4800)).toBe(0);
    expect(clockLocalElapsedMs(revealClock, 5000)).toBe(0);
    expect(clockLocalElapsedMs(revealClock, 5375)).toBe(375);
  });
});
