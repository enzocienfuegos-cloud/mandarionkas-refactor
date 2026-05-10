import { getPostgresSchemaName, withPostgresTransaction } from './data/postgres-client.mjs';

function nowMs() {
  return Date.now();
}

function bucketKey(scope, subject) {
  return `${scope}:${subject || 'anonymous'}`;
}

function normalizeWindow(windowMs) {
  return Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 60_000;
}

function normalizeLimit(limit) {
  return Number.isFinite(limit) && limit > 0 ? limit : 10;
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function table(name) {
  return `${quoteIdentifier(getPostgresSchemaName())}.${quoteIdentifier(name)}`;
}

function floorWindowStart(currentTime, windowMs) {
  return Math.floor(currentTime / windowMs) * windowMs;
}

function toIsoTime(valueMs) {
  return new Date(valueMs).toISOString();
}

function toEpochMs(value) {
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : nowMs();
}

export function getRequestRateLimitSubject(req) {
  const forwardedFor = typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'] : '';
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  const realIp = typeof req.headers['x-real-ip'] === 'string' ? req.headers['x-real-ip'] : '';
  if (realIp) return realIp.trim();
  return req.socket?.remoteAddress || 'unknown';
}

export async function consumeRateLimit(scope, subject, { limit = 10, windowMs = 60_000 } = {}) {
  const normalizedLimit = normalizeLimit(limit);
  const normalizedWindow = normalizeWindow(windowMs);
  const key = bucketKey(scope, subject);
  const currentTime = nowMs();
  const windowStartMs = floorWindowStart(currentTime, normalizedWindow);
  const resetAtMs = windowStartMs + normalizedWindow;
  const windowStartIso = toIsoTime(windowStartMs);
  const resetAtIso = toIsoTime(resetAtMs);

  const result = await withPostgresTransaction(async (query) => {
    await query(
      `DELETE FROM ${table('rate_limit_buckets')}
       WHERE reset_at <= $1`,
      [toIsoTime(currentTime)]
    );

    const upsert = await query(
      `INSERT INTO ${table('rate_limit_buckets')} (
        scope, subject, window_start, reset_at, count, limit_count, updated_at
      ) VALUES ($1, $2, $3, $4, 1, $5, NOW())
      ON CONFLICT (scope, subject, window_start) DO UPDATE SET
        count = ${table('rate_limit_buckets')}.count + 1,
        limit_count = EXCLUDED.limit_count,
        reset_at = EXCLUDED.reset_at,
        updated_at = NOW()
      RETURNING count, limit_count, reset_at`,
      [scope, key, windowStartIso, resetAtIso, normalizedLimit]
    );

    return upsert.rows?.[0] ?? {
      count: 1,
      limit_count: normalizedLimit,
      reset_at: resetAtIso,
    };
  });

  const count = Number(result.count || 1);
  const limitCount = Number(result.limit_count || normalizedLimit);
  const resolvedResetAtMs = toEpochMs(result.reset_at);
  const remaining = Math.max(0, limitCount - count);
  const retryAfterSeconds = Math.max(1, Math.ceil((resolvedResetAtMs - currentTime) / 1000));

  return {
    ok: count <= limitCount,
    count,
    limit: limitCount,
    remaining,
    resetAt: resolvedResetAtMs,
    retryAfterSeconds,
  };
}

export function getRateLimitHeaders(result) {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    'Retry-After': String(result.retryAfterSeconds),
  };
}
