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
import geoip from 'geoip-lite';
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

function trimQuotedHeader(value) {
  return trimText(value).replace(/^"+|"+$/g, '');
}

function readHeader(req, name) {
  const value = req?.headers?.[name];
  return Array.isArray(value) ? trimText(value[0] || '') : trimText(value || '');
}

function normalizeCountryCode(value) {
  const normalized = trimText(value).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  if (!normalized || normalized === 'XX' || normalized === 'T1') return '';
  return normalized;
}

function sanitizeGeoLabel(value) {
  const normalized = decodeStringSafe(value).trim();
  if (!normalized) return '';
  if (/^(unknown|null|undefined|n\/a|xx|t1)$/i.test(normalized)) return '';
  return normalized;
}

function normalizeLookupIp(value) {
  const normalized = trimText(value).replace(/^\[|\]$/g, '');
  if (!normalized) return '';
  const v4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4Mapped?.[1]) return v4Mapped[1];
  const zoneIndex = normalized.indexOf('%');
  return zoneIndex === -1 ? normalized : normalized.slice(0, zoneIndex);
}

function resolveClientIp(req) {
  const candidates = [
    readHeader(req, 'do-connecting-ip'),
    readHeader(req, 'cf-connecting-ip'),
    readHeader(req, 'true-client-ip'),
    readHeader(req, 'x-real-ip'),
    trimText(readHeader(req, 'x-forwarded-for').split(',')[0] || ''),
    trimText(req?.socket?.remoteAddress || ''),
  ];
  for (const candidate of candidates) {
    const normalized = normalizeLookupIp(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function resolveGeoContext(req, url) {
  const p = url.searchParams;
  const ip = resolveClientIp(req);
  const lookup = ip ? geoip.lookup(ip) : null;

  const countryFromMacros = normalizeCountryCode(p.get('country') || '');
  const regionFromMacros = sanitizeGeoLabel(p.get('region') || p.get('subdivision_1') || p.get('state') || '');
  const cityFromMacros = sanitizeGeoLabel(p.get('city') || p.get('metro') || '');

  const countryFromHeaders = normalizeCountryCode(
    readHeader(req, 'cf-ipcountry') ||
    readHeader(req, 'x-vercel-ip-country') ||
    readHeader(req, 'x-country-code') ||
    '',
  );
  const regionFromHeaders = sanitizeGeoLabel(
    readHeader(req, 'cf-region') ||
    readHeader(req, 'cf-region-code') ||
    readHeader(req, 'x-vercel-ip-country-region') ||
    '',
  );
  const cityFromHeaders = sanitizeGeoLabel(
    readHeader(req, 'cf-ipcity') ||
    readHeader(req, 'x-vercel-ip-city') ||
    '',
  );

  const countryFromIp = normalizeCountryCode(lookup?.country || '');
  const regionFromIp = sanitizeGeoLabel(lookup?.region || '');
  const cityFromIp = sanitizeGeoLabel(lookup?.city || '');

  return {
    ip,
    country: countryFromMacros || countryFromHeaders || countryFromIp || null,
    region: regionFromMacros || regionFromHeaders || regionFromIp || null,
    city: cityFromMacros || cityFromHeaders || cityFromIp || null,
  };
}

function parseDeviceTypeFromUA(ua) {
  if (!ua) return '';
  const s = ua.toLowerCase();
  if (/smart.?tv|hbbtv|appletv|googletv|roku|firetv|tizen|webos|viera|bravia/.test(s)) return 'tv';
  if (/tablet|ipad|kindle|playbook|silk/.test(s)) return 'tablet';
  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry|symbian/.test(s)) return 'phone';
  if (/android/.test(s)) return 'tablet';
  return 'desktop';
}

function parseBrowserFromUA(ua) {
  if (!ua) return '';
  const s = ua.toLowerCase();
  if (/edg\/|edge\//.test(s)) return 'Edge';
  if (/opr\/|opera\//.test(s)) return 'Opera';
  if (/firefox\//.test(s)) return 'Firefox';
  if (/chrome\//.test(s)) return 'Chrome';
  if (/safari\//.test(s)) return 'Safari';
  if (/msie |trident\//.test(s)) return 'IE';
  return '';
}

function parseOsFromUA(ua) {
  if (!ua) return '';
  const s = ua.toLowerCase();
  if (/windows phone/.test(s)) return 'Windows Phone';
  if (/windows/.test(s)) return 'Windows';
  if (/iphone|ipad|ipod|ios/.test(s)) return 'iOS';
  if (/mac os x|macos/.test(s)) return 'macOS';
  if (/android/.test(s)) return 'Android';
  if (/linux/.test(s)) return 'Linux';
  if (/cros/.test(s)) return 'ChromeOS';
  return '';
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

function extractTrackingContext(req, url, geo) {
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

  return {
    siteDomain: siteDomain || null,
    referer,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    userAgent: trimText(req.headers['user-agent'] || '') || null,
    remoteIp: geo.ip,
  };
}

function queueClickEventWrite(pool, {
  tagId,
  workspaceId,
  deviceId,
  ip,
  userAgent,
  country,
  region,
  city,
  siteDomain,
  referer,
}) {
  if (!pool || !tagId || !workspaceId) return;
  pool.query(
    `INSERT INTO click_events
       (tag_id, workspace_id, device_id, ip, user_agent, country, region, city, site_domain, referer)
     VALUES
       ($1, $2, $3, $4::inet, $5, $6, $7, $8, $9, $10)`,
    [
      tagId,
      workspaceId,
      deviceId || null,
      ip || null,
      userAgent || null,
      country || null,
      region || null,
      city || null,
      siteDomain || null,
      referer || null,
    ],
  ).catch(() => undefined);
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
      const { cookie } = resolveDeviceId(req, env);

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
          const geo = resolveGeoContext(req, url);
          const trackingContext = extractTrackingContext(req, url, geo);
          const country = trackingContext.country;
          const region = trackingContext.region;
          const city = trackingContext.city;

          const deviceTypeSignal = trimText(
            p.get('devicetype') || p.get('device') || '',
          ).toLowerCase() || null;
          const deviceIdSignal = trimText(
            p.get('adid') || p.get('ifa') ||
            p.get('gadvid') || p.get('idfa') || p.get('googleAdvertisingId') || '',
          ) || null;
          const deviceModel = trimQuotedHeader(
            p.get('devicemodel') || p.get('deviceModel') || req.headers['sec-ch-ua-model'] || '',
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
          const pagePosition = trimText(p.get('ppos') || p.get('pos') || p.get('position') || '') || null;
          const contentLanguage = trimText(p.get('lang') || p.get('contentlang') || '') || null;
          const contentTitle = decodeStringSafe(p.get('title') || p.get('contenttitle') || '') || null;
          const contentSeries = decodeStringSafe(p.get('series') || p.get('contentseries') || '') || null;
          const carrier = trimText(p.get('carrier') || p.get('isp') || '') || null;
          const appStoreName = trimText(p.get('appstore') || p.get('store') || '') || null;
          const contentGenre = decodeStringSafe(p.get('genre') || p.get('contentgenre') || '') || null;
          const contextualIds = trimText(
            p.get('ctxid') || p.get('ctxids') || p.get('contextualid') || p.get('contextualids') || '',
          ) || null;
          const userAgent = trimText(req.headers['user-agent'] || '') || null;
          const browser = trimQuotedHeader(req.headers['sec-ch-ua'] || '') || parseBrowserFromUA(userAgent);
          const os = trimQuotedHeader(req.headers['sec-ch-ua-platform'] || '') || parseOsFromUA(userAgent);
          const deviceType = deviceTypeSignal || parseDeviceTypeFromUA(userAgent);
          const remoteIp = trackingContext.remoteIp;

          if (
            trackingContext.siteDomain || country || userAgent || appId || appBundle || appName ||
            deviceType || deviceIdSignal || deviceModel || exchangeId || exchangePublisherId ||
            exchangeSiteIdOrDomain || sourcePublisherId || networkId || siteId || browser || os ||
            pagePosition || contentLanguage || contentTitle || contentSeries || carrier ||
            appStoreName || contentGenre || contextualIds || region || city || deviceId
          ) {
            pool.query(
              `INSERT INTO impression_events
                 (tag_id, workspace_id, ip, user_agent, country, region, city, site_domain, referer,
                  device_id, device_type, device_model, browser, os, network_id, source_publisher_id,
                  app_id, site_id, exchange_id, exchange_publisher_id, exchange_site_id_or_domain,
                  app_bundle, app_name, page_position, content_language, content_title, content_series,
                  carrier, app_store_name, content_genre, contextual_ids)
               VALUES ($1, $2, $3::inet, $4, $5, $6, $7, $8, $9,
                       $10, $11, $12, $13, $14, $15, $16,
                       $17, $18, $19, $20, $21,
                       $22, $23, $24, $25, $26, $27,
                       $28, $29, $30, $31)`,
              [
                tagId,
                workspaceId,
                remoteIp || null,
                userAgent,
                country,
                region,
                city,
                trackingContext.siteDomain,
                trackingContext.referer,
                deviceId || deviceIdSignal,
                deviceType || null,
                deviceModel,
                browser || null,
                os || null,
                networkId,
                sourcePublisherId,
                appId,
                siteId,
                exchangeId,
                exchangePublisherId,
                exchangeSiteIdOrDomain,
                appBundle,
                appName,
                pagePosition,
                contentLanguage,
                contentTitle,
                contentSeries,
                carrier,
                appStoreName,
                contentGenre,
                contextualIds,
              ],
            ).catch(() => undefined);
          }
        }).catch(() => undefined);
      }

      return true;
    }

    // ── engagement ───────────────────────────────────────────────────────
    if ((method === 'GET' || method === 'POST') && /^\/v1\/tags\/tracker\/[^/]+\/engagement$/.test(pathname)) {
      const tagId = pathname.split('/')[4];
      const event = trimText(url.searchParams.get('event'));
      const playhead = Number(url.searchParams.get('t') || url.searchParams.get('playhead') || 0);

      // S46: Issue/refresh smx_uid on engagement too (keeps cookie alive).
      const { deviceId, cookie } = resolveDeviceId(req, env);

      applyPublicCors(req, res);
      res.statusCode = 204;
      res.setHeader('Cache-Control', 'private, no-store');
      if (cookie) res.setHeader('Set-Cookie', cookie);
      res.end();

      if (event) queueEngagementWrite(buffer, getDatabasePool(env), tagId, event, playhead, requestId);
      return true;
    }

    if (method === 'POST' && /^\/v1\/tags\/tracker\/[^/]+\/click$/.test(pathname)) {
      const tagId = pathname.split('/')[4];
      const pool = getDatabasePool(env);

      const { cookie } = resolveDeviceId(req, env);

      applyPublicCors(req, res);
      res.statusCode = 204;
      res.setHeader('Cache-Control', 'private, no-store');
      if (cookie) res.setHeader('Set-Cookie', cookie);
      res.end();

      queueClickWrite(buffer, pool, tagId, requestId);
      if (pool) {
        const geo = resolveGeoContext(req, url);
        const trackingContext = extractTrackingContext(req, url, geo);
        getTagWorkspaceId(pool, tagId).then((workspaceId) => {
          if (!workspaceId) return;
          queueClickEventWrite(pool, {
            tagId,
            workspaceId,
            deviceId,
            ip: trackingContext.remoteIp,
            userAgent: trackingContext.userAgent,
            country: trackingContext.country,
            region: trackingContext.region,
            city: trackingContext.city,
            siteDomain: trackingContext.siteDomain,
            referer: trackingContext.referer,
          });
        }).catch(() => undefined);
      }
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
      const { deviceId, cookie } = resolveDeviceId(req, env);

      applyPublicCors(req, res);
      res.statusCode = 302;
      res.setHeader('Location', destination);
      res.setHeader('Cache-Control', 'private, no-store');
      if (cookie) res.setHeader('Set-Cookie', cookie);
      res.end();

      queueClickWrite(buffer, pool, tagId, requestId);
      if (pool) {
        const geo = resolveGeoContext(req, url);
        const trackingContext = extractTrackingContext(req, url, geo);
        getTagWorkspaceId(pool, tagId).then((workspaceId) => {
          if (!workspaceId) return;
          queueClickEventWrite(pool, {
            tagId,
            workspaceId,
            deviceId,
            ip: trackingContext.remoteIp,
            userAgent: trackingContext.userAgent,
            country: trackingContext.country,
            region: trackingContext.region,
            city: trackingContext.city,
            siteDomain: trackingContext.siteDomain,
            referer: trackingContext.referer,
          });
        }).catch(() => undefined);
      }
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
