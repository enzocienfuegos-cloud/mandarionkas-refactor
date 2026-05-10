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
import { inferContext } from '@smx/db/src/context-classifier.mjs';
import { recordClick, recordEngagement, recordImpression } from '@smx/db/src/tracking.mjs';
import { parseBrowserFromUA, parseDeviceTypeFromUA, parseOsFromUA } from '@smx/db/src/ua-parser.mjs';
import { getTagClickDestination } from '@smx/db/src/vast.mjs';
import { recordFrequencyCapImpression } from '@smx/db/src/frequency-cap.mjs';
import { resolveDeviceId } from '../../../lib/device-id.mjs';
import { hashIp } from '../../../lib/ip-fingerprint.mjs';
import { logWarn } from '../../../lib/logger.mjs';
import { queueImpressionEventWrite, resolveTagWorkspaceId } from './service.mjs';

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
  ipFingerprint,
}) {
  if (!pool || !tagId || !workspaceId) return;
  pool.query(
    `INSERT INTO click_events
       (tag_id, workspace_id, device_id, ip, user_agent, country, region, city, site_domain, referer, ip_fingerprint)
     VALUES
       ($1, $2, $3, $4::inet, $5, $6, $7, $8, $9, $10, $11)`,
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
      ipFingerprint || null,
    ],
  ).catch((err) => logWarn({
    service: 'smx-tracker',
    fn: 'click_identity_write',
    tagId,
    message: err?.message ?? String(err),
  }));
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
        resolveTagWorkspaceId(pool, tagId).then((workspaceId) => {
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
          const ipFingerprint = hashIp(remoteIp, env?.sessionSecret);
          const sfTz = trimText(p.get('sf_tz') || '') || null;
          const sfLang = trimText(p.get('sf_lang') || '') || null;
          const sfScr = trimText(p.get('sf_scr') || '') || null;
          const sfTouch = p.get('sf_touch') === '1' ? true : p.get('sf_touch') === '0' ? false : null;
          const sfMem = p.get('sf_mem') ? Number(p.get('sf_mem')) || null : null;
          const sfCpu = p.get('sf_cpu') ? Number.parseInt(p.get('sf_cpu'), 10) || null : null;

          inferContext(pool, {
            siteDomain: trackingContext.siteDomain,
            referer: trackingContext.referer,
            appBundle,
            appName,
            contentGenre,
          }).catch(() => 'unknown').then((inferredContext) => {
            if (
            trackingContext.siteDomain || country || userAgent || appId || appBundle || appName ||
            deviceType || deviceIdSignal || deviceModel || exchangeId || exchangePublisherId ||
            exchangeSiteIdOrDomain || sourcePublisherId || networkId || siteId || browser || os ||
            pagePosition || contentLanguage || contentTitle || contentSeries || carrier ||
            appStoreName || contentGenre || contextualIds || region || city || deviceId ||
            ipFingerprint || sfTz || sfLang || sfScr || sfTouch !== null || sfMem !== null || sfCpu !== null ||
            inferredContext !== 'unknown'
            ) {
            queueImpressionEventWrite(pool, {
              tagId,
              workspaceId,
              remoteIp,
              userAgent,
              country,
              region,
              city,
              siteDomain: trackingContext.siteDomain,
              referer: trackingContext.referer,
              deviceId: deviceId || deviceIdSignal,
              deviceType: deviceType || null,
              deviceModel,
              browser: browser || null,
              os: os || null,
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
              ipFingerprint,
              sfTz,
              sfLang,
              sfScr,
              sfTouch,
              sfMem,
              sfCpu,
              inferredContext: inferredContext || 'unknown',
            });
            }
          });
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

      const { deviceId, cookie } = resolveDeviceId(req, env);

      applyPublicCors(req, res);
      res.statusCode = 204;
      res.setHeader('Cache-Control', 'private, no-store');
      if (cookie) res.setHeader('Set-Cookie', cookie);
      res.end();

      queueClickWrite(buffer, pool, tagId, requestId);
      if (pool) {
        const geo = resolveGeoContext(req, url);
        const trackingContext = extractTrackingContext(req, url, geo);
        resolveTagWorkspaceId(pool, tagId).then((workspaceId) => {
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
            ipFingerprint: hashIp(trackingContext.remoteIp, env?.sessionSecret),
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
        resolveTagWorkspaceId(pool, tagId).then((workspaceId) => {
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
            ipFingerprint: hashIp(trackingContext.remoteIp, env?.sessionSecret),
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
