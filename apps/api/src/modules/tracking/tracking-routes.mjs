import {
  recordImpression,
  recordClick,
  recordViewability,
  recordEngagementEvent,
} from '@smx/db/tracking';
import { getTagServingSnapshotById } from '@smx/db/tags';
import { extractIp, resolveIp } from '@smx/geo';
import { readDspMacroValue, resolveDspClickMacroValue } from '@smx/contracts/dsp-macros';

const PIXEL_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeUuid(value) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const text = String(candidate ?? '').trim();
  return UUID_RE.test(text) ? text : null;
}

function parseSiteContext(rawUrl) {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    return { pageUrl: parsed.toString(), siteDomain: parsed.hostname.toLowerCase() };
  } catch {
    return { pageUrl: String(rawUrl), siteDomain: null };
  }
}

function resolveRequestHost(req) {
  const forwardedHost = String(req.headers['x-forwarded-host'] ?? '').split(',')[0].trim().toLowerCase();
  const directHost = String(req.headers.host ?? '').trim().toLowerCase();
  const authority = forwardedHost || directHost;
  return authority.replace(/:\d+$/, '') || null;
}

function inferDeviceInfo(userAgent = '') {
  const ua = String(userAgent || '');
  const lower = ua.toLowerCase();
  const deviceType = /mobile|iphone|android(?!.*tablet)/i.test(ua)
    ? 'mobile'
    : /ipad|tablet/i.test(ua)
      ? 'tablet'
      : /smarttv|roku|appletv|hbbtv|googletv|tizen|webos/i.test(ua)
        ? 'tv'
        : 'desktop';

  const browser =
    /edg\//i.test(ua) ? 'edge'
      : /chrome\//i.test(ua) && !/edg\//i.test(ua) ? 'chrome'
        : /safari\//i.test(ua) && !/chrome\//i.test(ua) ? 'safari'
          : /firefox\//i.test(ua) ? 'firefox'
            : /opr\//i.test(ua) || /opera/i.test(ua) ? 'opera'
              : /msie|trident/i.test(ua) ? 'ie'
                : 'unknown';

  const os =
    /windows/i.test(lower) ? 'windows'
      : /android/i.test(lower) ? 'android'
        : /iphone|ipad|ios/i.test(lower) ? 'ios'
          : /mac os|macintosh/i.test(lower) ? 'macos'
            : /linux/i.test(lower) ? 'linux'
              : /cros/i.test(lower) ? 'chromeos'
                : 'unknown';

  const deviceModel =
    ua.match(/\b(SM-[A-Z0-9-]+)\b/i)?.[1]
    ?? ua.match(/\b(Pixel [A-Z0-9 ]+)\b/i)?.[1]
    ?? ua.match(/\b(iPhone|iPad|iPod)\b/i)?.[1]
    ?? ua.match(/\b(AppleTV|Roku|GoogleTV|SMART-TV|HbbTV)\b/i)?.[1]
    ?? ua.match(/\b(Macintosh)\b/i)?.[1]
    ?? ua.match(/\b(Windows NT [0-9.]+)\b/i)?.[1]
    ?? null;

  return { deviceType, browser, os, deviceModel };
}

function readTrackingValue(...values) {
  for (const value of values) {
    const candidate = Array.isArray(value) ? value[0] : value;
    const text = String(candidate ?? '').trim();
    if (text) return text;
  }
  return null;
}

function readTrackingBoolean(value, fallback = false) {
  const text = String(Array.isArray(value) ? value[0] : (value ?? '')).trim().toLowerCase();
  if (!text) return fallback;
  return text === '1' || text === 'true' || text === 'yes' || text === 'on';
}

function readTrackingNumber(value, fallback = null) {
  const numeric = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function decodeContextToken(token) {
  const raw = Array.isArray(token) ? token[0] : token;
  const text = String(raw ?? '').trim();
  if (!text) return {};
  try {
    const normalized = text.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function buildMergedTrackingQuery(query = {}) {
  const ctxQuery = decodeContextToken(query?.ctx);
  return {
    ...ctxQuery,
    ...query,
  };
}

function setTrackingIdentityCookies(reply, context = {}) {
  const secure = process.env.NODE_ENV === 'production';
  if (context.device_id) {
    reply.setCookie('smx_device_id', String(context.device_id), {
      path: '/',
      httpOnly: false,
      sameSite: secure ? 'none' : 'lax',
      secure,
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  if (context.cookie_id) {
    reply.setCookie('smx_cookie_id', String(context.cookie_id), {
      path: '/',
      httpOnly: false,
      sameSite: secure ? 'none' : 'lax',
      secure,
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

function buildMeasurementDebugMeta(context = {}) {
  return {
    measurementPath: context.measurement_path ?? 'smx_fallback',
    macroSource: context.macro_source ?? 'absent',
    dspProvider: context.dsp_provider ?? null,
  };
}

async function recordEngagementEventResilient(pool, payload, req, logMeta = {}) {
  try {
    return await recordEngagementEvent(pool, payload);
  } catch (error) {
    if (error?.code === '23503' && payload?.impression_id) {
      req.log?.warn?.({
        err: error,
        ...logMeta,
        impressionId: payload.impression_id,
      }, 'engagement impression missing, retrying without impression_id');
      return recordEngagementEvent(pool, {
        ...payload,
        impression_id: null,
      });
    }
    throw error;
  }
}

function attachMeasurementDebugHeaders(reply, context = {}) {
  const meta = buildMeasurementDebugMeta(context);
  reply.header('x-smx-measurement-path', meta.measurementPath);
  reply.header('x-smx-macro-source', meta.macroSource);
  if (meta.dspProvider) {
    reply.header('x-smx-dsp-provider', meta.dspProvider);
  }
}

function logMeasurementPath(req, message, payload = {}, context = {}) {
  req.log?.info?.({
    ...payload,
    ...buildMeasurementDebugMeta(context),
  }, message);
}

function buildIdentityKeys({ query = {}, headers = {}, cookies = {} }) {
  const consentStatus = readTrackingValue(
    query.cs,
    headers['x-consent-status'],
    cookies.smx_consent_status,
    cookies.consent_status,
  ) ?? 'unknown';

  const keys = [];
  const pushKey = (keyType, keyValue, source, isFirstParty, metadata = {}) => {
    const value = readTrackingValue(keyValue);
    if (!value) return;
    keys.push({
      key_type: keyType,
      key_value: value,
      source,
      is_first_party: isFirstParty,
      consent_status: consentStatus,
      metadata,
    });
  };

  const dspHint = readTrackingValue(query.smx_dsp, query.dsp);
  pushKey('device_id', query.did, 'query', true);
  pushKey('device_id', headers['x-device-id'], 'header', true);
  pushKey('device_id', cookies.smx_device_id ?? cookies.device_id, 'cookie', true);
  pushKey('device_id', readDspMacroValue(query, 'deviceId', dspHint), 'query', false, { provider: String(dspHint || 'dsp') });

  pushKey('cookie_id', query.cid, 'query', true);
  pushKey('cookie_id', headers['x-cookie-id'], 'header', true);
  pushKey('cookie_id', cookies.smx_cookie_id ?? cookies.cookie_id, 'cookie', true);
  pushKey('cookie_id', readDspMacroValue(query, 'cookieId', dspHint), 'query', false, { provider: String(dspHint || 'dsp') });

  pushKey('external_user_id', query.euid, 'query', true);
  pushKey('external_user_id', headers['x-external-user-id'], 'header', true);

  pushKey('gclid', query.gclid, 'query', false, { provider: 'google' });
  pushKey('fbclid', query.fbclid, 'query', false, { provider: 'meta' });
  pushKey('ttclid', query.ttclid, 'query', false, { provider: 'tiktok' });
  pushKey('msclkid', query.msclkid, 'query', false, { provider: 'microsoft' });

  return keys.filter((item, index, arr) =>
    arr.findIndex((candidate) => candidate.key_type === item.key_type && candidate.key_value === item.key_value) === index);
}

async function inferGeo(req, query = {}) {
  const header = (name) => {
    const value = req.headers[name];
    return Array.isArray(value) ? value[0] : value;
  };
  const overrideCountry = String(query.ct || '').trim().toUpperCase().slice(0, 2) || null;
  const overrideRegion = String(query.rg || '').trim() || null;
  const overrideCity = String(query.city || '').trim() || null;
  if (overrideCountry || overrideRegion || overrideCity) {
    return { country: overrideCountry, region: overrideRegion, city: overrideCity };
  }

  const resolvedIp = extractIp(req);
  const resolvedGeo = await resolveIp(resolvedIp);
  const headerCountry = String(
    header('cf-ipcountry')
    || header('x-vercel-ip-country')
    || header('x-appengine-country')
    || '',
  ).trim().toUpperCase().slice(0, 2) || null;
  const headerRegion = String(
    header('x-vercel-ip-country-region')
    || header('x-appengine-region')
    || '',
  ).trim() || null;
  const country = resolvedGeo.country ?? headerCountry;
  const region = resolvedGeo.region ?? headerRegion;
  const city = resolvedGeo.city ?? null;
  return { country, region, city };
}

async function collectTrackingContext(req, query = {}) {
  const ip = extractIp(req) ?? null;
  const userAgent = req.headers['user-agent'] ?? null;
  const referer = req.headers['referer'] ?? req.headers['referrer'] ?? null;
  const pageContext = parseSiteContext(readTrackingValue(query.pu, query.purl));
  const refererContext = parseSiteContext(referer);
  const dspHint = String(readTrackingValue(query.smx_dsp, query.dsp) ?? '').trim().toLowerCase();
  const macroDomain = readDspMacroValue(query, 'siteDomain', dspHint)
    ?? readTrackingValue(query.dom, query.sd, query.domain, query.inventoryUnitReportingName);
  const requestHost = resolveRequestHost(req);
  const selectedContext =
    (pageContext?.siteDomain && pageContext.siteDomain !== requestHost ? pageContext : null)
    ?? (refererContext?.siteDomain && refererContext.siteDomain !== requestHost ? refererContext : null)
    ?? pageContext
    ?? refererContext
    ?? { pageUrl: null, siteDomain: macroDomain ? String(macroDomain).toLowerCase() : null };
  if (!selectedContext.siteDomain && macroDomain) {
    selectedContext.siteDomain = String(macroDomain).toLowerCase();
  }
  const geo = await inferGeo(req, query);
  const country = geo.country ?? null;
  const region = geo.region ?? null;
  const city = geo.city ?? null;
  const { deviceType, browser, os, deviceModel: inferredDeviceModel } = inferDeviceInfo(userAgent);
  const cookieDeviceId = req.cookies?.smx_device_id ?? req.cookies?.device_id ?? null;
  const cookieCookieId = req.cookies?.smx_cookie_id ?? req.cookies?.cookie_id ?? null;
  const identityKeys = buildIdentityKeys({ query, headers: req.headers, cookies: req.cookies ?? {} });
  const deliveryKind = String(query.smx_delivery_kind ?? '').trim().toLowerCase() || null;
  const rawClickMacro = readDspMacroValue(query, 'clickMacro', dspHint);
  const resolvedClickMacro = resolveDspClickMacroValue(rawClickMacro);
  const deviceModel = readTrackingValue(query.dmdl, query.deviceModel, query.model, inferredDeviceModel);
  const contextualIds = readTrackingValue(query.ctxid, query.contextualIds);
  const networkId = readTrackingValue(query.netid, query.networkId);
  const sourcePublisherId = readTrackingValue(query.srcpubid, query.sourcePublisherId, query.excpubid, query.exchangePublisherId);
  const appId = readTrackingValue(query.appid, query.appId, query.appb, query.appBundle);
  const siteId = readTrackingValue(query.sid, query.siteId);
  const exchangeId = readTrackingValue(query.excid, query.exchangeId);
  const exchangePublisherId = readTrackingValue(query.excpubid, query.exchangePublisherId);
  const exchangeSiteIdOrDomain = readTrackingValue(query.excsiddmn, query.exchangeSiteIdOrDomain);
  const appBundle = readTrackingValue(query.appb, query.appBundle);
  const appName = readTrackingValue(query.appn, query.appName, query.appne, query.appNameEncoded);
  const pagePosition = readTrackingValue(query.ppos, query.pagePosition);
  const contentLanguage = readTrackingValue(query.cntlang, query.contentLanguage);
  const contentTitle = readTrackingValue(query.cnttitle, query.contentTitle);
  const contentSeries = readTrackingValue(query.cntseries, query.contentSeries);
  const carrier = readTrackingValue(query.carr, query.carrier);
  const appStoreName = readTrackingValue(query.appstnm, query.appStoreName);
  const contentGenre = readTrackingValue(query.cngen, query.contentGenre);
  const measurementPath = resolvedClickMacro
    ? `${dspHint || 'dsp'}_macro`
    : dspHint
      ? `${dspHint}_fallback`
      : 'smx_fallback';
  return {
    ip,
    user_agent: userAgent,
    referer,
    page_url: selectedContext.pageUrl,
    site_domain: selectedContext.siteDomain,
    country,
    region,
    city,
    device_type: deviceType,
    device_model: deviceModel,
    browser,
    os,
    device_id: String(query.did ?? req.headers['x-device-id'] ?? cookieDeviceId ?? '').trim() || null,
    cookie_id: String(query.cid ?? req.headers['x-cookie-id'] ?? cookieCookieId ?? '').trim() || null,
    contextual_ids: contextualIds,
    network_id: networkId,
    source_publisher_id: sourcePublisherId,
    app_id: appId,
    site_id: siteId,
    exchange_id: exchangeId,
    exchange_publisher_id: exchangePublisherId,
    exchange_site_id_or_domain: exchangeSiteIdOrDomain,
    app_bundle: appBundle,
    app_name: appName,
    page_position: pagePosition,
    content_language: contentLanguage,
    content_title: contentTitle,
    content_series: contentSeries,
    carrier,
    app_store_name: appStoreName,
    content_genre: contentGenre,
    identity_keys: identityKeys,
    measurement_path: measurementPath,
    macro_source: rawClickMacro ? (resolvedClickMacro ? 'resolved' : 'unresolved') : 'absent',
    dsp_provider: dspHint || null,
    delivery_kind: deliveryKind,
  };
}

export function handleTrackingRoutes(app, { pool }) {
  app.get('/v1/tags/tracker/:tagId/impression.gif', async (req, reply) => {
    const { tagId } = req.params;
    const mergedQuery = buildMergedTrackingQuery(req.query);
    const servingSnapshot = await getTagServingSnapshotById(pool, tagId);
    if (!servingSnapshot) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }
    if (servingSnapshot.format === 'tracker' && servingSnapshot.tracker_type && servingSnapshot.tracker_type !== 'impression') {
      return reply.status(400).send({ error: 'Bad Request', message: 'Tag is not an impression tracker' });
    }

    const context = await collectTrackingContext(req, mergedQuery);
    attachMeasurementDebugHeaders(reply, context);
    setTrackingIdentityCookies(reply, context);
    recordImpression(pool, {
      impression_id: normalizeUuid(mergedQuery?.imp) ?? null,
      tag_id: tagId,
      workspace_id: servingSnapshot.workspace_id,
      creative_id: normalizeUuid(mergedQuery?.c) ?? servingSnapshot.servingCandidate?.creativeId ?? null,
      creative_size_variant_id: normalizeUuid(mergedQuery?.csv) ?? servingSnapshot.servingCandidate?.creativeSizeVariantId ?? null,
      ...context,
    }).catch((error) => {
      req.log?.warn?.({ err: error, tagId, workspaceId: servingSnapshot.workspace_id }, 'failed to record tracker impression');
    });

    reply.header('Content-Type', 'image/gif');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
    return reply.send(PIXEL_GIF);
  });

  app.get('/v1/tags/tracker/:tagId/click', async (req, reply) => {
    const { tagId } = req.params;
    const mergedQuery = buildMergedTrackingQuery(req.query);
    const servingSnapshot = await getTagServingSnapshotById(pool, tagId);
    if (!servingSnapshot) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    const context = await collectTrackingContext(req, mergedQuery);
    attachMeasurementDebugHeaders(reply, context);
    setTrackingIdentityCookies(reply, context);
    const destinationUrl = servingSnapshot.click_url
      ?? servingSnapshot.servingCandidate?.clickUrl
      ?? mergedQuery?.url
      ?? null;
    const creativeId = normalizeUuid(mergedQuery?.c) ?? servingSnapshot.servingCandidate?.creativeId ?? null;
    const creativeSizeVariantId = normalizeUuid(mergedQuery?.csv) ?? servingSnapshot.servingCandidate?.creativeSizeVariantId ?? null;
    const impressionId = normalizeUuid(mergedQuery?.imp) ?? null;

    logMeasurementPath(req, 'tracking click measurement path', {
      tagId,
      workspaceId: servingSnapshot.workspace_id,
      impressionId,
      creativeId,
      creativeSizeVariantId,
      destinationUrl,
    }, context);

    recordClick(pool, {
        tag_id: tagId,
        workspace_id: servingSnapshot.workspace_id,
        creative_id: creativeId,
        creative_size_variant_id: creativeSizeVariantId,
        impression_id: impressionId,
        redirect_url: destinationUrl,
        dsp_provider: context.dsp_provider ?? null,
        ...context,
      }).catch((error) => {
        req.log?.error?.({ err: error, tagId, workspaceId: servingSnapshot.workspace_id, destinationUrl }, 'failed to record tracker click');
      });

    if (!destinationUrl) {
      return reply.status(204).send();
    }
    try {
      const safeUrl = new URL(destinationUrl);
      if (safeUrl.protocol !== 'http:' && safeUrl.protocol !== 'https:') {
        return reply.status(204).send();
      }
      return reply.redirect(302, safeUrl.toString());
    } catch {
      return reply.status(204).send();
    }
  });

  app.get('/v1/tags/tracker/:tagId/engagement', async (req, reply) => {
    const { tagId } = req.params;
    const mergedQuery = buildMergedTrackingQuery(req.query);
    const servingSnapshot = await getTagServingSnapshotById(pool, tagId);
    if (!servingSnapshot) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    const eventType = String(mergedQuery?.event ?? '').trim();
    if (!eventType) {
      return reply.status(400).send({ error: 'Bad Request', message: 'event is required' });
    }

    const context = await collectTrackingContext(req, mergedQuery);
    attachMeasurementDebugHeaders(reply, context);
    setTrackingIdentityCookies(reply, context);
    const creativeId = normalizeUuid(mergedQuery?.c) ?? servingSnapshot.servingCandidate?.creativeId ?? null;
    const creativeSizeVariantId = normalizeUuid(mergedQuery?.csv) ?? servingSnapshot.servingCandidate?.creativeSizeVariantId ?? null;
    const impressionId = normalizeUuid(mergedQuery?.imp) ?? null;
    const hoverDurationMs = Number(mergedQuery?.hd ?? 0);

    logMeasurementPath(req, 'tracking native engagement measurement path', {
      tagId,
      workspaceId: servingSnapshot.workspace_id,
      impressionId,
      creativeId,
      creativeSizeVariantId,
      eventType,
      hoverDurationMs: Number.isFinite(hoverDurationMs) ? hoverDurationMs : null,
    }, context);

    recordEngagementEventResilient(pool, {
      tag_id: tagId,
      workspace_id: servingSnapshot.workspace_id,
      creative_id: creativeId,
      creative_size_variant_id: creativeSizeVariantId,
      impression_id: impressionId,
      event_type: eventType,
      hover_duration_ms: Number.isFinite(hoverDurationMs) ? hoverDurationMs : null,
      ...context,
    }, req, {
      tagId,
      workspaceId: servingSnapshot.workspace_id,
      eventType,
    }).catch((error) => {
      req.log?.warn?.({ err: error, tagId, workspaceId: servingSnapshot.workspace_id, eventType }, 'failed to record native engagement event');
    });

    reply.header('Content-Type', 'image/gif');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
    return reply.send(PIXEL_GIF);
  });

  // GET /track/impression/:tagId — records impression, returns 1x1 transparent GIF
  app.get('/track/impression/:tagId', async (req, reply) => {
    const { tagId } = req.params;
    const mergedQuery = buildMergedTrackingQuery(req.query);
    const { ws: rawWorkspaceId, imp: rawImpressionId, c: rawCreativeId, csv: rawCreativeSizeVariantId } = mergedQuery;
    const impressionId = normalizeUuid(rawImpressionId);
    const servingSnapshot = rawWorkspaceId
      ? null
      : await getTagServingSnapshotById(pool, tagId);
    const workspaceId = rawWorkspaceId || servingSnapshot?.workspace_id || null;
    const creativeId = normalizeUuid(rawCreativeId) ?? servingSnapshot?.servingCandidate?.creativeId ?? null;
    const creativeSizeVariantId =
      normalizeUuid(rawCreativeSizeVariantId) ?? servingSnapshot?.servingCandidate?.creativeSizeVariantId ?? null;

    const context = await collectTrackingContext(req, mergedQuery);
    setTrackingIdentityCookies(reply, context);
    attachMeasurementDebugHeaders(reply, context);

    if (workspaceId) {
      // Fire-and-forget — don't block pixel response
      logMeasurementPath(req, 'tracking impression measurement path', {
        tagId,
        workspaceId,
        impressionId,
        creativeId,
        creativeSizeVariantId,
      }, context);
      recordImpression(pool, {
        impression_id: impressionId ?? null,
        tag_id: tagId,
        workspace_id: workspaceId,
        creative_id: creativeId ?? null,
        creative_size_variant_id: creativeSizeVariantId ?? null,
        ...context,
      }).catch((error) => {
        req.log?.warn?.({ err: error, tagId, workspaceId, impressionId }, 'failed to record impression');
      });
    }

    reply.header('Content-Type', 'image/gif');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
    return reply.send(PIXEL_GIF);
  });

  // GET /track/click/:tagId — records click, redirects to clickUrl
  app.get('/track/click/:tagId', async (req, reply) => {
    const { tagId } = req.params;
    const mergedQuery = buildMergedTrackingQuery(req.query);
    const {
      ws: rawWorkspaceId,
      url: rawDestinationUrl,
      imp: rawImpressionId,
      c: rawCreativeId,
      csv: rawCreativeSizeVariantId,
    } = mergedQuery;
    const impressionId = normalizeUuid(rawImpressionId);
    const servingSnapshot = rawWorkspaceId
      ? null
      : await getTagServingSnapshotById(pool, tagId);
    const workspaceId = rawWorkspaceId || servingSnapshot?.workspace_id || null;
    const creativeId = normalizeUuid(rawCreativeId) ?? servingSnapshot?.servingCandidate?.creativeId ?? null;
    const creativeSizeVariantId =
      normalizeUuid(rawCreativeSizeVariantId) ?? servingSnapshot?.servingCandidate?.creativeSizeVariantId ?? null;
    const destinationUrl = rawDestinationUrl
      ?? servingSnapshot?.click_url
      ?? servingSnapshot?.servingCandidate?.clickUrl
      ?? null;

    const context = await collectTrackingContext(req, mergedQuery);
    setTrackingIdentityCookies(reply, context);
    attachMeasurementDebugHeaders(reply, context);

    if (workspaceId) {
      try {
        logMeasurementPath(req, 'tracking click measurement path', {
          tagId,
          workspaceId,
          impressionId,
          creativeId,
          creativeSizeVariantId,
          destinationUrl,
        }, context);
        await recordClick(pool, {
          tag_id: tagId,
          workspace_id: workspaceId,
          creative_id: creativeId ?? null,
          creative_size_variant_id: creativeSizeVariantId ?? null,
          impression_id: impressionId ?? null,
          redirect_url: destinationUrl ?? null,
          dsp_provider: context.dsp_provider ?? null,
          ...context,
        });
      } catch (error) {
        req.log?.error?.(
          {
            err: error,
            tagId,
            workspaceId,
            impressionId,
            creativeId,
            creativeSizeVariantId,
            destinationUrl,
          },
          'failed to record click',
        );
      }
    }

    if (destinationUrl) {
      // Validate destination URL to prevent open redirect abuse
      let safeUrl;
      try {
        safeUrl = new URL(destinationUrl);
        if (safeUrl.protocol !== 'http:' && safeUrl.protocol !== 'https:') {
          return reply.status(204).send();
        }
      } catch {
        return reply.status(204).send();
      }
      return reply.redirect(302, safeUrl.toString());
    }

    // No URL provided — return a 204
    return reply.status(204).send();
  });

  // GET /track/click-beacon/:tagId — non-counting beacon for VAST ClickTracking
  app.get('/track/click-beacon/:tagId', async (req, reply) => {
    const { tagId } = req.params;
    const mergedQuery = buildMergedTrackingQuery(req.query);
    const {
      ws: rawWorkspaceId,
      imp: rawImpressionId,
      c: rawCreativeId,
      csv: rawCreativeSizeVariantId,
    } = mergedQuery;
    const impressionId = normalizeUuid(rawImpressionId);
    const servingSnapshot = rawWorkspaceId
      ? null
      : await getTagServingSnapshotById(pool, tagId);
    const workspaceId = rawWorkspaceId || servingSnapshot?.workspace_id || null;
    const creativeId = normalizeUuid(rawCreativeId) ?? servingSnapshot?.servingCandidate?.creativeId ?? null;
    const creativeSizeVariantId =
      normalizeUuid(rawCreativeSizeVariantId) ?? servingSnapshot?.servingCandidate?.creativeSizeVariantId ?? null;

    const context = await collectTrackingContext(req, mergedQuery);
    setTrackingIdentityCookies(reply, context);
    attachMeasurementDebugHeaders(reply, context);

    if (workspaceId) {
      logMeasurementPath(req, 'tracking click beacon path', {
        tagId,
        workspaceId,
        impressionId,
        creativeId,
        creativeSizeVariantId,
      }, context);
    }

    reply.header('Content-Type', 'image/gif');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
    return reply.send(PIXEL_GIF);
  });

  // GET /track/viewability/:tagId — records viewability event
  app.get('/track/viewability/:tagId', async (req, reply) => {
    const { tagId } = req.params;
    const mergedQuery = buildMergedTrackingQuery(req.query);
    const {
      ws: rawWorkspaceId,
      vp,
      imp: rawImpressionId,
      c: rawCreativeId,
      csv: rawCreativeSizeVariantId,
      event,
      state,
      method,
      ms,
      audible,
      fullscreen,
      omid,
      piv,
    } = mergedQuery;
    const impressionId = normalizeUuid(rawImpressionId);
    const servingSnapshot = rawWorkspaceId
      ? null
      : await getTagServingSnapshotById(pool, tagId);
    const workspaceId = rawWorkspaceId || servingSnapshot?.workspace_id || null;
    const creativeId = normalizeUuid(rawCreativeId) ?? servingSnapshot?.servingCandidate?.creativeId ?? null;
    const creativeSizeVariantId =
      normalizeUuid(rawCreativeSizeVariantId) ?? servingSnapshot?.servingCandidate?.creativeSizeVariantId ?? null;

    if (workspaceId) {
      const normalizedState = String(state ?? '').trim().toLowerCase();
      const hasVp = vp !== undefined && vp !== null && String(vp).trim() !== '';
      const viewable = hasVp
        ? !(String(vp).trim() === '0' || String(vp).trim().toLowerCase() === 'false')
        : normalizedState === 'viewable';
      const durationMs = readTrackingNumber(ms, null);
      const isAudible = readTrackingBoolean(audible, false);
      const isFullscreen = readTrackingBoolean(fullscreen, false);
      const isOmid = readTrackingBoolean(omid, false);
      const percentageInView = readTrackingNumber(piv, null);
      const context = await collectTrackingContext(req, mergedQuery);
      setTrackingIdentityCookies(reply, context);
      attachMeasurementDebugHeaders(reply, context);
      logMeasurementPath(req, 'tracking viewability measurement path', {
        tagId,
        workspaceId,
        impressionId,
        creativeId,
        creativeSizeVariantId,
        viewable,
        state: state ?? (viewable ? 'viewable' : 'measured'),
        durationMs,
        audible: isAudible,
        fullscreen: isFullscreen,
        omid: isOmid,
        percentageInView,
      }, context);
      recordViewability(pool, {
        tag_id: tagId,
        workspace_id: workspaceId,
        impression_id: impressionId ?? null,
        viewable,
        state: state ?? (viewable ? 'viewable' : 'measured'),
        method: method ?? null,
        duration_ms: durationMs,
      }).catch((error) => {
        req.log?.warn?.({ err: error, tagId, workspaceId, impressionId }, 'failed to record viewability');
      });
      if (durationMs && durationMs > 0 && (state === 'viewable' || viewable)) {
        const attentionDurationMs = isAudible ? durationMs : null;
        recordEngagementEventResilient(pool, {
          tag_id: tagId,
          workspace_id: workspaceId,
          creative_id: creativeId ?? null,
          creative_size_variant_id: creativeSizeVariantId ?? null,
          impression_id: impressionId ?? null,
          event_type: 'attention',
          hover_duration_ms: attentionDurationMs,
          metadata: {
            measurement_method: method ?? 'unknown',
            omid: isOmid,
            audible: isAudible,
            fullscreen: isFullscreen,
            percentage_in_view: percentageInView,
            duration_ms: durationMs,
          },
          ...context,
        }, req, {
          tagId,
          workspaceId,
          eventType: 'attention',
        }).catch((error) => {
          req.log?.warn?.({ err: error, tagId, workspaceId, impressionId }, 'failed to record attention event');
        });
      }
      if (event) {
        recordEngagementEventResilient(pool, {
          tag_id: tagId,
          workspace_id: workspaceId,
          creative_id: creativeId ?? null,
          creative_size_variant_id: creativeSizeVariantId ?? null,
          impression_id: impressionId ?? null,
          event_type: String(event),
          ...context,
        }, req, {
          tagId,
          workspaceId,
          event: String(event),
        }).catch((error) => {
          req.log?.warn?.({ err: error, tagId, workspaceId, impressionId, event }, 'failed to record viewability engagement event');
        });
      }
    }

    reply.header('Content-Type', 'image/gif');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
    return reply.send(PIXEL_GIF);
  });

  app.get('/track/engagement/:tagId', async (req, reply) => {
    const { tagId } = req.params;
    const mergedQuery = buildMergedTrackingQuery(req.query);
    const {
      ws: workspaceId,
      imp: rawImpressionId,
      c: rawCreativeId,
      csv: rawCreativeSizeVariantId,
      event,
      hd: hoverDurationMs,
    } = mergedQuery;
    const impressionId = normalizeUuid(rawImpressionId);
    const creativeId = normalizeUuid(rawCreativeId);
    const creativeSizeVariantId = normalizeUuid(rawCreativeSizeVariantId);

    if (workspaceId && event) {
      const context = await collectTrackingContext(req, mergedQuery);
      setTrackingIdentityCookies(reply, context);
      recordEngagementEventResilient(pool, {
        tag_id: tagId,
        workspace_id: workspaceId,
        creative_id: creativeId ?? null,
        creative_size_variant_id: creativeSizeVariantId ?? null,
        impression_id: impressionId ?? null,
        event_type: String(event),
        hover_duration_ms: hoverDurationMs ?? null,
        ...context,
      }, req, {
        tagId,
        workspaceId,
        event: String(event),
      }).catch((error) => {
        req.log?.warn?.({ err: error, tagId, workspaceId, impressionId, event }, 'failed to record engagement event');
      });
    }

    reply.header('Content-Type', 'image/gif');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
    return reply.send(PIXEL_GIF);
  });
}
