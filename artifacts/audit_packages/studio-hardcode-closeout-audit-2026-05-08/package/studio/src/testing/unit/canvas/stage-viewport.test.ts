import { describe, expect, it } from 'vitest';
import {
  applyEdgeAutoScroll,
  clampZoom,
  getEdgeAutoScrollDelta,
  getCursorAnchoredScrollDelta,
  getNextZoomFromWheel,
  normalizeWheelDelta,
} from '../../../canvas/stage/controllers/stage-viewport';

describe('stage viewport helpers', () => {
  it('normalizes wheel delta across delta modes', () => {
    expect(normalizeWheelDelta(10, 0)).toBe(10);
    expect(normalizeWheelDelta(2, 1)).toBe(32);
    expect(normalizeWheelDelta(1, 2)).toBe(120);
  });

  it('clamps zoom to allowed range', () => {
    expect(clampZoom(0.01)).toBe(0.25);
    expect(clampZoom(1.25)).toBe(1.25);
    expect(clampZoom(8)).toBe(4);
  });

  it('derives next zoom from wheel direction', () => {
    expect(getNextZoomFromWheel(1, -120)).toBeGreaterThan(1);
    expect(getNextZoomFromWheel(1, 120)).toBeLessThan(1);
  });


  it('computes edge autoscroll deltas near the workspace bounds', () => {
    expect(getEdgeAutoScrollDelta({
      clientPoint: { clientX: 104, clientY: 112 },
      bounds: { left: 100, top: 100, width: 400, height: 300 },
    })).toEqual({ x: -26, y: -22 });

    expect(getEdgeAutoScrollDelta({
      clientPoint: { clientX: 498, clientY: 396 },
      bounds: { left: 100, top: 100, width: 400, height: 300 },
    })).toEqual({ x: 27, y: 26 });
  });

  it('applies edge autoscroll directly to a workspace node', () => {
    const workspace = {
      scrollLeft: 20,
      scrollTop: 30,
      getBoundingClientRect: () => ({ left: 100, top: 100, width: 400, height: 300 } as DOMRect),
    } as HTMLDivElement;

    const delta = applyEdgeAutoScroll({
      workspace,
      clientPoint: { clientX: 498, clientY: 396 },
    });

    expect(delta).toEqual({ x: 27, y: 26 });
    expect(workspace.scrollLeft).toBe(47);
    expect(workspace.scrollTop).toBe(56);
  });

  it('computes scroll compensation to keep cursor anchored', () => {
    const delta = getCursorAnchoredScrollDelta({
      clientPoint: { clientX: 250, clientY: 210 },
      beforeRect: { left: 100, top: 50 },
      afterRect: { left: 90, top: 40 },
      beforeZoom: 1,
      afterZoom: 1.2,
    });

    expect(delta.x).toBeCloseTo(20);
    expect(delta.y).toBeCloseTo(22);
  });
});
