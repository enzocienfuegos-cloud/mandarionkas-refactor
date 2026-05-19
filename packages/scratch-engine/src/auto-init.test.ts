// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initScratchReveal } from './auto-init';
import { installResizeObserverMock, installScratchCanvasMock, mountScratchRoot } from './test-helpers';

describe('initScratchReveal', () => {
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

  it('initializes every unbound scratch root once and marks them as initialized', () => {
    document.body.innerHTML = `
      <div data-scratch data-scratch-radius="18" data-scratch-auto-reveal-threshold="25" style="position:relative;width:200px;height:100px;">
        <div data-scratch-reveal></div>
        <div data-scratch-cover></div>
      </div>
      <div data-scratch data-scratch-radius="30" data-scratch-auto-reveal-threshold="75" style="position:relative;width:200px;height:100px;">
        <div data-scratch-reveal></div>
        <div data-scratch-cover></div>
      </div>
    `;
    [...document.querySelectorAll<HTMLElement>('[data-scratch]')].forEach((root) => {
      Object.defineProperty(root, 'clientWidth', { configurable: true, value: 200 });
      Object.defineProperty(root, 'clientHeight', { configurable: true, value: 100 });
      root.getBoundingClientRect = () => ({
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        top: 0,
        left: 0,
        right: 200,
        bottom: 100,
        toJSON: () => ({}),
      } as DOMRect);
    });

    const handles = initScratchReveal();
    const roots = [...document.querySelectorAll<HTMLElement>('[data-scratch]')];

    expect(handles).toHaveLength(2);
    roots.forEach((root) => {
      expect(root.getAttribute('data-scratch-initialized')).toBe('true');
      expect(root.querySelector('[data-scratch-canvas]')).toBeTruthy();
      expect(root.querySelector('[data-scratch-hit-area]')).toBeTruthy();
    });

    const nextHandles = initScratchReveal();
    expect(nextHandles).toHaveLength(0);

    handles.forEach((handle) => handle.destroy());
  });
});
