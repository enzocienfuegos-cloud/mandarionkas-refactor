import { useEffect, useRef, useState } from 'react';

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
  const fallbackRef = useRef(fallbackMs);

  useEffect(() => {
    fallbackRef.current = fallbackMs;
    const current = playbackEngine.getCurrentMs();
    if (!Number.isFinite(current) || current <= 0) {
      setValue(fallbackMs);
    }
  }, [fallbackMs]);

  useEffect(() => {
    const sync = () => {
      const next = playbackEngine.getCurrentMs();
      setValue(Number.isFinite(next) ? next : fallbackRef.current);
    };

    sync();
    return playbackEngine.subscribeReact(sync);
  }, []);

  return Number.isFinite(value) ? value : fallbackMs;
}

export function usePlaybackMsLive(fallbackMs: number): number {
  const [value, setValue] = useState(() => {
    const initial = playbackEngine.getCurrentMs();
    return Number.isFinite(initial) ? initial : fallbackMs;
  });
  const fallbackRef = useRef(fallbackMs);

  useEffect(() => {
    fallbackRef.current = fallbackMs;
    const current = playbackEngine.getCurrentMs();
    if (!Number.isFinite(current)) {
      setValue(fallbackMs);
    }
  }, [fallbackMs]);

  useEffect(() => {
    const sync = (nextMs: number) => {
      setValue(Number.isFinite(nextMs) ? nextMs : fallbackRef.current);
    };

    sync(playbackEngine.getCurrentMs());
    return playbackEngine.subscribeDom(sync);
  }, []);

  return Number.isFinite(value) ? value : fallbackMs;
}
