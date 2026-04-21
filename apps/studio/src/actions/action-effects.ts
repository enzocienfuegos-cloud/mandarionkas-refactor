import type { ActionNode } from '../domain/document/types';
import type { IVideoPlayer } from '../widgets/video/IVideoPlayer';

export type VideoEffectContext = {
  player?: IVideoPlayer | null;
  showOverlay?: (overlayId: string) => void;
  hideOverlay?: (overlayId: string) => void;
  emitAnalyticsEvent?: (eventName: string, metadata?: Record<string, unknown>) => void;
};

export function fireBeacons(urls: string[]): void {
  urls.forEach((url) => {
    if (!url) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(url);
        return;
      }
    } catch {
      // Fallback to fetch below.
    }

    if (typeof fetch === 'function') {
      void fetch(url, { method: 'GET', mode: 'no-cors', credentials: 'omit', keepalive: true }).catch(() => undefined);
    }
  });
}

export function runActionEffects(action: ActionNode, context?: VideoEffectContext | null): void {
  switch (action.type) {
    case 'open-url':
      if (typeof window !== 'undefined' && action.url) {
        window.open(action.url, action.target ?? '_blank', 'noopener,noreferrer');
      }
      return;
    case 'play-video':
      void context?.player?.play?.().catch(() => undefined);
      return;
    case 'pause-video':
      context?.player?.pause?.();
      return;
    case 'seek-video':
      if (typeof action.toSeconds === 'number') {
        context?.player?.seek?.(action.toSeconds);
      }
      return;
    case 'mute-video':
      context?.player?.mute?.();
      return;
    case 'unmute-video':
      context?.player?.unmute?.();
      return;
    case 'show-overlay':
      if (action.overlayId) context?.showOverlay?.(action.overlayId);
      return;
    case 'hide-overlay':
      if (action.overlayId) context?.hideOverlay?.(action.overlayId);
      return;
    case 'fire-tracking-url':
      fireBeacons(action.urls ?? []);
      return;
    case 'emit-analytics-event':
      if (action.eventName) {
        context?.emitAnalyticsEvent?.(action.eventName, action.metadata);
      }
      return;
    default:
      return;
  }
}
