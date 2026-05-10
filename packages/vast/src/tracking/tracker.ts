import type { VASTAd, VASTLinear, VASTTrackingEvent } from '../types.js';

export type BeaconFn = (urls: string[]) => void;

export function defaultBeaconFn(urls: string[]): void {
  for (const url of urls) {
    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        if (navigator.sendBeacon(url)) continue;
      }
      if (typeof fetch !== 'undefined') {
        void fetch(url, { method: 'GET', keepalive: true, mode: 'no-cors' }).catch(() => undefined);
        continue;
      }
      new Image().src = url;
    } catch {
      // best effort only
    }
  }
}

const QUARTILE_THRESHOLDS = {
  start: 0,
  firstQuartile: 0.25,
  midpoint: 0.5,
  thirdQuartile: 0.75,
  complete: 1.0,
} as const;

type QuartileKey = keyof typeof QUARTILE_THRESHOLDS;

export class VASTTracker {
  private readonly ad: VASTAd;
  private readonly linear: VASTLinear;
  private readonly beaconFn: BeaconFn;
  private impressionFired = false;
  private readonly firedEvents = new Set<string>();
  private currentTimeSeconds = 0;

  constructor(ad: VASTAd, beaconFn: BeaconFn = defaultBeaconFn) {
    if (!ad.linear) {
      throw new Error('VASTTracker requires an ad with a linear creative');
    }
    this.ad = ad;
    this.linear = ad.linear;
    this.beaconFn = beaconFn;
  }

  onTimeUpdate(timeSeconds: number): void {
    this.currentTimeSeconds = timeSeconds;
    const duration = this.linear.duration;
    if (!duration) return;

    if (!this.impressionFired && timeSeconds >= 2) {
      this.impressionFired = true;
      this.fire('impression', this.ad.impressionUrls);
    }

    const fraction = Math.min(timeSeconds / duration, 1);
    for (const [key, threshold] of Object.entries(QUARTILE_THRESHOLDS) as [QuartileKey, number][]) {
      if (fraction >= threshold && !this.firedEvents.has(key)) {
        this.firedEvents.add(key);
        this.fireTrackingEvent(key);
      }
    }
  }

  onPlay(): void {
    this.fireTrackingEvent('resume');
  }

  onPause(): void {
    this.fireTrackingEvent('pause');
  }

  onMute(): void {
    this.fireTrackingEvent('mute');
  }

  onUnmute(): void {
    this.fireTrackingEvent('unmute');
  }

  onFullscreen(): void {
    this.fireTrackingEvent('fullscreen');
  }

  onExitFullscreen(): void {
    this.fireTrackingEvent('exitFullscreen');
  }

  onClickThrough(): void {
    this.fireTrackingEvent('click');
    if (this.linear.clickTrackingUrls.length > 0) {
      this.beaconFn(this.linear.clickTrackingUrls);
    }
    if (this.linear.clickThrough && typeof window !== 'undefined') {
      window.open(this.linear.clickThrough, '_blank', 'noopener,noreferrer');
    }
  }

  onSkip(): void {
    if (!this.firedEvents.has('skip')) {
      this.firedEvents.add('skip');
      this.fireTrackingEvent('skip');
    }
  }

  onError(errorCode: number): void {
    const errorUrls = this.ad.errorUrls.map((url) => url.replace('[ERRORCODE]', String(errorCode)));
    if (errorUrls.length > 0) {
      this.beaconFn(errorUrls);
    }
  }

  isSkippable(): boolean {
    return this.linear.skipOffset !== undefined;
  }

  isSkipAllowed(): boolean {
    const offset = this.linear.skipOffset;
    if (offset === undefined) return false;
    if (typeof offset === 'number') return this.currentTimeSeconds >= offset;
    if (typeof offset === 'string' && offset.endsWith('%')) {
      const pct = parseFloat(offset) / 100;
      return this.currentTimeSeconds >= pct * this.linear.duration;
    }
    return false;
  }

  skipCountdownSeconds(): number {
    const offset = this.linear.skipOffset;
    if (offset === undefined) return 0;
    if (typeof offset === 'number') return Math.max(0, offset - this.currentTimeSeconds);
    if (typeof offset === 'string' && offset.endsWith('%')) {
      const pct = parseFloat(offset) / 100;
      const targetSeconds = pct * this.linear.duration;
      return Math.max(0, targetSeconds - this.currentTimeSeconds);
    }
    return 0;
  }

  private fireTrackingEvent(event: VASTTrackingEvent): void {
    const urls = this.linear.trackingEvents[event];
    if (urls && urls.length > 0) {
      this.fire(event, urls);
    }
  }

  private fire(_label: string, urls: string[]): void {
    if (urls.length === 0) return;
    const substituted = urls.map((url) => url.replace('[CONTENTPLAYHEAD]', formatTimecode(this.currentTimeSeconds)));
    this.beaconFn(substituted);
  }
}

function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${pad(h)}:${pad(m)}:${s.toFixed(3).padStart(6, '0')}`;
}

function pad(n: number): string {
  return String(Math.floor(n)).padStart(2, '0');
}
