import { useSyncExternalStore } from 'react';

type PlaybackSubscriber = () => void;

const subscribers = new Set<PlaybackSubscriber>();
let currentPlayheadMs = 0;
let syncIntervalMs = 250;

function notifySubscribers(): void {
  subscribers.forEach((subscriber) => subscriber());
}

export const playbackEngine = {
  subscribe(subscriber: PlaybackSubscriber) {
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  },
  getCurrentMs() {
    return currentPlayheadMs;
  },
  setCurrentMs(nextMs: number) {
    if (currentPlayheadMs === nextMs) return;
    currentPlayheadMs = nextMs;
    notifySubscribers();
  },
  getSyncIntervalMs() {
    return syncIntervalMs;
  },
  setSyncIntervalMsForTests(nextMs: number) {
    syncIntervalMs = Math.max(16, nextMs);
  },
};

export function usePlaybackMs(fallbackMs: number): number {
  const value = useSyncExternalStore(
    playbackEngine.subscribe,
    playbackEngine.getCurrentMs,
    () => fallbackMs,
  );
  return Number.isFinite(value) ? value : fallbackMs;
}
