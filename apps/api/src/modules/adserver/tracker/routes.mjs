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
import { logInfo, logWarn } from '../../../lib/logger.mjs';
import { queueImpressionEventWrite, resolveTagWorkspaceId } from './service.mjs';

const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64',
);

const BOT_UA_REGEX = /bot|crawler|spider|preview|fetch|scanner|validator|monitor|headless|phantom|selenium|chrome-lighthouse|googleweblight|pagespeed|lighthouse|facebookexternalhit|slurp|curl|wget/i;

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

function isUnresolvedMacroValue(value) {
  const text = trimText(decodeStringSafe(value));
  if (!text) return false;
  return /[{}]|\$\{|%%/.test(text) || /^(unknown|null|undefined|n\/a)$/i.test(text);
}

function normalizeResolvedTrackingValue(value) {
  const decoded = trimText(decodeStringSafe(value));
  return decoded && !isUnresolvedMacroValue(decoded) ? decoded : '';
}

function parseBasisClickInvalid(value) {
  const normalized = normalizeResolvedTrackingValue(value).toLowerCase();
  if (!normalized) return null;
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') return 1;
  if (normalized === '0' || normalized === 'false' || normalized === 'no') return 0;
  return null;
}

function isPrefetchRequest(req) {
  const purpose = readHeader(req, 'purpose').toLowerCase();
  const secPurpose = readHeader(req, 'sec-purpose').toLowerCase();
  const xMoz = readHeader(req, 'x-moz').toLowerCase();
  return purpose === 'prefetch' || secPurpose.includes('prefetch') || xMoz === 'prefetch';
}

function classifyFilteredClick(req, url) {
  const userAgent = readHeader(req, 'user-agent');
  const clickInvalid = parseBasisClickInvalid(url.searchParams.get('click_invalid') || url.searchParams.get('clickInvalid') || '');
  if (clickInvalid === 1) return { filtered: true, reason: 'basis_invalid', userAgent, clickInvalid };
  if (isPrefetchRequest(req)) return { filtered: true, reason: 'prefetch', userAgent, clickInvalid };
  if (BOT_UA_REGEX.test(userAgent)) return { filtered: true, reason: 'bot', userAgent, clickInvalid };
  return { filtered: false, reason: '', userAgent, clickInvalid };
}

function logFilteredClick({ requestId, tagId, method, reason, userAgent }) {
  logInfo({
    service: 'smx-tracker',
    event: 'click_filtered',
    requestId,
    tagId,
    method,
    reason,
    userAgent,
  });
}

function extractBasisMacroContext(p) {
  const domain = normalizeResolvedTrackingValue(p.get('domain') || p.get('dom') || p.get('sdmn') || '');
  return {
    auctionId: normalizeResolvedTrackingValue(
      p.get('auction_id') || p.get('auctionId') || p.get('auctionid') || p.get('postbackId') || '',
    ) || null,
    basisTs: normalizeResolvedTrackingValue(p.get('basis_ts') || p.get('ts') || p.get('cb') || p.get('tmp') || '') || null,
    clickInvalid: parseBasisClickInvalid(p.get('click_invalid') || p.get('clickInvalid') || ''),
    trafficType: normalizeResolvedTrackingValue(p.get('traffic_type') || p.get('trftype') || '') || null,
    creativeType: normalizeResolvedTrackingValue(p.get('creative_type') || p.get('cretye') || '') || null,
    dimensions: normalizeResolvedTrackingValue(p.get('dimensions') || p.get('cresze') || '') || null,
    ifa: normalizeResolvedTrackingValue(p.get('ifa') || p.get('idfa') || p.get('gadvid') || p.get('googleAdvertisingId') || '') || null,
    basisCampaignId: normalizeResolvedTrackingValue(p.get('basis_campaign_id') || p.get('cmpid') || p.get('campaignId') || '') || null,
    basisAdId: normalizeResolvedTrackingValue(p.get('basis_ad_id') || p.get('adid') || p.get('adId') || '') || null,
    sourceSiteId: normalizeResolvedTrackingValue(p.get('source_site_id') || p.get('sourceSiteId') || p.get('sid') || p.get('siteid') || '') || null,
    domain: domain || null,
  };
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

export function extractTrackingContext(req, url, geo) {
  const p = url.searchParams;
  const pageUrl = normalizeResolvedTrackingValue(
    p.get('purl') || p.get('pu') || p.get('pageUrlEnc') || p.get('site') || '',
  );
  const domain = normalizeResolvedTrackingValue(
    p.get('dom') || p.get('sd') || p.get('domain') ||
    p.get('sdmn') || p.get('siteid') || p.get('inventoryUnitReportingName') || '',
  );
  const headerReferer = trimText(req.headers.referer || req.headers.referrer || '');
  const siteDomain = normalizeResolvedTrackingValue(
    domain
      ? extractHostname(domain)
      : pageUrl
        ? extractHostname(pageUrl)
        : extractHostname(headerReferer),
  );

  const referer = pageUrl || headerReferer || null;

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

const CLICK_APP_COLUMNS_CHECK_TTL_MS = 60_000;
let clickAppColumnsReady = false;
let clickAppColumnsCheckedAt = 0;
const CLICK_TRACKING_COLUMNS_CHECK_TTL_MS = 60_000;
let clickTrackingColumnsReady = false;
let clickTrackingColumnsCheckedAt = 0;

async function hasClickAppColumns(pool) {
  if (clickAppColumnsReady) return true;
  const now = Date.now();
  if (clickAppColumnsCheckedAt && now - clickAppColumnsCheckedAt < CLICK_APP_COLUMNS_CHECK_TTL_MS) return false;
  clickAppColumnsCheckedAt = now;
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'click_events'
         AND column_name IN ('app_id', 'app_bundle', 'app_name')`,
    );
    clickAppColumnsReady = Number(rows[0]?.count ?? 0) === 3;
    return clickAppColumnsReady;
  } catch (_) {
    return false;
  }
}

async function hasClickTrackingColumns(pool) {
  if (clickTrackingColumnsReady) return true;
  const now = Date.now();
  if (clickTrackingColumnsCheckedAt && now - clickTrackingColumnsCheckedAt < CLICK_TRACKING_COLUMNS_CHECK_TTL_MS) return false;
  clickTrackingColumnsCheckedAt = now;
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'click_events'
         AND column_name IN (
           'request_method',
           'raw_click_url',
           'auction_id',
           'basis_ts',
           'click_invalid',
           'traffic_type',
           'creative_type',
           'dimensions',
           'ifa',
           'basis_campaign_id',
           'basis_ad_id',
           'source_site_id',
           'domain',
           'is_filtered',
           'filter_reason'
         )`,
    );
    clickTrackingColumnsReady = Number(rows[0]?.count ?? 0) === 15;
    return clickTrackingColumnsReady;
  } catch (_) {
    return false;
  }
}

async function resolveRecentAppContextForClick(pool, {
  tagId,
  workspaceId,
  deviceId,
  ip,
}) {
  if (!pool || !tagId || !workspaceId || (!deviceId && !ip)) {
    return { appId: null, appBundle: null, appName: null };
  }

  const params = [workspaceId, tagId];
  const identityConditions = [];
  if (deviceId) {
    params.push(deviceId);
    identityConditions.push(`ie.device_id = $${params.length}`);
  }
  if (ip) {
    params.push(ip);
    identityConditions.push(`ie.ip = $${params.length}::inet`);
  }
  if (!identityConditions.length) return { appId: null, appBundle: null, appName: null };

  const { rows } = await pool.query(
    `SELECT ie.app_id, ie.app_bundle, ie.app_name
     FROM impression_events ie
     WHERE ie.workspace_id = $1
       AND ie.tag_id = $2
       AND ie.timestamp >= NOW() - INTERVAL '24 hours'
       AND (${identityConditions.join(' OR ')})
       AND (
         COALESCE(ie.app_name, '') <> ''
         OR COALESCE(ie.app_bundle, '') <> ''
         OR COALESCE(ie.app_id, '') <> ''
       )
     ORDER BY ie.timestamp DESC
     LIMIT 1`,
    params,
  );

  return {
    appId: rows[0]?.app_id ?? null,
    appBundle: rows[0]?.app_bundle ?? null,
    appName: rows[0]?.app_name ?? null,
  };
}

function queueClickEventWrite(pool, {
  tagId,
  workspaceId,
  creativeId,
  creativeSizeVariantId,
  deviceId,
  ip,
  userAgent,
  country,
  region,
  city,
  siteDomain,
  referer,
    appId,
    appBundle,
    appName,
    ipFingerprint,
    requestMethod,
    rawClickUrl,
    auctionId,
    basisTs,
    clickInvalid,
    trafficType,
    creativeType,
    dimensions,
    ifa,
    basisCampaignId,
    basisAdId,
    sourceSiteId,
    domain,
    isFiltered,
    filterReason,
  }) {
    if (!pool || !tagId || !workspaceId) return;
    (async () => {
      const supportsAppContext = await hasClickAppColumns(pool);
      const supportsClickTracking = await hasClickTrackingColumns(pool);
      let resolvedAppId = appId || null;
    let resolvedAppBundle = appBundle || null;
    let resolvedAppName = appName || null;

    if (supportsAppContext && !resolvedAppId && !resolvedAppBundle && !resolvedAppName) {
      const recentAppContext = await resolveRecentAppContextForClick(pool, {
        tagId,
        workspaceId,
        deviceId,
        ip,
      });
      resolvedAppId = recentAppContext.appId || null;
      resolvedAppBundle = recentAppContext.appBundle || null;
      resolvedAppName = recentAppContext.appName || null;
    }

    const columns = [
      'tag_id', 'workspace_id', 'creative_id', 'creative_size_variant_id', 'device_id', 'ip',
      'user_agent', 'country', 'region', 'city', 'site_domain', 'referer', 'ip_fingerprint',
    ];
    const values = [
      tagId, workspaceId, creativeId || null, creativeSizeVariantId || null, deviceId || null, ip || null,
      userAgent || null, country || null, region || null, city || null, siteDomain || null, referer || null,
      ipFingerprint || null,
    ];

      if (supportsAppContext) {
        columns.push('app_id', 'app_bundle', 'app_name');
        values.push(resolvedAppId, resolvedAppBundle, resolvedAppName);
      }

      if (supportsClickTracking) {
        columns.push(
          'request_method',
          'raw_click_url',
          'auction_id',
          'basis_ts',
          'click_invalid',
          'traffic_type',
          'creative_type',
          'dimensions',
          'ifa',
          'basis_campaign_id',
          'basis_ad_id',
          'source_site_id',
          'domain',
          'is_filtered',
          'filter_reason',
        );
        values.push(
          requestMethod || null,
          rawClickUrl || null,
          auctionId || null,
          basisTs || null,
          clickInvalid !== null && clickInvalid !== undefined ? clickInvalid : null,
          trafficType || null,
          creativeType || null,
          dimensions || null,
          ifa || null,
          basisCampaignId || null,
          basisAdId || null,
          sourceSiteId || null,
          domain || null,
          Boolean(isFiltered),
          filterReason || null,
        );
      }

    const placeholders = values.map((_, index) => {
      const ordinal = index + 1;
      return columns[index] === 'ip' ? `$${ordinal}::inet` : `$${ordinal}`;
    });

    await pool.query(
      `INSERT INTO click_events (${columns.join(', ')})
       VALUES (${placeholders.join(', ')})`,
      values,
    );
  })().catch((err) => logWarn({
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
          const appId = normalizeResolvedTrackingValue(
            p.get('appid') || p.get('appId') || p.get('app_id') || p.get('app') || '',
          ) || null;
          const appBundle = normalizeResolvedTrackingValue(
            p.get('appb') || p.get('appBundle') || p.get('app_bundle') || p.get('bundle') || p.get('bundleid') || '',
          ) || null;
          const appName = decodeStringSafe(
            p.get('appn') || p.get('appne') || p.get('appName') || p.get('app_name') || '',
          ) || null;
          const exchangeId = normalizeResolvedTrackingValue(p.get('excid') || '') || null;
          const exchangePublisherId = normalizeResolvedTrackingValue(p.get('excpubid') || '') || null;
          const exchangeSiteIdOrDomain = normalizeResolvedTrackingValue(p.get('excsiddmn') || '') || null;
          const sourcePublisherId = normalizeResolvedTrackingValue(p.get('srcpubid') || '') || null;
          const networkId = normalizeResolvedTrackingValue(p.get('nid') || '') || null;
          const siteId = normalizeResolvedTrackingValue(p.get('siteid') || '') || null;
          const pagePosition = normalizeResolvedTrackingValue(p.get('ppos') || p.get('pos') || p.get('position') || '') || null;
          const contentLanguage = trimText(p.get('lang') || p.get('contentlang') || '') || null;
          const contentTitle = decodeStringSafe(p.get('title') || p.get('contenttitle') || '') || null;
          const contentSeries = decodeStringSafe(p.get('series') || p.get('contentseries') || '') || null;
          const carrier = normalizeResolvedTrackingValue(p.get('carrier') || p.get('isp') || '') || null;
          const appStoreName = normalizeResolvedTrackingValue(p.get('appstore') || p.get('store') || '') || null;
          const contentGenre = decodeStringSafe(p.get('genre') || p.get('contentgenre') || '') || null;
          const creativeId = trimText(p.get('smx_creative_id') || p.get('creative_id') || '') || null;
          const creativeSizeVariantId = trimText(p.get('smx_variant_id') || p.get('variant_id') || '') || null;
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
            const connectionType = normalizeResolvedTrackingValue(p.get('sf_conn_type') || p.get('connectiontype') || p.get('connection') || '') || null;
            const effectiveConnectionType = normalizeResolvedTrackingValue(p.get('sf_conn_effective') || p.get('effectiveconnectiontype') || '') || null;
            const connectionDownlink = p.get('sf_conn_downlink') ? Number(p.get('sf_conn_downlink')) || null : null;
            const connectionRtt = p.get('sf_conn_rtt') ? Number.parseInt(p.get('sf_conn_rtt'), 10) || null : null;
            const connectionSaveData = p.get('sf_conn_save_data') === '1' ? true : p.get('sf_conn_save_data') === '0' ? false : null;
            const basisMacroContext = extractBasisMacroContext(p);

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
            connectionType || effectiveConnectionType || connectionDownlink !== null || connectionRtt !== null || connectionSaveData !== null ||
            inferredContext !== 'unknown'
            ) {
            queueImpressionEventWrite(pool, {
              tagId,
              workspaceId,
              creativeId,
              creativeSizeVariantId,
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
                connectionType,
                effectiveConnectionType,
                connectionDownlink,
                connectionRtt,
                connectionSaveData,
                ...basisMacroContext,
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

        const clickFilter = classifyFilteredClick(req, url);
        if (clickFilter.filtered) {
          logFilteredClick({ requestId, tagId, method, reason: clickFilter.reason, userAgent: clickFilter.userAgent });
          return true;
        }

        queueClickWrite(buffer, pool, tagId, requestId);
        if (pool) {
          const geo = resolveGeoContext(req, url);
          const trackingContext = extractTrackingContext(req, url, geo);
          const basisMacroContext = extractBasisMacroContext(url.searchParams);
          const creativeId = trimText(url.searchParams.get('smx_creative_id') || url.searchParams.get('creative_id') || '') || null;
        const creativeSizeVariantId = trimText(url.searchParams.get('smx_variant_id') || url.searchParams.get('variant_id') || '') || null;
        const appId = normalizeResolvedTrackingValue(
          url.searchParams.get('appid') || url.searchParams.get('appId') || url.searchParams.get('app_id') || url.searchParams.get('app') || '',
        ) || null;
        const appBundle = normalizeResolvedTrackingValue(
          url.searchParams.get('appb') || url.searchParams.get('appBundle') || url.searchParams.get('app_bundle') || url.searchParams.get('bundle') || url.searchParams.get('bundleid') || '',
        ) || null;
        const appName = normalizeResolvedTrackingValue(
          url.searchParams.get('appn') || url.searchParams.get('appne') || url.searchParams.get('appName') || url.searchParams.get('app_name') || '',
        ) || null;
        resolveTagWorkspaceId(pool, tagId).then((workspaceId) => {
          if (!workspaceId) return;
          queueClickEventWrite(pool, {
            tagId,
            workspaceId,
            creativeId,
            creativeSizeVariantId,
            deviceId,
            ip: trackingContext.remoteIp,
            userAgent: trackingContext.userAgent,
            country: trackingContext.country,
            region: trackingContext.region,
            city: trackingContext.city,
            siteDomain: trackingContext.siteDomain,
            referer: trackingContext.referer,
              appId,
              appBundle,
              appName,
              ipFingerprint: hashIp(trackingContext.remoteIp, env?.sessionSecret),
              requestMethod: method,
              rawClickUrl: trimText(url.searchParams.get('url') || '') || null,
              ...basisMacroContext,
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

        const clickFilter = classifyFilteredClick(req, url);
        if (clickFilter.filtered) {
          logFilteredClick({ requestId, tagId, method, reason: clickFilter.reason, userAgent: clickFilter.userAgent });
          return true;
        }

        queueClickWrite(buffer, pool, tagId, requestId);
        if (pool) {
          const geo = resolveGeoContext(req, url);
          const trackingContext = extractTrackingContext(req, url, geo);
          const basisMacroContext = extractBasisMacroContext(url.searchParams);
          const creativeId = trimText(url.searchParams.get('smx_creative_id') || url.searchParams.get('creative_id') || '') || null;
        const creativeSizeVariantId = trimText(url.searchParams.get('smx_variant_id') || url.searchParams.get('variant_id') || '') || null;
        const appId = normalizeResolvedTrackingValue(
          url.searchParams.get('appid') || url.searchParams.get('appId') || url.searchParams.get('app_id') || url.searchParams.get('app') || '',
        ) || null;
        const appBundle = normalizeResolvedTrackingValue(
          url.searchParams.get('appb') || url.searchParams.get('appBundle') || url.searchParams.get('app_bundle') || url.searchParams.get('bundle') || url.searchParams.get('bundleid') || '',
        ) || null;
        const appName = normalizeResolvedTrackingValue(
          url.searchParams.get('appn') || url.searchParams.get('appne') || url.searchParams.get('appName') || url.searchParams.get('app_name') || '',
        ) || null;
        resolveTagWorkspaceId(pool, tagId).then((workspaceId) => {
          if (!workspaceId) return;
          queueClickEventWrite(pool, {
            tagId,
            workspaceId,
            creativeId,
            creativeSizeVariantId,
            deviceId,
            ip: trackingContext.remoteIp,
            userAgent: trackingContext.userAgent,
            country: trackingContext.country,
            region: trackingContext.region,
            city: trackingContext.city,
            siteDomain: trackingContext.siteDomain,
            referer: trackingContext.referer,
              appId,
              appBundle,
              appName,
              ipFingerprint: hashIp(trackingContext.remoteIp, env?.sessionSecret),
              requestMethod: method,
              rawClickUrl: destination,
              ...basisMacroContext,
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
