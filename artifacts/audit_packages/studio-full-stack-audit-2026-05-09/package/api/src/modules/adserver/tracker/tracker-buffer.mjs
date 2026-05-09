import { writeTrackerEventsToStaging } from '@smx/db/src/tracking.mjs';
import { logError, logInfo } from '../../../lib/logger.mjs';

const DEFAULT_FLUSH_INTERVAL_MS = 5_000;
const DEFAULT_FLUSH_THRESHOLD = 1_000;

export class TrackerBuffer {
  #pool;
  #flushIntervalMs;
  #flushThreshold;
  #timer = null;
  #flushing = false;
  #pendingCount = 0;
  #impressions = new Map();
  #clicks = new Map();
  #engagements = new Map();

  constructor(pool, { flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS, flushThreshold = DEFAULT_FLUSH_THRESHOLD } = {}) {
    if (!pool) throw new Error('TrackerBuffer requires a pg.Pool instance.');
    this.#pool = pool;
    this.#flushIntervalMs = flushIntervalMs;
    this.#flushThreshold = flushThreshold;
  }

  start() {
    if (this.#timer) return;
    this.#timer = setInterval(() => {
      this.#flush().catch(() => undefined);
    }, this.#flushIntervalMs);
    if (this.#timer.unref) this.#timer.unref();
    logInfo({
      service: 'smx-tracker-buffer',
      event: 'started',
      flushIntervalMs: this.#flushIntervalMs,
      flushThreshold: this.#flushThreshold,
    });
  }

  async stop() {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
    await this.#flush();
    logInfo({ service: 'smx-tracker-buffer', event: 'stopped' });
  }

  addImpression(tagId) {
    if (!tagId) return;
    this.#impressions.set(tagId, (this.#impressions.get(tagId) ?? 0) + 1);
    this.#pendingCount += 1;
    this.#maybeFlushAsync();
  }

  addClick(tagId) {
    if (!tagId) return;
    this.#clicks.set(tagId, (this.#clicks.get(tagId) ?? 0) + 1);
    this.#pendingCount += 1;
    this.#maybeFlushAsync();
  }

  addEngagement(tagId, eventType, durationMs = 0) {
    if (!tagId || !eventType) return;
    const key = `${tagId}:${eventType}`;
    const existing = this.#engagements.get(key);
    if (existing) {
      existing.count += 1;
      existing.durationMs += Math.max(0, Number(durationMs) || 0);
    } else {
      this.#engagements.set(key, {
        tagId,
        eventType,
        count: 1,
        durationMs: Math.max(0, Number(durationMs) || 0),
      });
    }
    this.#pendingCount += 1;
    this.#maybeFlushAsync();
  }

  get pendingCount() {
    return this.#pendingCount;
  }

  #maybeFlushAsync() {
    if (this.#pendingCount >= this.#flushThreshold && !this.#flushing) {
      this.#flush().catch(() => undefined);
    }
  }

  async #flush() {
    if (this.#flushing) return;
    if (this.#pendingCount === 0) return;

    this.#flushing = true;
    const impressions = this.#impressions;
    const clicks = this.#clicks;
    const engagements = this.#engagements;
    this.#impressions = new Map();
    this.#clicks = new Map();
    this.#engagements = new Map();
    this.#pendingCount = 0;

    try {
      await writeTrackerEventsToStaging(this.#pool, { impressions, clicks, engagements });
      logInfo({ service: 'smx-tracker-buffer', event: 'staging_written' });
    } catch (err) {
      logError({
        service: 'smx-tracker-buffer',
        event: 'staging_write_error',
        message: err?.message,
      });
      for (const [k, v] of impressions) {
        this.#impressions.set(k, (this.#impressions.get(k) ?? 0) + v);
        this.#pendingCount += v;
      }
      for (const [k, v] of clicks) {
        this.#clicks.set(k, (this.#clicks.get(k) ?? 0) + v);
        this.#pendingCount += v;
      }
      for (const [k, entry] of engagements) {
        const existing = this.#engagements.get(k);
        if (existing) {
          existing.count += entry.count;
          existing.durationMs += entry.durationMs;
        } else {
          this.#engagements.set(k, { ...entry });
        }
        this.#pendingCount += entry.count;
      }
    } finally {
      this.#flushing = false;
    }
  }
}
