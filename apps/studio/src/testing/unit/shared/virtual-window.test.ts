import { describe, expect, it } from 'vitest';
import { calculateVirtualWindow } from '../../../shared/hooks/use-virtual-window';

describe('calculateVirtualWindow', () => {
  it('returns a stable overscanned slice for a vertical list', () => {
    expect(
      calculateVirtualWindow(100, {
        viewportSize: 120,
        scrollOffset: 80,
        estimateSize: 40,
        overscan: 1,
      }),
    ).toEqual({
      rowCount: 100,
      startRow: 1,
      endRow: 6,
      totalSize: 4000,
      paddingStart: 40,
      paddingEnd: 3760,
    });
  });

  it('accounts for lanes when virtualizing a grid', () => {
    expect(
      calculateVirtualWindow(5, {
        viewportSize: 80,
        scrollOffset: 70,
        estimateSize: 70,
        overscan: 0,
        lanes: 2,
        gap: 10,
      }),
    ).toEqual({
      rowCount: 3,
      startRow: 0,
      endRow: 1,
      totalSize: 230,
      paddingStart: 0,
      paddingEnd: 160,
    });
  });
});
