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
let pendingDomNotificationRaf: number | null = null;

function notifyDomSubscribers(): void {
  if (typeof requestAnimationFrame !== 'function') {
    domSubscribers.forEach((subscriber) => subscriber(currentPlayheadMs));
    return;
  }
  if (pendingDomNotificationRaf !== null) return;
  pendingDomNotificationRaf = requestAnimationFrame(() => {
    pendingDomNotificationRaf = null;
    const ms = currentPlayheadMs;
    domSubscribers.forEach((subscriber) => subscriber(ms));
  });
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
    if (pendingDomNotificationRaf !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(pendingDomNotificationRaf);
      pendingDomNotificationRaf = null;
    }
    domSubscribers.forEach((subscriber) => subscriber(currentPlayheadMs));
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

function usePlaybackMsSampled(fallbackMs: number, intervalMs: number): number {
  const [value, setValue] = useState(() => {
    const initial = playbackEngine.getCurrentMs();
    return Number.isFinite(initial) && initial > 0 ? initial : fallbackMs;
  });
  const fallbackRef = useRef(fallbackMs);
  const lastSyncedRef = useRef<number>(Number.NEGATIVE_INFINITY);

  useEffect(() => {
    fallbackRef.current = fallbackMs;
    const current = playbackEngine.getCurrentMs();
    if (!Number.isFinite(current) || current <= 0) {
      setValue(fallbackMs);
    }
  }, [fallbackMs]);

  useEffect(() => {
    const sample = Math.max(16, intervalMs);
    const sync = (nextMs: number) => {
      if (!Number.isFinite(nextMs)) {
        setValue(fallbackRef.current);
        return;
      }
      if (Math.abs(nextMs - lastSyncedRef.current) < sample) return;
      lastSyncedRef.current = nextMs;
      setValue(nextMs);
    };

    const initial = playbackEngine.getCurrentMs();
    lastSyncedRef.current = Number.isFinite(initial) ? initial : fallbackRef.current;
    setValue(lastSyncedRef.current);
    return playbackEngine.subscribeDom(sync);
  }, [intervalMs]);

  return Number.isFinite(value) ? value : fallbackMs;
}

export function usePlaybackMsVisual(fallbackMs: number): number {
  return usePlaybackMsSampled(fallbackMs, 16);
}

export function usePlaybackDerivedValue<T>(
  fallbackMs: number,
  derive: (playheadMs: number) => T,
  isEqual: (previous: T, next: T) => boolean = Object.is,
): T {
  const deriveRef = useRef(derive);
  const isEqualRef = useRef(isEqual);
  const [value, setValue] = useState(() => derive(fallbackMs));

  useEffect(() => {
    deriveRef.current = derive;
    isEqualRef.current = isEqual;
    setValue((current) => {
      const next = derive(fallbackMs);
      return isEqualRef.current(current, next) ? current : next;
    });
  }, [fallbackMs, derive, isEqual]);

  useEffect(() => {
    const sync = (nextMs: number) => {
      const next = deriveRef.current(Number.isFinite(nextMs) ? nextMs : fallbackMs);
      setValue((current) => (isEqualRef.current(current, next) ? current : next));
    };

    sync(playbackEngine.getCurrentMs());
    return playbackEngine.subscribeDom(sync);
  }, [fallbackMs]);

  return value;
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
