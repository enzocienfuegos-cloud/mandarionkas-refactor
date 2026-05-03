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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.removeHeader('Access-Control-Allow-Credentials');
  res.removeHeader('Vary');
}

function trimText(value) {
  return String(value ?? '').trim();
}

function decodeStringSafe(value) {
  if (!value) return '';
  try { return decodeURIComponent(String(value)); } catch (_) { return String(value); }
}

function extractHostname(urlOrDomain) {
  if (!urlOrDomain) return '';
  try {
    const s = urlOrDomain.startsWith('http') ? urlOrDomain : `https://${urlOrDomain}`;
    return new URL(s).hostname;
  } catch (_) {
    return urlOrDomain.split('/')[0] || '';
  }
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

      // S46 + S61: Frequency cap + identity capture, fire-and-forget.
      if (pool) {
        getTagWorkspaceId(pool, tagId).then((workspaceId) => {
          if (!workspaceId) return;

          if (deviceId) {
            recordFrequencyCapImpression(pool, { tagId, deviceId, workspaceId });
          }

          const p = url.searchParams;
          const rawPageUrl = trimText(
            p.get('purl') || p.get('pu') || p.get('pageUrlEnc') || p.get('site') || '',
          );
          const rawDomain = trimText(
            p.get('dom') || p.get('sd') || p.get('domain') ||
            p.get('sdmn') || p.get('siteid') || p.get('inventoryUnitReportingName') || '',
          );
          const siteDomain = rawDomain
            ? extractHostname(decodeStringSafe(rawDomain))
            : rawPageUrl
              ? extractHostname(decodeStringSafe(rawPageUrl))
              : extractHostname(trimText(req.headers.referer || req.headers.referrer || ''));

          const referer = decodeStringSafe(rawPageUrl) ||
            trimText(req.headers.referer || req.headers.referrer || '') || null;

          const country = trimText(p.get('country') || '')
            .toUpperCase()
            .replace(/[^A-Z]/g, '')
            .slice(0, 2) || null;

          const deviceType = trimText(
            p.get('devicetype') || p.get('device') || '',
          ).toLowerCase() || null;
          const deviceIdSignal = trimText(
            p.get('adid') || p.get('ifa') ||
            p.get('gadvid') || p.get('idfa') || p.get('googleAdvertisingId') || '',
          ) || null;
          const appId = trimText(p.get('appid') || '') || null;
          const appBundle = trimText(p.get('appb') || '') || null;
          const appName = decodeStringSafe(p.get('appn') || p.get('appne') || '') || null;
          const exchangeId = trimText(p.get('excid') || '') || null;
          const exchangePublisherId = trimText(p.get('excpubid') || '') || null;
          const exchangeSiteIdOrDomain = trimText(p.get('excsiddmn') || '') || null;
          const sourcePublisherId = trimText(p.get('srcpubid') || '') || null;
          const networkId = trimText(p.get('nid') || '') || null;
          const siteId = trimText(p.get('siteid') || '') || null;
          const userAgent = trimText(req.headers['user-agent'] || '') || null;
          const xForwardedFor = trimText(req.headers['x-forwarded-for'] || '');
          const remoteIp = (xForwardedFor ? xForwardedFor.split(',')[0].trim() : '') ||
            req.socket?.remoteAddress || null;

          if (
            siteDomain || country || userAgent || appId || appBundle || appName ||
            deviceType || deviceIdSignal || exchangeId || exchangePublisherId ||
            exchangeSiteIdOrDomain || sourcePublisherId || networkId || siteId
          ) {
            pool.query(
              `INSERT INTO impression_events
                 (tag_id, workspace_id, ip, user_agent, country, site_domain, referer)
               VALUES ($1, $2, $3::inet, $4, $5, $6, $7)`,
              [
                tagId,
                workspaceId,
                remoteIp || null,
                userAgent,
                country,
                siteDomain || null,
                referer,
              ],
            ).catch(() => undefined);
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
