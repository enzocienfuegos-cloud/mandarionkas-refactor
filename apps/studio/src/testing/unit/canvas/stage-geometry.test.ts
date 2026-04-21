import { describe, expect, it } from 'vitest';
import {
  clampCanvasPoint,
  clientPointToCanvasPoint,
  isCanvasPointWithinBounds,
} from '../../../canvas/stage/controllers/stage-geometry';
import { getPlacedFrameForPoint } from '../../../core/store/store-utils';

describe('stage geometry', () => {
  it('converts client points into canvas coordinates using zoom', () => {
    const stage = {
      getBoundingClientRect: () => ({ left: 120, top: 40, width: 600, height: 300 } as DOMRect),
    } as HTMLDivElement;

    expect(clientPointToCanvasPoint({ clientX: 220, clientY: 100 }, stage, 2)).toEqual({ x: 50, y: 30 });
  });

  it('clamps canvas points to the scene bounds', () => {
    expect(clampCanvasPoint({ x: -20, y: 840 }, { width: 300, height: 250 })).toEqual({ x: 0, y: 250 });
  });

  it('detects whether a point is inside the canvas bounds', () => {
    expect(isCanvasPointWithinBounds({ x: 0, y: 0 }, { width: 320, height: 480 })).toBe(true);
    expect(isCanvasPointWithinBounds({ x: 320, y: 480 }, { width: 320, height: 480 })).toBe(true);
    expect(isCanvasPointWithinBounds({ x: 321, y: 100 }, { width: 320, height: 480 })).toBe(false);
    expect(isCanvasPointWithinBounds({ x: 120, y: -1 }, { width: 320, height: 480 })).toBe(false);
  });

  it('places a dropped frame around the pointer and clamps it to canvas bounds', () => {
    const frame = getPlacedFrameForPoint({ x: 40, y: 20, width: 120, height: 60, rotation: 0 }, { x: 10, y: 12 }, { width: 300, height: 200 });
    expect(frame.x).toBe(0);
    expect(frame.y).toBe(0);

    const farFrame = getPlacedFrameForPoint({ x: 0, y: 0, width: 120, height: 60, rotation: 0 }, { x: 400, y: 400 }, { width: 300, height: 200 });
    expect(farFrame.x).toBe(180);
    expect(farFrame.y).toBe(140);
  });
});
