import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionNode } from '../../../domain/document/types';
import type { VideoEffectContext } from '../../../actions/action-effects';
import { fireBeacons, runActionEffects } from '../../../actions/action-effects';

function makeMockContext(): VideoEffectContext {
  return {
    player: {
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      seek: vi.fn(),
      mute: vi.fn(),
      unmute: vi.fn(),
      loadSource: vi.fn(),
      getCurrentTime: vi.fn().mockReturnValue(0),
      getDuration: vi.fn().mockReturnValue(0),
      setVolume: vi.fn(),
      getVolume: vi.fn().mockReturnValue(1),
      isMuted: vi.fn().mockReturnValue(false),
      isPlaying: vi.fn().mockReturnValue(false),
      on: vi.fn(),
      off: vi.fn(),
      dispose: vi.fn(),
    },
    showOverlay: vi.fn(),
    hideOverlay: vi.fn(),
    emitAnalyticsEvent: vi.fn(),
  };
}

function action(overrides: Partial<ActionNode> & Pick<ActionNode, 'type'>): ActionNode {
  return {
    id: 'action-1',
    widgetId: 'widget-1',
    trigger: 'click',
    ...overrides,
  };
}

describe('runActionEffects', () => {
  let ctx: VideoEffectContext;

  beforeEach(() => {
    ctx = makeMockContext();
  });

  it('opens a URL for open-url', () => {
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: vi.fn().mockImplementation(() => null),
    });
    const openSpy = vi.mocked(window.open);
    runActionEffects(action({ type: 'open-url', url: 'https://example.com', target: '_self' }), null);
    expect(openSpy).toHaveBeenCalledWith('https://example.com', '_self', 'noopener,noreferrer');
  });

  it('controls the player for video effects', () => {
    runActionEffects(action({ type: 'play-video' }), ctx);
    runActionEffects(action({ type: 'pause-video' }), ctx);
    runActionEffects(action({ type: 'seek-video', toSeconds: 12.5 }), ctx);
    runActionEffects(action({ type: 'mute-video' }), ctx);
    runActionEffects(action({ type: 'unmute-video' }), ctx);

    expect(ctx.player?.play).toHaveBeenCalledOnce();
    expect(ctx.player?.pause).toHaveBeenCalledOnce();
    expect(ctx.player?.seek).toHaveBeenCalledWith(12.5);
    expect(ctx.player?.mute).toHaveBeenCalledOnce();
    expect(ctx.player?.unmute).toHaveBeenCalledOnce();
  });

  it('routes overlay and analytics helpers', () => {
    runActionEffects(action({ type: 'show-overlay', overlayId: 'ov-1' }), ctx);
    runActionEffects(action({ type: 'hide-overlay', overlayId: 'ov-1' }), ctx);
    runActionEffects(action({ type: 'emit-analytics-event', eventName: 'video_cta', metadata: { step: 1 } }), ctx);

    expect(ctx.showOverlay).toHaveBeenCalledWith('ov-1');
    expect(ctx.hideOverlay).toHaveBeenCalledWith('ov-1');
    expect(ctx.emitAnalyticsEvent).toHaveBeenCalledWith('video_cta', { step: 1 });
  });

  it('does not throw when no context is provided for video actions', () => {
    expect(() => runActionEffects(action({ type: 'play-video' }), null)).not.toThrow();
  });
});

describe('fireBeacons', () => {
  it('prefers navigator.sendBeacon when available', () => {
    if (typeof globalThis.navigator === 'undefined') {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: {},
      });
    }
    const sendBeaconSpy = vi.fn().mockReturnValue(true);
    Object.defineProperty(globalThis.navigator, 'sendBeacon', {
      configurable: true,
      value: sendBeaconSpy,
    });
    fireBeacons(['https://tracker1.example.com', 'https://tracker2.example.com']);
    expect(sendBeaconSpy).toHaveBeenCalledTimes(2);
  });
});
