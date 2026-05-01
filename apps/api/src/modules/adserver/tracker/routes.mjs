// apps/api/src/modules/adserver/tracker/routes.mjs
//
// S46: Added first-party cookie (smx_uid) and frequency cap impression recording.
//
// Changes vs S40 version:
//   - resolveDeviceId() reads/generates smx_uid on every impression/engagement/click.
//   - Set-Cookie header is attached to responses when a new smx_uid is issued.
//   - recordFrequencyCapImpression() is called fire-and-forget after impression.gif.
//   - getTagWorkspaceId() helper fetches workspace_id for the cap recording.
//   - click and engagement also resolve the device cookie (for continuity),
//     but do NOT record frequency cap events (only impressions count toward cap).

import { getPool } from '@smx/db/src/pool.mjs';
import { recordClick, recordEngagement, recordImpression } from '@smx/db/src/tracking.mjs';
import { getTagClickDestination } from '@smx/db/src/vast.mjs';
import { recordFrequencyCapImpression } from '@smx/db/src/frequency-cap.mjs';
import { resolveDeviceId } from '../../../lib/device-id.mjs';
import { logWarn } from '../../../lib/logger.mjs';

const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64',
);

function applyPublicCors(req, res) {
  const origin = String(req?.headers?.origin ?? '').trim();
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.removeHeader('Access-Control-Allow-Credentials');
  }
  res.setHeader('Vary', 'Origin');
}

function trimText(value) {
  return String(value ?? '').trim();
}

function resolveBaseUrl(ctx) {
  const explicit = trimText(ctx.env.apiBaseUrl || ctx.env.apiPublicBaseUrl || ctx.env.baseUrl);
  if (explicit) return explicit.replace(/\/+$/, '');
  const protocol = trimText(ctx.req.headers['x-forwarded-proto']) || 'https';
  const host = trimText(ctx.req.headers['x-forwarded-host'] || ctx.req.headers.host);
  return host ? `${protocol}://${host}` : 'https://localhost';
}

function getDatabasePool(env) {
  const connectionString = trimText(env.databasePoolUrl || env.databaseUrl);
  return connectionString ? getPool(connectionString) : null;
}

// Fetch workspace_id for a tag — needed for frequency cap recording.
// Returns null gracefully if DB is unavailable or tag not found.
async function getTagWorkspaceId(pool, tagId) {
  if (!pool || !tagId) return null;
  try {
    const { rows } = await pool.query(
      `SELECT workspace_id FROM ad_tags WHERE id = $1 LIMIT 1`,
      [tagId],
    );
    return rows[0]?.workspace_id ?? null;
  } catch {
    return null;
  }
}

export function createTrackerRoutes(buffer = null) {
  return async function handleTrackerDeliveryRoutes(ctx) {
    const { method, pathname, res, req, requestId, url, env } = ctx;

    if (method === 'OPTIONS' && /^\/v1\/tags\/tracker\//.test(pathname)) {
      applyPublicCors(req, res);
      res.statusCode = 204;
      res.end();
      return true;
    }

    // ── impression.gif ───────────────────────────────────────────────────
    if (method === 'GET' && /^\/v1\/tags\/tracker\/[^/]+\/impression\.gif$/.test(pathname)) {
      const tagId = pathname.split('/')[4];

      // S46: Resolve/generate smx_uid cookie before sending response.
      const { deviceId, cookie } = resolveDeviceId(req, env);

      applyPublicCors(req, res);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Content-Length', PIXEL_GIF.length);
      res.setHeader('Cache-Control', 'private, no-store');
      // Set cookie when newly issued (cookie is null if already existed).
      if (cookie) res.setHeader('Set-Cookie', cookie);
      res.end(PIXEL_GIF);

      const pool = getDatabasePool(env);

      // Write impression to tracker buffer / DB (S40).
      queueImpressionWrite(buffer, pool, tagId, requestId);

      // S46: Record frequency cap impression fire-and-forget.
      if (pool && deviceId) {
        getTagWorkspaceId(pool, tagId).then((workspaceId) => {
          if (workspaceId) {
            recordFrequencyCapImpression(pool, { tagId, deviceId, workspaceId });
          }
        }).catch(() => undefined);
      }

      return true;
    }

    // ── engagement ───────────────────────────────────────────────────────
    if (method === 'GET' && /^\/v1\/tags\/tracker\/[^/]+\/engagement$/.test(pathname)) {
      const tagId = pathname.split('/')[4];
      const event = trimText(url.searchParams.get('event'));
      const playhead = Number(url.searchParams.get('t') || url.searchParams.get('playhead') || 0);

      // S46: Issue/refresh smx_uid on engagement too (keeps cookie alive).
      const { cookie } = resolveDeviceId(req, env);

      applyPublicCors(req, res);
      res.statusCode = 204;
      res.setHeader('Cache-Control', 'private, no-store');
      if (cookie) res.setHeader('Set-Cookie', cookie);
      res.end();

      if (event) queueEngagementWrite(buffer, getDatabasePool(env), tagId, event, playhead, requestId);
      return true;
    }

    // ── click ────────────────────────────────────────────────────────────
    if (method === 'GET' && /^\/v1\/tags\/tracker\/[^/]+\/click$/.test(pathname)) {
      const tagId = pathname.split('/')[4];
      const explicitTarget = trimText(url.searchParams.get('url'));
      const pool = getDatabasePool(env);

      const destination =
        explicitTarget ||
        (pool ? await getTagClickDestination(pool, tagId).catch(() => null) : null) ||
        resolveBaseUrl(ctx);

      // S46: Issue/refresh smx_uid on click.
      const { cookie } = resolveDeviceId(req, env);

      applyPublicCors(req, res);
      res.statusCode = 302;
      res.setHeader('Location', destination);
      res.setHeader('Cache-Control', 'private, no-store');
      if (cookie) res.setHeader('Set-Cookie', cookie);
      res.end();

      queueClickWrite(buffer, pool, tagId, requestId);
      return true;
    }

    return false;
  };
}

// ─── Write helpers (unchanged from S40) ────────────────────────────────────

function queueImpressionWrite(buffer, pool, tagId, requestId) {
  if (buffer) { buffer.addImpression(tagId); return; }
  if (!pool) return;
  recordImpression(pool, tagId).catch((err) =>
    logWarn({ service: 'smx-tracker', fn: 'queueImpressionWrite', tagId, requestId, message: err?.message }),
  );
}

function queueClickWrite(buffer, pool, tagId, requestId) {
  if (buffer) { buffer.addClick(tagId); return; }
  if (!pool) return;
  recordClick(pool, tagId).catch((err) =>
    logWarn({ service: 'smx-tracker', fn: 'queueClickWrite', tagId, requestId, message: err?.message }),
  );
}

function queueEngagementWrite(buffer, pool, tagId, eventType, durationMs, requestId) {
  if (buffer) { buffer.addEngagement(tagId, eventType, durationMs); return; }
  if (!pool) return;
  recordEngagement(pool, tagId, eventType, durationMs).catch((err) =>
    logWarn({ service: 'smx-tracker', fn: 'queueEngagementWrite', tagId, eventType, requestId, message: err?.message }),
  );
}
