import { beforeEach, describe, expect, it } from 'vitest';
import { playbackEngine } from '../../../hooks/use-playback-engine';

describe('playbackEngine', () => {
  beforeEach(() => {
    playbackEngine.setSyncIntervalMsForTests(250);
    playbackEngine.setCurrentMs(0);
    playbackEngine.flushReact();
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

    expect(domCallCount).toBe(10);
    expect(reactCallCount).toBe(0);

    playbackEngine.setCurrentMs(300);
    expect(reactCallCount).toBe(1);

    unsubscribeDom();
    unsubscribeReact();
  });
});
