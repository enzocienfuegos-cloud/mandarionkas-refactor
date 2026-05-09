import { describe, expect, it } from 'vitest';
import { shallowEqual } from '../../../core/store/shallow';

describe('shallowEqual', () => {
  it('matches identical primitive records', () => {
    expect(shallowEqual({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(true);
  });

  it('detects different keys or values', () => {
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});
