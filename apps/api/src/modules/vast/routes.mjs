import { badRequest, forbidden, sendJson, serviceUnavailable } from '../../lib/http.mjs';
import { checkRateLimit } from '../../lib/rate-limit.mjs';
import { logError, logInfo, logWarn } from '../../lib/logger.mjs';

const MAX_VAST_BYTES = 512 * 1024;
const UPSTREAM_TIMEOUT_MS = 8000;

function getAllowedDomains(env) {
  const raw = String(env.vastAllowedDomains ?? '').trim();
  if (!raw) return null;
  return new Set(raw.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean));
}

function isDomainAllowed(url, allowedDomains) {
  if (allowedDomains === null) return true;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return [...allowedDomains].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export async function handleVastRoutes({ method, pathname, body, res, req, env, requestId }) {
  if (!(method === 'POST' && pathname === '/v1/vast/resolve')) return false;

  const limit = checkRateLimit({ headers: req.headers, key: 'vast-resolve', limit: 30, windowMs: 60_000 });
  if (!limit.ok) {
    return sendJson(res, 429, {
      ok: false,
      requestId,
      code: 'rate_limited',
      message: 'Too many VAST resolve requests. Please retry shortly.',
      retryAfterSeconds: limit.retryAfterSeconds,
    }, { 'Retry-After': String(limit.retryAfterSeconds) });
  }

  const tagUrl = body?.tagUrl;
  if (typeof tagUrl !== 'string' || !/^https?:\/\//i.test(tagUrl)) {
    return badRequest(res, requestId, 'tagUrl must be an absolute HTTP URL');
  }

  const allowedDomains = getAllowedDomains(env);
  if (!isDomainAllowed(tagUrl, allowedDomains)) {
    logWarn({ requestId, tagUrl }, 'VAST proxy rejected domain outside allowlist');
    return forbidden(res, requestId, 'This VAST tag domain is not permitted.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  let xml = '';
  try {
    const upstream = await fetch(tagUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/xml, text/xml, */*',
        'User-Agent': `SMX-Studio-VAST-Proxy/1.0 (+${env.appOrigin})`,
      },
    });

    clearTimeout(timeout);

    if (!upstream.ok) {
      logWarn({ requestId, tagUrl, status: upstream.status }, 'VAST upstream returned non-200');
      return serviceUnavailable(res, requestId, `Upstream VAST tag returned HTTP ${upstream.status}`);
    }

    const contentLength = upstream.headers.get('content-length');
    if (contentLength && Number.parseInt(contentLength, 10) > MAX_VAST_BYTES) {
      return serviceUnavailable(res, requestId, 'VAST response exceeds maximum allowed size.');
    }

    const reader = upstream.body?.getReader();
    if (!reader) {
      return serviceUnavailable(res, requestId, 'VAST upstream returned no body.');
    }

    const chunks = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_VAST_BYTES) {
        await reader.cancel();
        return serviceUnavailable(res, requestId, 'VAST response exceeds maximum allowed size.');
      }
      chunks.push(value);
    }

    xml = new TextDecoder().decode(
      chunks.reduce((acc, chunk) => {
        const merged = new Uint8Array(acc.length + chunk.length);
        merged.set(acc);
        merged.set(chunk, acc.length);
        return merged;
      }, new Uint8Array(0)),
    );
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      return sendJson(res, 504, {
        ok: false,
        requestId,
        code: 'upstream_timeout',
        message: 'VAST tag request timed out.',
      });
    }
    logError({ requestId, tagUrl, error }, 'VAST proxy fetch failed');
    return serviceUnavailable(res, requestId, 'Failed to fetch VAST tag.');
  }

  logInfo({ requestId, tagUrl, bytes: xml.length }, 'VAST proxy resolved tag');
  return sendJson(res, 200, {
    ok: true,
    requestId,
    xml,
  }, { 'Cache-Control': 'private, no-store' });
}
