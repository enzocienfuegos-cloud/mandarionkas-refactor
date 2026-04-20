import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VASTTracker } from '../tracking/tracker.js';
import type { VASTAd } from '../types.js';

function makeMockAd(overrides: Partial<VASTAd> = {}): VASTAd {
  return {
    impressionUrls: ['https://tracker.example.com/impression'],
    errorUrls: ['https://tracker.example.com/error?code=[ERRORCODE]'],
    companions: [],
    extensions: [],
    linear: {
      duration: 30,
      skipOffset: 5,
      mediaFiles: [],
      interactiveCreativeFiles: [],
      clickThrough: 'https://example.com/landing',
      clickTrackingUrls: ['https://tracker.example.com/click'],
      customClickUrls: [],
      icons: [],
      trackingEvents: {
        start: ['https://tracker.example.com/start'],
        firstQuartile: ['https://tracker.example.com/q1'],
        midpoint: ['https://tracker.example.com/q2'],
        thirdQuartile: ['https://tracker.example.com/q3'],
        complete: ['https://tracker.example.com/complete'],
        pause: ['https://tracker.example.com/pause'],
        mute: ['https://tracker.example.com/mute'],
        skip: ['https://tracker.example.com/skip'],
      },
    },
    ...overrides,
  };
}

describe('VASTTracker', () => {
  let beaconFn: ReturnType<typeof vi.fn>;
  let tracker: VASTTracker;

  beforeEach(() => {
    beaconFn = vi.fn();
    tracker = new VASTTracker(makeMockAd(), beaconFn);
  });

  it('fires impression at 2 seconds', () => {
    tracker.onTimeUpdate(2);
    expect(beaconFn).toHaveBeenCalledWith(['https://tracker.example.com/impression']);
  });

  it('fires quartiles and skip logic', () => {
    tracker.onTimeUpdate(7.5);
    tracker.onTimeUpdate(15);
    tracker.onTimeUpdate(22.5);
    tracker.onTimeUpdate(30);
    tracker.onTimeUpdate(5);
    expect(tracker.isSkipAllowed()).toBe(true);
    tracker.onSkip();
    expect(beaconFn).toHaveBeenCalledWith(['https://tracker.example.com/skip']);
  });

  it('substitutes error codes', () => {
    tracker.onError(403);
    expect(beaconFn).toHaveBeenCalledWith(['https://tracker.example.com/error?code=403']);
  });
});
