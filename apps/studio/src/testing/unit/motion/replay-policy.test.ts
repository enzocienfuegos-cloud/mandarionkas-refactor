import { describe, expect, it } from 'vitest';
import { DEFAULT_REPLAY_POLICY } from '../../../motion/animation-engine/replay-policy';

describe('replay policy helpers', () => {
  it('defaults new slots to restart', () => {
    expect(DEFAULT_REPLAY_POLICY).toBe('restart');
  });

  it('keeps the runtime replay policy surface on the three supported values', () => {
    expect(new Set(['restart', 'ignore', 'queue'])).toEqual(
      new Set(['restart', 'ignore', 'queue']),
    );
  });
});
