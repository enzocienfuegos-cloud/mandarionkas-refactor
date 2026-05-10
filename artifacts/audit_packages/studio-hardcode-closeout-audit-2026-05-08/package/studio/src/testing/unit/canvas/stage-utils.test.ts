import { describe, expect, it } from 'vitest';
import { clampFloatingPanelPosition } from '../../../canvas/stage/components/stage-utils';

describe('stage utils', () => {
  it('clamps floating panel positions inside the viewport', () => {
    expect(
      clampFloatingPanelPosition(
        { x: 900, y: 420 },
        { width: 800, height: 500 },
        { width: 240, height: 160 },
      ),
    ).toEqual({ x: 548, y: 328 });
  });

  it('keeps floating panels anchored to padding when the viewport is tighter than the panel', () => {
    expect(
      clampFloatingPanelPosition(
        { x: -40, y: -20 },
        { width: 180, height: 120 },
        { width: 240, height: 160 },
      ),
    ).toEqual({ x: 12, y: 12 });
  });
});
