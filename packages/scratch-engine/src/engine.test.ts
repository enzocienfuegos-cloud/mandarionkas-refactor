// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachScratch } from './engine';
import { dispatchPointer, installResizeObserverMock, installScratchCanvasMock, mountScratchRoot } from './test-helpers';

describe('attachScratch', () => {
  let restoreCanvasMock: (() => void) | null = null;
  let restoreResizeObserverMock: (() => void) | null = null;

  beforeEach(() => {
    document.body.innerHTML = '';
    restoreCanvasMock = installScratchCanvasMock();
    restoreResizeObserverMock = installResizeObserverMock();
  });

  afterEach(() => {
    restoreCanvasMock?.();
    restoreResizeObserverMock?.();
    restoreCanvasMock = null;
    restoreResizeObserverMock = null;
    document.body.innerHTML = '';
  });

  it('creates cover canvas and hit area, fires milestone and reveal, and keeps bubbling enabled', () => {
    const { root } = mountScratchRoot({ 'data-scratch-auto-reveal-threshold': '50' });
    const onMilestone = vi.fn();
    const onReveal = vi.fn();
    const parentPointerDown = vi.fn();
    root.addEventListener('pointerdown', parentPointerDown as EventListener);

    const handle = attachScratch({
      root,
      threshold: 0.5,
      brushSize: 24,
      fadeOutMs: 0,
      milestones: [{ id: 'm25', at: 0.25 }],
      onMilestone,
      onReveal,
    });

    const canvas = root.querySelector<HTMLCanvasElement>('[data-scratch-canvas]');
    const hitArea = root.querySelector<HTMLElement>('[data-scratch-hit-area]');
    expect(canvas).toBeTruthy();
    expect(hitArea).toBeTruthy();

    dispatchPointer(hitArea!, 'pointerdown', 10, 10);
    dispatchPointer(hitArea!, 'pointermove', 40, 10);

    expect(parentPointerDown).toHaveBeenCalledTimes(1);
    expect(onMilestone).toHaveBeenCalledWith('m25', expect.any(Number));
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(root.classList.contains('is-scratch-complete')).toBe(true);
    expect(hitArea?.dataset.scratchCompleted).toBe('true');
    expect(canvas?.style.display).toBe('none');

    handle.destroy();
  });

  it('supports reset and destroy for created nodes', () => {
    const { root } = mountScratchRoot();
    const handle = attachScratch({
      root,
      threshold: 0.5,
      brushSize: 24,
      fadeOutMs: 0,
    });

    const hitArea = root.querySelector<HTMLElement>('[data-scratch-hit-area]');
    dispatchPointer(hitArea!, 'pointerdown', 10, 10);
    dispatchPointer(hitArea!, 'pointermove', 40, 10);

    expect(root.classList.contains('is-scratch-complete')).toBe(true);

    handle.reset();

    const canvas = root.querySelector<HTMLCanvasElement>('[data-scratch-canvas]');
    const nextHitArea = root.querySelector<HTMLElement>('[data-scratch-hit-area]');
    expect(root.classList.contains('is-scratch-complete')).toBe(false);
    expect(canvas?.style.display).toBe('');
    expect(canvas?.style.opacity).toBe('1');
    expect(nextHitArea?.dataset.scratchCompleted).toBe('false');

    handle.destroy();
    expect(root.querySelector('[data-scratch-canvas]')).toBeNull();
    expect(root.querySelector('[data-scratch-hit-area]')).toBeNull();
  });
});
