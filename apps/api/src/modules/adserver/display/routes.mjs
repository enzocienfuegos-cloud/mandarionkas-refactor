import { getPool } from '@smx/db/src/pool.mjs';
import geoip from 'geoip-lite';
import { inferContext } from '@smx/db/src/context-classifier.mjs';
import { recordImpression } from '@smx/db/src/tracking.mjs';
import { parseBrowserFromUA, parseDeviceTypeFromUA, parseOsFromUA } from '@smx/db/src/ua-parser.mjs';
import { recordFrequencyCapImpression } from '@smx/db/src/frequency-cap.mjs';
import { resolveActiveCreativeForTag as resolveActiveCreativeForTagRows } from '@smx/db/src/tags.mjs';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { wrapTrackedClickUrlWithDspMacro } from '../../../../../../packages/contracts/src/dsp-macros.mjs';
import { sanitizeClickTagRuntimeInHtml } from '../../../../../../packages/contracts/src/html5-detector.mjs';
import { resolveDeviceId } from '../../../lib/device-id.mjs';
import { hashIp } from '../../../lib/ip-fingerprint.mjs';
import { logWarn } from '../../../lib/logger.mjs';
import { queueImpressionEventWrite, resolveTagWorkspaceId } from '../tracker/service.mjs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const R2_REGION = 'auto';
let cachedR2Client = null;
let cachedR2Key = '';

function trimText(value) {
  return String(value ?? '').trim();
}

function decodeStringSafe(value) {
  if (!value) return '';
  try { return decodeURIComponent(String(value)); } catch (_) { return String(value); }
}

function readHeader(req, name) {
  const value = req?.headers?.[name];
  return Array.isArray(value) ? trimText(value[0] || '') : trimText(value || '');
}

function trimQuotedHeader(value) {
  return trimText(value).replace(/^"+|"+$/g, '');
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

function extractTrackingContext(req, url, geo) {
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

function isValidTagId(id) {
  return UUID_RE.test(String(id ?? ''));
}

function escapeScriptContext(jsonStr) {
  return jsonStr.replace(/<\//g, '<\\/');
}

const RUNTIME_TRACKING_CONTEXT_JS = `
  function smxIsUnresolvedMacroValue(value) {
    var text = String(value || '').trim();
    return !text || /[{}]|\\$\\{|%%/.test(text) || /^(unknown|null|undefined|n\\/a)$/i.test(text);
  }
  function smxReadPageUrl() {
    try {
      if (window.top && window.top.location && window.top.location.href) return window.top.location.href;
    } catch(_) {}
    return document.referrer || window.location.href || '';
  }
  function smxReadDomain(pageUrl) {
    try { return new URL(pageUrl).hostname; } catch(_) {}
    try { return new URL(document.referrer).hostname; } catch(_) {}
    return '';
  }
  function smxShouldContextualizeUrl(rawUrl) {
    var text = String(rawUrl || '');
    if (!text) return false;
    if (text.indexOf('/v1/tags/tracker/') !== -1) return true;
    try { if (decodeURIComponent(text).indexOf('/v1/tags/tracker/') !== -1) return true; } catch(_) {}
    return /[?&](dom|domain|sd|sdmn|purl|pu|pageUrlEnc|site)=/i.test(text);
  }
  function smxWithRuntimeContext(rawUrl) {
    if (!smxShouldContextualizeUrl(rawUrl)) return rawUrl;
    try {
      var url = new URL(rawUrl, window.location.href);
      var pageUrl = smxReadPageUrl();
      var domain = smxReadDomain(pageUrl);
      var domainKeys = ['dom', 'domain', 'sd', 'sdmn'];
      var pageKeys = ['purl', 'pu', 'pageUrlEnc', 'site'];
      var hasDomainKey = false;
      var hasPageKey = false;
      domainKeys.forEach(function(key) {
        if (!url.searchParams.has(key)) return;
        hasDomainKey = true;
        if (domain && smxIsUnresolvedMacroValue(url.searchParams.get(key))) url.searchParams.set(key, domain);
      });
      pageKeys.forEach(function(key) {
        if (!url.searchParams.has(key)) return;
        hasPageKey = true;
        if (pageUrl && smxIsUnresolvedMacroValue(url.searchParams.get(key))) url.searchParams.set(key, pageUrl);
      });
      if (domain && !hasDomainKey) url.searchParams.set('dom', domain);
      if (pageUrl && !hasPageKey) url.searchParams.set('purl', pageUrl);
      return url.toString();
    } catch(_) {
      return rawUrl;
    }
  }
  function smxAppendQuery(rawUrl, key, value) {
    try {
      var url = new URL(rawUrl, window.location.href);
      url.searchParams.set(key, value);
      return url.toString();
    } catch(_) {
      return rawUrl + (String(rawUrl).indexOf('?') === -1 ? '?' : '&') + encodeURIComponent(key) + '=' + encodeURIComponent(value);
    }
  }
`;

function resolveBaseUrl(ctx) {
  const explicit = trimText(ctx.env.apiBaseUrl || ctx.env.apiPublicBaseUrl || ctx.env.baseUrl);
  if (explicit) return explicit.replace(/\/+$/, '');
  const protocol = trimText(ctx.req.headers['x-forwarded-proto']) || 'https';
  const host = trimText(ctx.req.headers['x-forwarded-host'] || ctx.req.headers.host);
  return host ? `${protocol}://${host}` : 'https://localhost';
}

function getDatabasePool(env) {
  const cs = trimText(env.databasePoolUrl || env.databaseUrl);
  return cs ? getPool(cs) : null;
}

function queueDisplayFirstHopImpression(ctx, pool, tagId, row) {
  const { req, res, url, env, requestId } = ctx;
  if (!pool || !tagId || !row || url.searchParams.get('smx_no_imp') === '1') return null;

  const { deviceId, cookie } = resolveDeviceId(req, env);
  if (cookie) res.setHeader('Set-Cookie', cookie);

  (async () => {
    await recordImpression(pool, tagId);

    const workspaceId = await resolveTagWorkspaceId(pool, tagId);
    if (!workspaceId) return;

    if (deviceId) {
      recordFrequencyCapImpression(pool, { tagId, deviceId, workspaceId })
        .catch((err) => logWarn({
          service: 'smx-display-first-hop',
          fn: 'recordFrequencyCapImpression',
          tagId,
          requestId,
          message: err?.message,
        }));
    }

    const p = url.searchParams;
    const geo = resolveGeoContext(req, url);
    const trackingContext = extractTrackingContext(req, url, geo);
    const country = trackingContext.country;
    const region = trackingContext.region;
    const city = trackingContext.city;
    const userAgent = trackingContext.userAgent;
    const remoteIp = trackingContext.remoteIp;

    const deviceTypeSignal = trimText(p.get('devicetype') || p.get('device') || p.get('dtyp') || '').toLowerCase() || null;
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
    const appName = normalizeResolvedTrackingValue(
      p.get('appn') || p.get('appne') || p.get('appName') || p.get('app_name') || '',
    ) || null;
    const exchangeId = normalizeResolvedTrackingValue(p.get('excid') || '') || null;
    const exchangePublisherId = normalizeResolvedTrackingValue(p.get('excpubid') || '') || null;
    const exchangeSiteIdOrDomain = normalizeResolvedTrackingValue(p.get('excsiddmn') || '') || null;
    const sourcePublisherId = normalizeResolvedTrackingValue(p.get('srcpubid') || '') || null;
    const networkId = normalizeResolvedTrackingValue(p.get('nid') || p.get('netid') || '') || null;
    const siteId = normalizeResolvedTrackingValue(p.get('siteid') || p.get('sid') || '') || null;
    const pagePosition = normalizeResolvedTrackingValue(p.get('ppos') || p.get('pos') || p.get('position') || '') || null;
    const contentLanguage = trimText(p.get('lang') || p.get('contentlang') || p.get('cntlang') || '') || null;
    const contentTitle = decodeStringSafe(p.get('title') || p.get('contenttitle') || p.get('cnttitle') || '') || null;
    const contentSeries = decodeStringSafe(p.get('series') || p.get('contentseries') || p.get('cntseries') || '') || null;
    const carrier = normalizeResolvedTrackingValue(p.get('carrier') || p.get('carr') || p.get('isp') || '') || null;
    const appStoreName = normalizeResolvedTrackingValue(p.get('appstore') || p.get('appstnm') || p.get('store') || '') || null;
    const contentGenre = decodeStringSafe(p.get('genre') || p.get('contentgenre') || p.get('cngen') || '') || null;
    const creativeId = trimText(row.creative_id || p.get('smx_creative_id') || p.get('creative_id') || '') || null;
    const creativeSizeVariantId = trimText(row.creative_size_variant_id || p.get('smx_variant_id') || p.get('variant_id') || '') || null;
    const contextualIds = trimText(
      p.get('ctxid') || p.get('ctxids') || p.get('contextualid') || p.get('contextualids') || '',
    ) || null;
    const browser = trimQuotedHeader(req.headers['sec-ch-ua'] || '') || parseBrowserFromUA(userAgent);
    const os = trimQuotedHeader(req.headers['sec-ch-ua-platform'] || '') || parseOsFromUA(userAgent);
    const deviceType = deviceTypeSignal || parseDeviceTypeFromUA(userAgent);
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

    const inferredContext = await inferContext(pool, {
      siteDomain: trackingContext.siteDomain,
      referer: trackingContext.referer,
      appBundle,
      appName,
      contentGenre,
    }).catch(() => 'unknown');

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
      inferredContext: inferredContext || 'unknown',
    });
  })().catch((err) => logWarn({
    service: 'smx-display-first-hop',
    fn: 'queueDisplayFirstHopImpression',
    tagId,
    requestId,
    message: err?.message,
  }));

  return cookie;
}

function trimBaseUrl(value) {
  return trimText(value).replace(/\/+$/, '');
}

function isValidAbsoluteUrl(value) {
  const normalized = trimText(value);
  if (!normalized) return false;
  try {
    const url = new URL(normalized);
    return Boolean(url.protocol && url.host);
  } catch {
    return false;
  }
}

function isR2Ready(env) {
  return Boolean(
    isValidAbsoluteUrl(env.r2Endpoint)
    && env.r2Bucket
    && env.r2AccessKeyId
    && env.r2SecretAccessKey,
  );
}

function getR2Client(env) {
  if (!isValidAbsoluteUrl(env.r2Endpoint)) {
    throw new Error('R2_ENDPOINT must be a valid absolute URL.');
  }
  const cacheKey = `${env.r2Endpoint}|${env.r2AccessKeyId}|${env.r2Bucket}`;
  if (cachedR2Client && cachedR2Key === cacheKey) return cachedR2Client;
  cachedR2Client = new S3Client({
    region: R2_REGION,
    endpoint: env.r2Endpoint,
    credentials: {
      accessKeyId: env.r2AccessKeyId,
      secretAccessKey: env.r2SecretAccessKey,
    },
  });
  cachedR2Key = cacheKey;
  return cachedR2Client;
}

function decodeUriComponentSafe(value) {
  try {
    return decodeURIComponent(String(value ?? ''));
  } catch {
    return String(value ?? '');
  }
}

function normalizeCreativeAssetPath(rawPath) {
  const trimmed = decodeUriComponentSafe(rawPath).trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!trimmed) return null;
  if (trimmed.split('/').some((segment) => !segment || segment === '.' || segment === '..')) return null;
  return trimmed;
}

function encodePathSegments(pathname) {
  return String(pathname ?? '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function guessCreativeAssetContentType(filename) {
  const ext = String(filename || '').toLowerCase().split('.').pop();
  const map = {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    mjs: 'application/javascript; charset=utf-8',
    css: 'text/css; charset=utf-8',
    json: 'application/json; charset=utf-8',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
    txt: 'text/plain; charset=utf-8',
    zip: 'application/zip',
  };
  return map[ext] || 'application/octet-stream';
}

function normalizeServedHtml5AssetBody(body, assetPath) {
  const normalizedPath = trimText(assetPath).toLowerCase();
  if (!normalizedPath.endsWith('.html') && !normalizedPath.endsWith('.htm')) return body;
  const source = Buffer.isBuffer(body) ? body.toString('utf-8') : String(body ?? '');
  const sanitized = sanitizeClickTagRuntimeInHtml(source);
  return sanitized.replaced ? Buffer.from(sanitized.html, 'utf-8') : body;
}

function getCreativeEntryAssetPath(row) {
  const explicit = normalizeCreativeAssetPath(row?.entry_path);
  if (explicit) return explicit;
  const publicUrl = trimText(row?.public_url);
  if (!publicUrl) return null;
  try {
    const url = new URL(publicUrl);
    const pathname = decodeUriComponentSafe(url.pathname || '');
    const filename = pathname.split('/').pop() || '';
    return normalizeCreativeAssetPath(filename);
  } catch {
    const filename = publicUrl.split('/').pop() || '';
    return normalizeCreativeAssetPath(filename);
  }
}

function inferStorageKeyFromCreativeUrl(env, publicUrl) {
  const normalizedUrl = trimText(publicUrl);
  if (!normalizedUrl) return null;
  const publicBase = trimBaseUrl(env.assetsPublicBaseUrl || env.r2PublicBaseUrl);
  if (publicBase && normalizedUrl.startsWith(`${publicBase}/`)) {
    return normalizedUrl.slice(publicBase.length + 1) || null;
  }
  try {
    const url = new URL(normalizedUrl);
    const pathname = normalizeCreativeAssetPath(url.pathname);
    if (pathname && pathname.startsWith('workspaces/')) return pathname;
  } catch {
    return null;
  }
  return null;
}

export function resolveCreativeAssetStorageKey(env, row, requestedAssetPath) {
  const entryStorageKey = normalizeCreativeAssetPath(inferStorageKeyFromCreativeUrl(env, row?.public_url));
  if (!entryStorageKey) return null;
  const targetAssetPath = normalizeCreativeAssetPath(requestedAssetPath) || getCreativeEntryAssetPath(row);
  if (!targetAssetPath) return entryStorageKey;
  const entryAssetPath = getCreativeEntryAssetPath(row);
  if (entryAssetPath && entryStorageKey.endsWith(entryAssetPath)) {
    const storagePrefix = entryStorageKey.slice(0, entryStorageKey.length - entryAssetPath.length).replace(/\/+$/, '');
    return storagePrefix ? `${storagePrefix}/${targetAssetPath}` : targetAssetPath;
  }
  const slashIndex = entryStorageKey.lastIndexOf('/');
  return slashIndex === -1
    ? targetAssetPath
    : `${entryStorageKey.slice(0, slashIndex)}/${targetAssetPath}`;
}

function isSeedDemoCreative(row) {
  const publicUrl = trimText(row?.public_url).toLowerCase();
  return publicUrl.includes('/demo/creatives/bocadeli-spring/index.html');
}

function buildSeedDemoCreativeHtml({
  width,
  height,
  clickTag,
}) {
  const w = Number(width) || 300;
  const h = Number(height) || 250;
  const safeClickTag = trimText(clickTag);
  const safeClickTagJs = safeClickTag ? escapeScriptContext(JSON.stringify(safeClickTag)) : 'null';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="ad.size" content="width=${w},height=${h}">
<style>
*{box-sizing:border-box}
html,body{margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden;font-family:Inter,system-ui,sans-serif;background:#fff9ec;color:#172033}
button{all:unset;cursor:pointer;display:block;width:100%;height:100%}
.card{position:relative;display:flex;flex-direction:column;justify-content:space-between;width:100%;height:100%;padding:18px;border:1px solid rgba(23,32,51,.08);background:
radial-gradient(circle at top right, rgba(255,196,80,.45), transparent 42%),
linear-gradient(135deg, #fff3d3 0%, #ffffff 54%, #f6fbff 100%)}
.eyebrow{font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#d2591f;font-weight:700}
.headline{max-width:170px;font-size:28px;line-height:.94;font-weight:800}
.sub{max-width:185px;font-size:12px;line-height:1.4;color:#48536a}
.cta{align-self:flex-start;padding:8px 12px;border-radius:999px;background:#172033;color:#fff;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.accent{position:absolute;right:-18px;bottom:-18px;width:120px;height:120px;border-radius:999px;background:linear-gradient(135deg,#ffcc4d,#ff7a18);opacity:.92}
.chip{position:absolute;right:16px;top:16px;padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.82);font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
</style>
</head>
<body>
<button id="smx-demo-creative" type="button" aria-label="Open advertiser landing page">
  <div class="card">
    <div>
      <div class="eyebrow">Dusk Demo</div>
      <div class="headline">Bocadeli Spring</div>
    </div>
    <div>
      <div class="sub">Fallback creative served by the ad server while CDN DNS is unavailable.</div>
      <div class="cta">Learn more</div>
    </div>
    <div class="chip">HTML5</div>
    <div class="accent" aria-hidden="true"></div>
  </div>
</button>
<script>
(function(){
  var clickTag = ${safeClickTagJs};
  function resolveClickTag(nextUrl) {
    if (typeof nextUrl === 'string' && nextUrl) clickTag = nextUrl;
  }
  var qs = new URLSearchParams(window.location.search);
  resolveClickTag(qs.get('clickTag'));
  window.addEventListener('message', function(event) {
    try {
      var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data && data.type === 'smx:init') resolveClickTag(data.clickTag);
    } catch (_) {}
  });
  var target = document.getElementById('smx-demo-creative');
  if (!target) return;
  target.addEventListener('click', function() {
    if (!clickTag) return;
    try {
      parent.postMessage(JSON.stringify({ type: 'smx:exit', url: clickTag }), '*');
    } catch (_) {
      window.location.href = clickTag;
    }
  });
})();
</script>
</body>
</html>`;
}

export function buildCreativeAssetProxyUrl(baseUrl, tagId, row) {
  const entryAssetPath = getCreativeEntryAssetPath(row);
  if (!trimText(baseUrl) || !trimText(tagId) || !trimText(row?.binding_id) || !entryAssetPath) {
    return trimText(row?.public_url);
  }
  return `${baseUrl}/v1/tags/display/${tagId}/bindings/${row.binding_id}/${encodePathSegments(entryAssetPath)}`;
}

async function readR2ObjectBuffer(env, storageKey) {
  const response = await getR2Client(env).send(new GetObjectCommand({
    Bucket: env.r2Bucket,
    Key: storageKey,
  }));
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function fetchCreativeAssetByUrl(row, requestedAssetPath) {
  const publicUrl = trimText(row?.public_url);
  if (!publicUrl) return null;
  const entryAssetPath = getCreativeEntryAssetPath(row);
  const normalizedRequestedPath = normalizeCreativeAssetPath(requestedAssetPath) || entryAssetPath;
  if (!normalizedRequestedPath) return null;
  try {
    const assetUrl = (!entryAssetPath || normalizedRequestedPath.toLowerCase() === entryAssetPath.toLowerCase())
      ? publicUrl
      : new URL(normalizedRequestedPath, publicUrl).toString();
    const response = await fetch(assetUrl);
    if (!response.ok) return null;
    const body = Buffer.from(await response.arrayBuffer());
    const contentType = trimText(response.headers.get('content-type')) || guessCreativeAssetContentType(normalizedRequestedPath);
    return { body, contentType };
  } catch {
    return null;
  }
}

function applyPublicCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.removeHeader('Access-Control-Allow-Credentials');
  res.removeHeader('Vary');
}

function sendHtml(res, html, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Content-Security-Policy', "frame-ancestors *");
  res.removeHeader('X-Frame-Options');
  res.end(html);
  return true;
}

function sendJs(res, js, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.end(js);
  return true;
}

function sendAsset(res, body, {
  contentType,
  cacheControl,
  status = 200,
} = {}) {
  const resolvedContentType = trimText(contentType) || 'application/octet-stream';
  res.statusCode = status;
  res.setHeader('Content-Type', resolvedContentType);
  res.setHeader(
    'Cache-Control',
    trimText(cacheControl) || (
      resolvedContentType.startsWith('text/html')
        ? 'no-store, no-cache, must-revalidate'
        : 'public, max-age=300'
    ),
  );
  if (resolvedContentType.startsWith('text/html')) {
    res.setHeader('Content-Security-Policy', 'frame-ancestors *');
    res.removeHeader('X-Frame-Options');
  }
  res.end(body);
  return true;
}

export function pickWeightedCreativeRow(rows, random = Math.random) {
  const candidates = (Array.isArray(rows) ? rows : [])
    .filter((row) => trimText(row?.public_url))
    .map((row) => ({
      ...row,
      weight: Math.max(1, Number(row?.weight) || 1),
    }));

  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];

  const totalWeight = candidates.reduce((sum, row) => sum + row.weight, 0);
  let cursor = Math.max(0, Number(random()) || 0) * totalWeight;

  for (const row of candidates) {
    cursor -= row.weight;
    if (cursor < 0) return row;
  }

  return candidates[candidates.length - 1];
}

export function buildDisplayHtml({ creativeUrl, width, height, clickTrackerUrl, engagementTrackerUrl, impressionUrl, clickUrl, clickTag, omidVerification }) {
  const w = Number(width) || 300;
  const h = Number(height) || 250;
  const safeCreativeUrl = trimText(creativeUrl);
  const safeClickTracker = trimText(clickTrackerUrl);
  const safeEngagementTracker = trimText(engagementTrackerUrl);
  const safeImpression = trimText(impressionUrl);
  const safeClickUrl = trimText(clickUrl);

  if (!safeCreativeUrl) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="ad.size" content="width=${w},height=${h}">
<style>*{margin:0;padding:0}html,body{width:${w}px;height:${h}px;overflow:hidden;background:transparent}</style>
</head>
<body>
<!-- SMX: no active creative -->
</body>
</html>`;
  }

  const safeImpressionJs = safeImpression ? escapeScriptContext(JSON.stringify(safeImpression)) : null;
  const safeClickTrackerJs = safeClickTracker ? escapeScriptContext(JSON.stringify(safeClickTracker)) : 'null';
  const trackedClickTag = trimText(clickTag) || (
    safeClickTracker
      ? (safeClickUrl
          ? `${safeClickTracker}?url=${encodeURIComponent(safeClickUrl)}`
          : safeClickTracker)
      : safeClickUrl
  );
  const clickTagBlock = trackedClickTag
    ? `<script>var clickTag=${escapeScriptContext(JSON.stringify(trackedClickTag))};window.clickTag=clickTag;</script>`
    : '';
  const iframeSrc = `${safeCreativeUrl}${trackedClickTag ? `${safeCreativeUrl.includes('?') ? '&' : '?'}clickTag=${encodeURIComponent(trackedClickTag)}` : ''}`;
  const omidBlock = omidVerification?.jsUrl
    ? `<script src="https://staticresources.iab-psl.org/omid/omid-session-client.js" async></script>
<script>
(function(){
  if(typeof OmidSessionClient === 'undefined') return;
  var v = OmidSessionClient.default;
  var ctx = new v.Context(v.PartnerName('${omidVerification.vendor || 'SMX'}'), v.PartnerVersion('1.0'));
  var vRes = ${omidVerification.params ? escapeScriptContext(JSON.stringify(omidVerification.params)) : '{}'};
  ctx.setVerificationResources([{ vendorKey: '${omidVerification.vendor || 'smx'}', verificationParameters: JSON.stringify(vRes), resourceUrl: ${escapeScriptContext(JSON.stringify(omidVerification.jsUrl))} }]);
  new v.AdSession(ctx);
})();
</script>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="ad.size" content="width=${w},height=${h}">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${w}px;height:${h}px;overflow:hidden;background:transparent}
iframe{border:0;display:block;width:100%;height:100%}
</style>
${clickTagBlock}
${omidBlock}
</head>
<body>
<iframe
  id="smx-creative-frame"
  src="${iframeSrc}"
  width="${w}"
  height="${h}"
  scrolling="no"
  frameborder="0"
  marginwidth="0"
  marginheight="0"
  allowfullscreen
  sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-top-navigation-by-user-activation"
></iframe>
<script>
(function(){
  ${RUNTIME_TRACKING_CONTEXT_JS}
  var creativeUrl = ${escapeScriptContext(JSON.stringify(safeCreativeUrl))};
  var impressionUrl = ${safeImpressionJs ?? 'null'};
  var clickTracker = ${safeClickTrackerJs};
  var engagementTracker = ${safeEngagementTracker ? escapeScriptContext(JSON.stringify(safeEngagementTracker)) : 'null'};
  var injectedClickTag = ${trackedClickTag ? escapeScriptContext(JSON.stringify(trackedClickTag)) : 'null'};
  var frame = document.getElementById('smx-creative-frame');
  impressionUrl = smxWithRuntimeContext(impressionUrl);
  clickTracker = smxWithRuntimeContext(clickTracker);
  engagementTracker = smxWithRuntimeContext(engagementTracker);
  injectedClickTag = smxWithRuntimeContext(injectedClickTag);
  if (impressionUrl) (new Image()).src = impressionUrl;
  if (injectedClickTag) window.clickTag = injectedClickTag;
  if (frame && injectedClickTag) {
    var nextFrameSrc = creativeUrl + (creativeUrl.indexOf('?') === -1 ? '?' : '&') + 'clickTag=' + encodeURIComponent(injectedClickTag);
    if (frame.getAttribute('src') !== nextFrameSrc) frame.src = nextFrameSrc;
    frame.addEventListener('load', function() {
      try {
        frame.contentWindow.postMessage(
          JSON.stringify({ type: 'smx:init', clickTag: injectedClickTag }),
          '*'
        );
      } catch(_) {}
    });
  }
  window.addEventListener('message', function(e) {
    try {
      var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (!data || data.type !== 'smx:exit') return;
      var dest = (typeof data.url === 'string' && data.url) ? data.url : '';
      var resolvedClickUrl = dest || injectedClickTag || '';
      var navigateTo = resolvedClickUrl || clickTracker || '';
      var isAlreadyTracked = clickTracker && resolvedClickUrl && resolvedClickUrl.indexOf(clickTracker) === 0;
      if (clickTracker && !isAlreadyTracked) {
        var t = smxAppendQuery(clickTracker, 'url', resolvedClickUrl || clickTracker);
        try {
          fetch(t, { method: 'POST', keepalive: true, mode: 'no-cors', credentials: 'include' });
        } catch(_) {
          (new Image()).src = t;
        }
      }
      if (navigateTo) {
        var opened = null;
        try { opened = window.open(navigateTo, '_blank', 'noopener'); } catch(_) {}
        if (!opened) {
          try { window.top.location.href = navigateTo; } catch(_) { window.location.href = navigateTo; }
        }
      }
    } catch(_) {}
  });

  (function() {
    if (!engagementTracker) return;

    var frame = document.getElementById('smx-creative-frame');
    var viewStart = null;
    var hoverStart = null;
    var flushed = false;

    function sendBeacon(url) {
      try {
        fetch(url, { method: 'GET', keepalive: true, mode: 'no-cors', credentials: 'include' });
      } catch(_) {
        (new Image()).src = url;
      }
    }

    function flushViewSegment() {
      if (!viewStart) return;
      var duration = Date.now() - viewStart;
      viewStart = null;
      if (duration > 0) {
        sendBeacon(smxAppendQuery(smxAppendQuery(engagementTracker, 'event', 'viewable'), 't', Math.round(duration)));
      }
    }

    function flushHoverSegment() {
      if (!hoverStart) return;
      var duration = Date.now() - hoverStart;
      hoverStart = null;
      if (duration > 0) {
        sendBeacon(smxAppendQuery(smxAppendQuery(engagementTracker, 'event', 'hover_end'), 't', Math.round(duration)));
      }
    }

    function flushActiveSegmentsIncrementally() {
      if (flushed) return;
      if (viewStart) {
        var viewDuration = Date.now() - viewStart;
        if (viewDuration > 0) {
          sendBeacon(smxAppendQuery(smxAppendQuery(engagementTracker, 'event', 'viewable'), 't', Math.round(viewDuration)));
          viewStart = Date.now();
        }
      }
      if (hoverStart) {
        var hoverDuration = Date.now() - hoverStart;
        if (hoverDuration > 0) {
          sendBeacon(smxAppendQuery(smxAppendQuery(engagementTracker, 'event', 'hover_end'), 't', Math.round(hoverDuration)));
          hoverStart = Date.now();
        }
      }
    }

    function flush() {
      if (flushed) return;
      flushed = true;
      flushViewSegment();
      flushHoverSegment();
    }

    if (frame && typeof IntersectionObserver !== 'undefined') {
      var isMRC = false;
      var mrcTimer = null;

      var observer = new IntersectionObserver(function(entries) {
        var ratio = entries[0].intersectionRatio;
        if (ratio >= 0.5) {
          if (!isMRC) {
            mrcTimer = setTimeout(function() {
              isMRC = true;
              viewStart = Date.now();
            }, 1000);
          }
        } else {
          clearTimeout(mrcTimer);
          mrcTimer = null;
          if (isMRC) flushViewSegment();
          isMRC = false;
        }
      }, { threshold: [0, 0.5, 1.0] });

      observer.observe(frame);
    }

    if (frame) {
      frame.addEventListener('mouseenter', function() {
        flushed = false;
        hoverStart = Date.now();
      });
      frame.addEventListener('mouseleave', function() {
        flushHoverSegment();
      });
    }

    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    setInterval(flushActiveSegmentsIncrementally, 5000);
  })();
})();
</script>
</body>
</html>`;
}

export function buildDisplayJs({
  creativeUrl,
  impressionUrl,
  clickTrackerUrl,
  engagementTrackerUrl,
  clickTag,
  width,
  height,
}) {
  const w = Number(width) || 300;
  const h = Number(height) || 250;
  const safeCreativeUrl = escapeScriptContext(JSON.stringify(creativeUrl || ''));
  const safeImpression = impressionUrl ? escapeScriptContext(JSON.stringify(impressionUrl)) : 'null';
  const safeClickTracker = clickTrackerUrl ? escapeScriptContext(JSON.stringify(clickTrackerUrl)) : 'null';
  const safeEngagement = engagementTrackerUrl ? escapeScriptContext(JSON.stringify(engagementTrackerUrl)) : 'null';
  const safeClickTag = clickTag ? escapeScriptContext(JSON.stringify(clickTag)) : 'null';

  return `(function(){
  var creativeUrl       = ${safeCreativeUrl};
  var impressionUrl     = ${safeImpression};
  var clickTrackerUrl   = ${safeClickTracker};
  var engagementUrl     = ${safeEngagement};
  var clickTag          = ${safeClickTag};
  var W = '${w}'; var H = '${h}';

  if (!creativeUrl) return;

  ${RUNTIME_TRACKING_CONTEXT_JS}
  impressionUrl = smxWithRuntimeContext(impressionUrl);
  clickTrackerUrl = smxWithRuntimeContext(clickTrackerUrl);
  engagementUrl = smxWithRuntimeContext(engagementUrl);
  clickTag = smxWithRuntimeContext(clickTag);

  var script = document.currentScript;
  if (!script) return;
  var parent = script.parentNode;
  if (!parent) return;

  if (impressionUrl) (new Image()).src = impressionUrl;

  if (clickTag) window.clickTag = clickTag;

  var src = creativeUrl;
  if (clickTag) {
    src = creativeUrl + (creativeUrl.indexOf('?') === -1 ? '?' : '&') + 'clickTag=' + encodeURIComponent(clickTag);
  }

  var iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.width  = W;
  iframe.height = H;
  iframe.scrolling = 'no';
  iframe.frameBorder = '0';
  iframe.marginWidth  = '0';
  iframe.marginHeight = '0';
  iframe.style.border   = '0';
  iframe.style.overflow = 'hidden';
  iframe.style.display  = 'block';
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-top-navigation-by-user-activation');

  if (clickTag) {
    iframe.addEventListener('load', function() {
      try {
        iframe.contentWindow.postMessage(
          JSON.stringify({ type: 'smx:init', clickTag: clickTag }),
          '*'
        );
      } catch(_) {}
    });
  }

  window.addEventListener('message', function(e) {
    try {
      var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (!data || data.type !== 'smx:exit') return;
      var dest = (typeof data.url === 'string' && data.url) ? data.url : '';
      var resolvedClickUrl = dest || clickTag || '';
      var navigateTo = resolvedClickUrl || clickTrackerUrl || '';
      var isAlreadyTracked = clickTrackerUrl && resolvedClickUrl && resolvedClickUrl.indexOf(clickTrackerUrl) === 0;
      if (clickTrackerUrl && !isAlreadyTracked) {
        var t = smxAppendQuery(clickTrackerUrl, 'url', resolvedClickUrl || clickTrackerUrl);
        try { fetch(t, { method: 'POST', keepalive: true, mode: 'no-cors', credentials: 'include' }); } catch(_) { (new Image()).src = t; }
      }
      if (navigateTo) {
        var opened = null;
        try { opened = window.open(navigateTo, '_blank', 'noopener'); } catch(_) {}
        if (!opened) {
          try { window.top.location.href = navigateTo; } catch(_) { window.location.href = navigateTo; }
        }
      }
    } catch(_) {}
  });

  (function() {
    if (!engagementUrl) return;
    var viewStart = null; var hoverStart = null; var flushed = false;
    function sendBeacon(url) {
      try { fetch(url, { method: 'GET', keepalive: true, mode: 'no-cors', credentials: 'include' }); } catch(_) { (new Image()).src = url; }
    }
    function flushView() { if (!viewStart) return; var d = Date.now() - viewStart; viewStart = null; if (d > 0) sendBeacon(smxAppendQuery(smxAppendQuery(engagementUrl, 'event', 'viewable'), 't', Math.round(d))); }
    function flushHover() { if (!hoverStart) return; var d = Date.now() - hoverStart; hoverStart = null; if (d > 0) sendBeacon(smxAppendQuery(smxAppendQuery(engagementUrl, 'event', 'hover_end'), 't', Math.round(d))); }
    function flush() { if (flushed) return; flushed = true; flushView(); flushHover(); }
    if (typeof IntersectionObserver !== 'undefined') {
      var isMRC = false; var mrcTimer = null;
      new IntersectionObserver(function(entries) {
        var ratio = entries[0].intersectionRatio;
        if (ratio >= 0.5) { if (!isMRC) { mrcTimer = setTimeout(function() { isMRC = true; viewStart = Date.now(); }, 1000); } }
        else { clearTimeout(mrcTimer); mrcTimer = null; if (isMRC) flushView(); isMRC = false; }
      }, { threshold: [0, 0.5, 1.0] }).observe(iframe);
    }
    iframe.addEventListener('mouseenter', function() { flushed = false; hoverStart = Date.now(); });
    iframe.addEventListener('mouseleave', flushHover);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    setInterval(function() {
      if (flushed) return;
      if (viewStart) { var d = Date.now() - viewStart; if (d > 0) { sendBeacon(smxAppendQuery(smxAppendQuery(engagementUrl, 'event', 'viewable'), 't', Math.round(d))); viewStart = Date.now(); } }
      if (hoverStart) { var d2 = Date.now() - hoverStart; if (d2 > 0) { sendBeacon(smxAppendQuery(smxAppendQuery(engagementUrl, 'event', 'hover_end'), 't', Math.round(d2))); hoverStart = Date.now(); } }
    }, 5000);
  })();

  parent.insertBefore(iframe, script);
  parent.removeChild(script);
})();`;
}

export async function handleDisplayRoutes(ctx) {
  const { method, pathname, res, req, env, url } = ctx;

  if (method === 'OPTIONS' && /^\/v1\/tags\/(display|native)\//.test(pathname)) {
    applyPublicCors(req, res);
    res.statusCode = 204;
    res.end();
    return true;
  }

  const bindingAssetMatch = pathname.match(/^\/v1\/tags\/display\/([^/]+)\/bindings\/([^/]+)(?:\/(.*))?$/);
  if (method === 'GET' && bindingAssetMatch) {
    const [, rawTagId, rawBindingId, rawAssetPath = ''] = bindingAssetMatch;
    applyPublicCors(req, res);

    if (!isValidTagId(rawTagId) || !isValidTagId(rawBindingId)) {
      res.statusCode = 400;
      res.end();
      return true;
    }

    const pool = getDatabasePool(env);
    const rows = await resolveActiveCreativeForTagRows(pool, rawTagId);
    const row = Array.isArray(rows)
      ? rows.find((candidate) => trimText(candidate?.binding_id) === rawBindingId)
      : null;
    if (!row) {
      res.statusCode = 404;
      res.end();
      return true;
    }

    const requestedAssetPath = normalizeCreativeAssetPath(rawAssetPath) || getCreativeEntryAssetPath(row);
    if (!requestedAssetPath) {
      res.statusCode = 404;
      res.end();
      return true;
    }

    if (isSeedDemoCreative(row) && requestedAssetPath.toLowerCase() === (getCreativeEntryAssetPath(row) || '').toLowerCase()) {
      return sendHtml(res, buildSeedDemoCreativeHtml({
        width: row.width,
        height: row.height,
        clickTag: trimText(url.searchParams.get('clickTag')),
      }));
    }

    const storageKey = resolveCreativeAssetStorageKey(env, row, requestedAssetPath);
    if (storageKey && isR2Ready(env)) {
      try {
        const body = normalizeServedHtml5AssetBody(await readR2ObjectBuffer(env, storageKey), requestedAssetPath);
        return sendAsset(res, body, {
          contentType: guessCreativeAssetContentType(requestedAssetPath),
        });
      } catch {
        // Fall through to URL relay below when object storage lookup is unavailable.
      }
    }

    const relayedAsset = await fetchCreativeAssetByUrl(row, requestedAssetPath);
    if (relayedAsset) {
      return sendAsset(res, normalizeServedHtml5AssetBody(relayedAsset.body, requestedAssetPath), {
        contentType: relayedAsset.contentType,
      });
    }

    res.statusCode = 404;
    res.end();
    return true;
  }

  if (method === 'GET' && /^\/v1\/tags\/display\/[^/]+\.html$/.test(pathname)) {
    const rawId = pathname.split('/')[4].replace(/\.html$/, '');
    applyPublicCors(req, res);

    if (!isValidTagId(rawId)) {
      res.statusCode = 400;
      res.end();
      return true;
    }
    const tagId = rawId;

    const pool = getDatabasePool(env);
    const rows = await resolveActiveCreativeForTagRows(pool, tagId);
    const row = pickWeightedCreativeRow(rows);

    if (!row) {
      return sendHtml(res, '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><!-- smx: no content --></body></html>');
    }

    const baseUrl = resolveBaseUrl(ctx);
    const DSP_TRACKER_KEYS = [
      'dsp', 'dom', 'purl', 'cuu', 'ifa', 'idfa', 'gadvid', 'iuid',
      'cmpid', 'netid', 'srcpubid', 'ppos', 'trftype', 'carr',
      'appid', 'appId', 'app_id', 'app', 'appb', 'appBundle', 'app_bundle',
      'bundle', 'bundleid', 'appn', 'appne', 'appName', 'app_name',
      'excid', 'excpubid', 'excsiddmn', 'sdmn', 'sid',
      'cntlang', 'cnttitle', 'cntseries', 'cngen', 'ctxid', 'appstnm',
      'gdpr', 'gdpr_consent', 'us_privacy',
      'cb', 'tmp', 'cmpne', 'adgne', 'adgid', 'crene', 'wbrse', 'oprsye',
      'lcc', 'lclat', 'lclong', 'dtyp',
    ];
    const trackerParams = new URLSearchParams();
    for (const key of DSP_TRACKER_KEYS) {
      const val = url.searchParams.get(key);
      if (val !== null && val !== '') trackerParams.set(key, val);
    }
    if (trimText(row.creative_id)) trackerParams.set('smx_creative_id', trimText(row.creative_id));
    if (trimText(row.creative_size_variant_id)) trackerParams.set('smx_variant_id', trimText(row.creative_size_variant_id));
    const dspQuery = Object.fromEntries(url.searchParams.entries());
    const trackerSuffix = trackerParams.toString() ? `?${trackerParams.toString()}` : '';
    queueDisplayFirstHopImpression(ctx, pool, tagId, row);
    const impressionUrl = '';
    const clickTrackerUrl = `${baseUrl}/v1/tags/tracker/${tagId}/click${trackerSuffix}`;
    const engagementTrackerUrl = `${baseUrl}/v1/tags/tracker/${tagId}/engagement`;
    const resolvedClickUrl = trimText(row.creative_click_url) || '';
    const baseClickTag = clickTrackerUrl
      ? (resolvedClickUrl
          ? `${clickTrackerUrl}${clickTrackerUrl.includes('?') ? '&' : '?'}url=${encodeURIComponent(resolvedClickUrl)}`
          : clickTrackerUrl)
      : resolvedClickUrl;
    const wrappedClickTag = wrapTrackedClickUrlWithDspMacro(baseClickTag, dspQuery, dspQuery.smx_dsp || dspQuery.dsp);

    const html = buildDisplayHtml({
      creativeUrl: buildCreativeAssetProxyUrl(baseUrl, tagId, row),
      width: row.width,
      height: row.height,
      clickTrackerUrl,
      engagementTrackerUrl,
      impressionUrl,
      clickUrl: resolvedClickUrl,
      clickTag: wrappedClickTag,
      omidVerification: {
        vendor: trimText(row.omid_verification_vendor),
        jsUrl: trimText(row.omid_verification_js_url),
        params: row.omid_verification_params,
      },
    });

    return sendHtml(res, html);
  }

  if (method === 'GET' && /^\/v1\/tags\/display\/[^/]+\.js$/.test(pathname)) {
    const rawId = pathname.split('/')[4].replace(/\.js$/, '');
    applyPublicCors(req, res);

    if (!isValidTagId(rawId)) {
      res.statusCode = 400;
      res.end();
      return true;
    }
    const tagId = rawId;

    const pool = getDatabasePool(env);
    const rows = await resolveActiveCreativeForTagRows(pool, tagId);
    const row = pickWeightedCreativeRow(rows);

    const baseUrl = resolveBaseUrl(ctx);
    const DSP_TRACKER_KEYS = [
      'dsp', 'dom', 'purl', 'cuu', 'ifa', 'idfa', 'gadvid', 'iuid',
      'cmpid', 'netid', 'srcpubid', 'ppos', 'trftype', 'carr',
      'appid', 'appId', 'app_id', 'app', 'appb', 'appBundle', 'app_bundle',
      'bundle', 'bundleid', 'appn', 'appne', 'appName', 'app_name',
      'excid', 'excpubid', 'excsiddmn', 'sdmn',
      'sid', 'cntlang', 'cnttitle', 'cntseries', 'cngen', 'ctxid', 'appstnm',
      'gdpr', 'gdpr_consent', 'us_privacy',
      'cb', 'tmp', 'cmpne', 'cmpgrpid', 'adgne', 'adgid', 'crene', 'cresze',
      'cretye', 'creid', 'wbrse', 'oprsye', 'lcc', 'lclat', 'lclong',
      'dtyp', 'lcst',
    ];
    const trackerParams = new URLSearchParams();
    for (const key of DSP_TRACKER_KEYS) {
      const val = url.searchParams.get(key);
      if (val !== null && val !== '') trackerParams.set(key, val);
    }
    const dspQuery = Object.fromEntries(url.searchParams.entries());
    const width = row?.width || 300;
    const height = row?.height || 250;

    if (!row || !trimText(row.public_url)) {
      return sendJs(res, `(function(){
  var w='${width}',h='${height}';
  var script=document.currentScript;if(!script)return;
  var el=document.createElement('div');
  el.style.cssText='display:inline-block;width:'+w+'px;height:'+h+'px;background:transparent;';
  script.parentNode&&script.parentNode.insertBefore(el,script);
  script.parentNode&&script.parentNode.removeChild(script);
})();`);
    }

    if (trimText(row.creative_id)) trackerParams.set('smx_creative_id', trimText(row.creative_id));
    if (trimText(row.creative_size_variant_id)) trackerParams.set('smx_variant_id', trimText(row.creative_size_variant_id));
    const trackerSuffix = trackerParams.toString() ? `?${trackerParams.toString()}` : '';

    queueDisplayFirstHopImpression(ctx, pool, tagId, row);
    const impressionUrl = '';
    const clickTrackerUrl = `${baseUrl}/v1/tags/tracker/${tagId}/click${trackerSuffix}`;
    const engagementTrackerUrl = `${baseUrl}/v1/tags/tracker/${tagId}/engagement`;
    const resolvedClickUrl = trimText(row.creative_click_url) || '';
    const baseClickTag = clickTrackerUrl
      ? (resolvedClickUrl
          ? `${clickTrackerUrl}${clickTrackerUrl.includes('?') ? '&' : '?'}url=${encodeURIComponent(resolvedClickUrl)}`
          : clickTrackerUrl)
      : resolvedClickUrl;
    const clickTag = wrapTrackedClickUrlWithDspMacro(baseClickTag, dspQuery, dspQuery.smx_dsp || dspQuery.dsp);

    return sendJs(res, buildDisplayJs({
      creativeUrl: buildCreativeAssetProxyUrl(baseUrl, tagId, row),
      impressionUrl,
      clickTrackerUrl,
      engagementTrackerUrl,
      clickTag,
      width,
      height,
    }));
  }

  if (method === 'GET' && /^\/v1\/tags\/native\/[^/]+\.js$/.test(pathname)) {
    const rawId = pathname.split('/')[4].replace(/\.js$/, '');
    applyPublicCors(req, res);

    if (!isValidTagId(rawId)) {
      res.statusCode = 400;
      res.end();
      return true;
    }
    const tagId = rawId;

    const pool = getDatabasePool(env);
    const rows = await resolveActiveCreativeForTagRows(pool, tagId);
    const row = pickWeightedCreativeRow(rows);

    const baseUrl = resolveBaseUrl(ctx);
    const displayHtmlUrl = `${baseUrl}/v1/tags/display/${tagId}.html`;
    const width = row?.width || 300;
    const height = row?.height || 250;

    return sendJs(res, buildDisplayJs({
      creativeUrl: displayHtmlUrl,
      impressionUrl: '',
      clickTrackerUrl: '',
      engagementTrackerUrl: '',
      clickTag: '',
      width,
      height,
    }));
  }

  return false;
}
