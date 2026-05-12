const buckets = new Map();

function now() {
  return Date.now();
}

function getIp(headers) {
  const forwarded = Array.isArray(headers['x-forwarded-for']) ? headers['x-forwarded-for'][0] : headers['x-forwarded-for'] || '';
  const real = Array.isArray(headers['x-real-ip']) ? headers['x-real-ip'][0] : headers['x-real-ip'] || '';
  return String(forwarded || real).split(',')[0].trim() || 'anonymous';
}

export function checkRateLimit({ headers, key, limit, windowMs }) {
  const ip = getIp(headers);
  const bucketKey = `${key}:${ip}`;
  const entry = buckets.get(bucketKey);
  const currentTime = now();

  if (!entry || entry.resetAt <= currentTime) {
    const next = { count: 1, resetAt: currentTime + windowMs };
    buckets.set(bucketKey, next);
    return { ok: true, remaining: limit - 1, resetAt: next.resetAt };
  }

  if (entry.count >= limit) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - currentTime) / 1000)) };
  }

  entry.count += 1;
  buckets.set(bucketKey, entry);
  return { ok: true, remaining: Math.max(0, limit - entry.count), resetAt: entry.resetAt };
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toTimeMs(value) {
  const timeMs = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timeMs) ? timeMs : 0;
}

export async function checkPostgresRateLimit(client, {
  headers,
  key,
  limit,
  windowMs,
} = {}) {
  const safeLimit = normalizePositiveInteger(limit, 20);
  const safeWindowMs = normalizePositiveInteger(windowMs, 60_000);
  const ip = getIp(headers || {});
  const bucketKey = `${String(key || 'default').trim() || 'default'}:${ip}`;
  const currentTime = now();
  const nextResetAt = new Date(currentTime + safeWindowMs);

  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [bucketKey]);
    const { rows } = await client.query(
      `SELECT count, reset_at
       FROM rate_limit_buckets
       WHERE bucket_key = $1
       FOR UPDATE`,
      [bucketKey],
    );
    const entry = rows[0] ?? null;
    const resetAtMs = entry ? toTimeMs(entry.reset_at) : 0;

    if (!entry || resetAtMs <= currentTime) {
      await client.query(
        `INSERT INTO rate_limit_buckets (bucket_key, count, reset_at)
         VALUES ($1, 1, $2)
         ON CONFLICT (bucket_key) DO UPDATE
         SET count = 1,
             reset_at = EXCLUDED.reset_at,
             updated_at = NOW()`,
        [bucketKey, nextResetAt],
      );
      await client.query('COMMIT');
      return { ok: true, remaining: safeLimit - 1, resetAt: nextResetAt.getTime() };
    }

    if (Number(entry.count || 0) >= safeLimit) {
      await client.query('COMMIT');
      return {
        ok: false,
        remaining: 0,
        resetAt: resetAtMs,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - currentTime) / 1000)),
      };
    }

    const nextCount = Number(entry.count || 0) + 1;
    await client.query(
      `UPDATE rate_limit_buckets
       SET count = $2,
           updated_at = NOW()
       WHERE bucket_key = $1`,
      [bucketKey, nextCount],
    );
    await client.query('COMMIT');
    return { ok: true, remaining: Math.max(0, safeLimit - nextCount), resetAt: resetAtMs };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original rate-limit error.
    }
    throw error;
  }
}
