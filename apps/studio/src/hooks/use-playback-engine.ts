import { useEffect, useState } from 'react';

type DomSubscriber = (ms: number) => void;
type ReactSubscriber = () => void;

declare global {
  interface Window {
    __studioPlaybackAudit?: {
      reactSyncCount: number;
    };
  }
}

const domSubscribers = new Set<DomSubscriber>();
const reactSubscribers = new Set<ReactSubscriber>();
let currentPlayheadMs = 0;
let syncIntervalMs = 250;
let lastReactSyncMs = 0;

function notifyDomSubscribers(): void {
  domSubscribers.forEach((subscriber) => subscriber(currentPlayheadMs));
}

function notifyReactSubscribers(): void {
  if (typeof window !== 'undefined' && window.__studioPlaybackAudit) {
    window.__studioPlaybackAudit.reactSyncCount += 1;
  }
  reactSubscribers.forEach((subscriber) => subscriber());
}

function notifyReactIfThrottleAllows(): void {
  if (Math.abs(currentPlayheadMs - lastReactSyncMs) < syncIntervalMs) return;
  lastReactSyncMs = currentPlayheadMs;
  notifyReactSubscribers();
}

export const playbackEngine = {
  subscribeDom(subscriber: DomSubscriber) {
    domSubscribers.add(subscriber);
    subscriber(currentPlayheadMs);
    return () => {
      domSubscribers.delete(subscriber);
    };
  },
  subscribeReact(subscriber: ReactSubscriber) {
    reactSubscribers.add(subscriber);
    return () => {
      reactSubscribers.delete(subscriber);
    };
  },
  getCurrentMs() {
    return currentPlayheadMs;
  },
  setCurrentMs(nextMs: number) {
    if (currentPlayheadMs === nextMs) return;
    currentPlayheadMs = nextMs;
    notifyDomSubscribers();
    notifyReactIfThrottleAllows();
  },
  flushReact() {
    lastReactSyncMs = currentPlayheadMs;
    notifyReactSubscribers();
  },
  getSyncIntervalMs() {
    return syncIntervalMs;
  },
  setSyncIntervalMsForTests(nextMs: number) {
    syncIntervalMs = Math.max(16, nextMs);
  },
};

export function usePlaybackMsThrottled(fallbackMs: number): number {
  const [value, setValue] = useState(() => {
    const initial = playbackEngine.getCurrentMs();
    return Number.isFinite(initial) && initial > 0 ? initial : fallbackMs;
  });

  useEffect(() => {
    const sync = () => {
      const next = playbackEngine.getCurrentMs();
      setValue(Number.isFinite(next) ? next : fallbackMs);
    };

    sync();
    return playbackEngine.subscribeReact(sync);
  }, [fallbackMs]);

  return Number.isFinite(value) ? value : fallbackMs;
}
