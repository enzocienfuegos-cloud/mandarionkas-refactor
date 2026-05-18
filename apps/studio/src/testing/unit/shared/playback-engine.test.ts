import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playbackEngine } from '../../../hooks/use-playback-engine';

describe('playbackEngine', () => {
  let rafCallbacks: FrameRequestCallback[] = [];

  beforeEach(() => {
    rafCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => {
      const index = id - 1;
      if (index >= 0 && index < rafCallbacks.length) {
        rafCallbacks[index] = (() => undefined) as FrameRequestCallback;
      }
    }));
    playbackEngine.setSyncIntervalMsForTests(250);
    playbackEngine.setCurrentMs(0);
    playbackEngine.flushReact();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fires DOM subscribers every tick and throttles React subscribers', () => {
    let domCallCount = 0;
    let reactCallCount = 0;

    const unsubscribeDom = playbackEngine.subscribeDom(() => {
      domCallCount += 1;
    });
    const unsubscribeReact = playbackEngine.subscribeReact(() => {
      reactCallCount += 1;
    });

    for (let index = 0; index < 10; index += 1) {
      playbackEngine.setCurrentMs(index * 16);
    }

    expect(domCallCount).toBe(1);
    expect(reactCallCount).toBe(0);

    const pending = [...rafCallbacks];
    rafCallbacks = [];
    pending.forEach((callback) => callback(performance.now()));
    expect(domCallCount).toBe(2);

    playbackEngine.setCurrentMs(300);
    expect(reactCallCount).toBe(1);

    unsubscribeDom();
    unsubscribeReact();
  });
});
