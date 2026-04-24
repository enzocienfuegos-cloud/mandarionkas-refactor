import {
  recordImpression,
  recordClick,
  recordViewability,
  recordEngagementEvent,
} from '@smx/db/tracking';
import { getTagById } from '@smx/db/tags';
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

  return { deviceType, browser, os };
}

function readTrackingValue(...values) {
  for (const value of values) {
    const candidate = Array.isArray(value) ? value[0] : value;
    const text = String(candidate ?? '').trim();
    if (text) return text;
  }
  return null;
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

  const dspHint = query.smx_dsp;
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
  const pageContext = parseSiteContext(query.pu);
  const refererContext = parseSiteContext(referer);
  const macroDomain = readDspMacroValue(query, 'siteDomain', query.smx_dsp)
    ?? readTrackingValue(query.sd, query.domain, query.inventoryUnitReportingName);
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
  const { deviceType, browser, os } = inferDeviceInfo(userAgent);
  const cookieDeviceId = req.cookies?.smx_device_id ?? req.cookies?.device_id ?? null;
  const cookieCookieId = req.cookies?.smx_cookie_id ?? req.cookies?.cookie_id ?? null;
  const identityKeys = buildIdentityKeys({ query, headers: req.headers, cookies: req.cookies ?? {} });
  const dspHint = String(query.smx_dsp ?? '').trim().toLowerCase();
  const deliveryKind = String(query.smx_delivery_kind ?? '').trim().toLowerCase() || null;
  const rawClickMacro = readDspMacroValue(query, 'clickMacro', dspHint);
  const resolvedClickMacro = resolveDspClickMacroValue(rawClickMacro);
  const measurementPath = resolvedClickMacro
    ? 'basis_macro'
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
    browser,
    os,
    device_id: String(query.did ?? req.headers['x-device-id'] ?? cookieDeviceId ?? '').trim() || null,
    cookie_id: String(query.cid ?? req.headers['x-cookie-id'] ?? cookieCookieId ?? '').trim() || null,
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
    const tag = await getTagById(pool, tagId);
    if (!tag) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }
    if (tag.format !== 'tracker' || tag.tracker_type !== 'impression') {
      return reply.status(400).send({ error: 'Bad Request', message: 'Tag is not an impression tracker' });
    }

    const context = await collectTrackingContext(req, req.query);
    setTrackingIdentityCookies(reply, context);
    recordImpression(pool, {
      impression_id: normalizeUuid(req.query?.imp) ?? null,
      tag_id: tagId,
      workspace_id: tag.workspace_id,
      creative_id: normalizeUuid(req.query?.c) ?? null,
      creative_size_variant_id: normalizeUuid(req.query?.csv) ?? null,
      ...context,
    }).catch((error) => {
      req.log?.warn?.({ err: error, tagId, workspaceId: tag.workspace_id }, 'failed to record tracker impression');
    });

    reply.header('Content-Type', 'image/gif');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
    return reply.send(PIXEL_GIF);
  });

  app.get('/v1/tags/tracker/:tagId/click', async (req, reply) => {
    const { tagId } = req.params;
    const tag = await getTagById(pool, tagId);
    if (!tag) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    const context = await collectTrackingContext(req, req.query);
    attachMeasurementDebugHeaders(reply, context);
    setTrackingIdentityCookies(reply, context);
    const destinationUrl = tag.click_url ?? req.query?.url ?? null;

    try {
      await recordClick(pool, {
        tag_id: tagId,
        workspace_id: tag.workspace_id,
        creative_id: normalizeUuid(req.query?.c) ?? null,
        creative_size_variant_id: normalizeUuid(req.query?.csv) ?? null,
        impression_id: normalizeUuid(req.query?.imp) ?? null,
        redirect_url: destinationUrl,
        ...context,
      });
      logMeasurementPath(req, 'tracking click measurement path', {
        tagId,
        workspaceId: tag.workspace_id,
        impressionId: normalizeUuid(req.query?.imp) ?? null,
        creativeId: normalizeUuid(req.query?.c) ?? null,
        creativeSizeVariantId: normalizeUuid(req.query?.csv) ?? null,
        destinationUrl,
      }, context);
    } catch (error) {
      req.log?.error?.({ err: error, tagId, workspaceId: tag.workspace_id, destinationUrl }, 'failed to record tracker click');
    }

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

  // GET /track/impression/:tagId — records impression, returns 1x1 transparent GIF
  app.get('/track/impression/:tagId', async (req, reply) => {
    const { tagId } = req.params;
    const { ws: workspaceId, imp: rawImpressionId, c: rawCreativeId, csv: rawCreativeSizeVariantId } = req.query;
    const impressionId = normalizeUuid(rawImpressionId);
    const creativeId = normalizeUuid(rawCreativeId);
    const creativeSizeVariantId = normalizeUuid(rawCreativeSizeVariantId);

    if (!workspaceId) {
      // Still return pixel, just don't record
      reply.header('Content-Type', 'image/gif');
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');
      return reply.send(PIXEL_GIF);
    }

    const context = await collectTrackingContext(req, req.query);
    setTrackingIdentityCookies(reply, context);
    attachMeasurementDebugHeaders(reply, context);

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

    reply.header('Content-Type', 'image/gif');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
    return reply.send(PIXEL_GIF);
  });

  // GET /track/click/:tagId — records click, redirects to clickUrl
  app.get('/track/click/:tagId', async (req, reply) => {
    const { tagId } = req.params;
    const { ws: workspaceId, url: destinationUrl, imp: rawImpressionId, c: rawCreativeId, csv: rawCreativeSizeVariantId } = req.query;
    const impressionId = normalizeUuid(rawImpressionId);
    const creativeId = normalizeUuid(rawCreativeId);
    const creativeSizeVariantId = normalizeUuid(rawCreativeSizeVariantId);

    const context = await collectTrackingContext(req, req.query);
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

  // GET /track/viewability/:tagId — records viewability event
  app.get('/track/viewability/:tagId', async (req, reply) => {
    const { tagId } = req.params;
    const { ws: workspaceId, vp, imp: rawImpressionId, c: rawCreativeId, csv: rawCreativeSizeVariantId, event, state, method, ms } = req.query;
    const impressionId = normalizeUuid(rawImpressionId);
    const creativeId = normalizeUuid(rawCreativeId);
    const creativeSizeVariantId = normalizeUuid(rawCreativeSizeVariantId);

    if (workspaceId) {
      const viewable = vp !== '0' && vp !== 'false';
      const context = await collectTrackingContext(req, req.query);
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
      }, context);
      recordViewability(pool, {
        tag_id: tagId,
        workspace_id: workspaceId,
        impression_id: impressionId ?? null,
        viewable,
        state: state ?? (viewable ? 'viewable' : 'measured'),
        method: method ?? null,
        duration_ms: ms ?? null,
      }).catch((error) => {
        req.log?.warn?.({ err: error, tagId, workspaceId, impressionId }, 'failed to record viewability');
      });
      if (event) {
        recordEngagementEvent(pool, {
          tag_id: tagId,
          workspace_id: workspaceId,
          creative_id: creativeId ?? null,
          creative_size_variant_id: creativeSizeVariantId ?? null,
          impression_id: impressionId ?? null,
          event_type: String(event),
          ...context,
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
    const {
      ws: workspaceId,
      imp: rawImpressionId,
      c: rawCreativeId,
      csv: rawCreativeSizeVariantId,
      event,
      hd: hoverDurationMs,
    } = req.query;
    const impressionId = normalizeUuid(rawImpressionId);
    const creativeId = normalizeUuid(rawCreativeId);
    const creativeSizeVariantId = normalizeUuid(rawCreativeSizeVariantId);

    if (workspaceId && event) {
      const context = await collectTrackingContext(req, req.query);
      setTrackingIdentityCookies(reply, context);
      recordEngagementEvent(pool, {
        tag_id: tagId,
        workspace_id: workspaceId,
        creative_id: creativeId ?? null,
        creative_size_variant_id: creativeSizeVariantId ?? null,
        impression_id: impressionId ?? null,
        event_type: String(event),
        hover_duration_ms: hoverDurationMs ?? null,
        ...context,
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
