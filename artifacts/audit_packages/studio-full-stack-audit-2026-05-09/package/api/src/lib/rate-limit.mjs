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
