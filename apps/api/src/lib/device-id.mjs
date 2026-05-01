// apps/api/src/lib/device-id.mjs
//
// S46: First-party device identity cookie (smx_uid).
//
// Design:
//   - Cookie name: smx_uid
//   - Value: random UUID v4 (crypto.randomUUID)
//   - Lifetime: 30 days (Max-Age=2592000)
//   - Flags: SameSite=None; Secure; Path=/v1/tags/tracker
//     SameSite=None is required for third-party ad contexts (cross-site iframes).
//     Path scoped to tracker routes to minimize surface area.
//   - The cookie is set on every tracker response where it wasn't already present.
//   - In non-secure (dev) environments the Secure flag is omitted, and
//     SameSite falls back to Lax to avoid browser rejection.
//
// Usage:
//   const { deviceId, cookie } = resolveDeviceId(req, env);
//   if (cookie) res.setHeader('Set-Cookie', cookie);
//   // deviceId is always a string — falls back to '' if cookies are fully blocked.

import { randomUUID } from 'node:crypto';
import { parseCookies, serializeCookie } from './cookies.mjs';

const COOKIE_NAME   = 'smx_uid';
const MAX_AGE_S     = 30 * 24 * 60 * 60; // 30 days
const TRACKER_PATH  = '/v1/tags/tracker';

/**
 * Read or generate a device ID from the smx_uid cookie.
 *
 * @param {IncomingMessage} req
 * @param {object} env           - API env config (needs env.cookieSecure)
 * @returns {{ deviceId: string, cookie: string|null }}
 *   deviceId: the ID to use for this request (existing or newly generated)
 *   cookie:   the Set-Cookie string to attach, or null if cookie already existed
 */
export function resolveDeviceId(req, env) {
  const cookies = parseCookies(req.headers);
  const existing = String(cookies[COOKIE_NAME] || '').trim();

  if (existing && isValidUid(existing)) {
    // Already have a valid cookie — no need to set it again.
    return { deviceId: existing, cookie: null };
  }

  const deviceId = randomUUID();
  const secure   = env?.cookieSecure !== false; // default true in production

  const cookie = serializeCookie(COOKIE_NAME, deviceId, {
    maxAge:   MAX_AGE_S,
    path:     TRACKER_PATH,
    httpOnly: false,           // must be readable by JS in MRAID/WebView contexts
    secure,
    sameSite: secure ? 'None' : 'Lax',
  });

  return { deviceId, cookie };
}

/**
 * Extract device ID from an existing cookie without generating a new one.
 * Returns '' if not present or invalid.
 *
 * @param {IncomingMessage} req
 * @returns {string}
 */
export function readDeviceId(req) {
  const cookies = parseCookies(req.headers);
  const value = String(cookies[COOKIE_NAME] || '').trim();
  return isValidUid(value) ? value : '';
}

// ─── Internal ──────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUid(value) {
  return UUID_RE.test(value);
}
