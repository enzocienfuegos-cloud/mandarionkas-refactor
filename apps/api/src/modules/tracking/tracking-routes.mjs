import {
  recordImpression,
  recordClick,
  recordViewability,
  recordEngagementEvent,
} from '@smx/db/tracking';

const PIXEL_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

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

function inferGeo(req, query = {}) {
  const header = (name) => {
    const value = req.headers[name];
    return Array.isArray(value) ? value[0] : value;
  };
  const country = String(
    query.ct
    || header('cf-ipcountry')
    || header('x-vercel-ip-country')
    || header('x-appengine-country')
    || '',
  ).trim().toUpperCase().slice(0, 2) || null;
  const region = String(
    query.rg
    || header('x-vercel-ip-country-region')
    || header('x-appengine-region')
    || '',
  ).trim() || null;
  return { country, region };
}

function collectTrackingContext(req, query = {}) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? req.ip ?? null;
  const userAgent = req.headers['user-agent'] ?? null;
  const referer = req.headers['referer'] ?? req.headers['referrer'] ?? null;
  const pageContext = parseSiteContext(query.pu);
  const refererContext = parseSiteContext(referer);
  const requestHost = resolveRequestHost(req);
  const selectedContext =
    (pageContext?.siteDomain && pageContext.siteDomain !== requestHost ? pageContext : null)
    ?? (refererContext?.siteDomain && refererContext.siteDomain !== requestHost ? refererContext : null)
    ?? pageContext
    ?? refererContext
    ?? { pageUrl: null, siteDomain: null };
  const geo = inferGeo(req, query);
  const country = geo.country ?? null;
  const region = geo.region ?? null;
  const { deviceType, browser, os } = inferDeviceInfo(userAgent);
  const cookieDeviceId = req.cookies?.smx_device_id ?? req.cookies?.device_id ?? null;
  const cookieCookieId = req.cookies?.smx_cookie_id ?? req.cookies?.cookie_id ?? null;
  return {
    ip,
    user_agent: userAgent,
    referer,
    page_url: selectedContext.pageUrl,
    site_domain: selectedContext.siteDomain,
    country,
    region,
    device_type: deviceType,
    browser,
    os,
    device_id: String(query.did ?? req.headers['x-device-id'] ?? cookieDeviceId ?? '').trim() || null,
    cookie_id: String(query.cid ?? req.headers['x-cookie-id'] ?? cookieCookieId ?? '').trim() || null,
  };
}

export function handleTrackingRoutes(app, { pool }) {
  // GET /track/impression/:tagId — records impression, returns 1x1 transparent GIF
  app.get('/track/impression/:tagId', async (req, reply) => {
    const { tagId } = req.params;
    const { ws: workspaceId, imp: impressionId, c: creativeId, csv: creativeSizeVariantId } = req.query;

    if (!workspaceId) {
      // Still return pixel, just don't record
      reply.header('Content-Type', 'image/gif');
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');
      return reply.send(PIXEL_GIF);
    }

    const context = collectTrackingContext(req, req.query);

    // Fire-and-forget — don't block pixel response
      recordImpression(pool, {
        impression_id: impressionId ?? null,
        tag_id: tagId,
        workspace_id: workspaceId,
        creative_id: creativeId ?? null,
        creative_size_variant_id: creativeSizeVariantId ?? null,
        ...context,
    }).catch(() => {});

    reply.header('Content-Type', 'image/gif');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
    return reply.send(PIXEL_GIF);
  });

  // GET /track/click/:tagId — records click, redirects to clickUrl
  app.get('/track/click/:tagId', async (req, reply) => {
    const { tagId } = req.params;
    const { ws: workspaceId, url: destinationUrl, imp: impressionId, c: creativeId, csv: creativeSizeVariantId, pu: pageUrl } = req.query;

    const context = collectTrackingContext(req, req.query);

    if (workspaceId) {
      // Fire-and-forget
      recordClick(pool, {
        tag_id: tagId,
        workspace_id: workspaceId,
        creative_id: creativeId ?? null,
        creative_size_variant_id: creativeSizeVariantId ?? null,
        impression_id: impressionId ?? null,
        redirect_url: destinationUrl ?? null,
        ...context,
      }).catch(() => {});
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
    const { ws: workspaceId, vp, imp: impressionId, c: creativeId, csv: creativeSizeVariantId, event, state, method, ms } = req.query;

    if (workspaceId) {
      const viewable = vp !== '0' && vp !== 'false';
      const context = collectTrackingContext(req, req.query);
      recordViewability(pool, {
        tag_id: tagId,
        workspace_id: workspaceId,
        impression_id: impressionId ?? null,
        viewable,
        state: state ?? (viewable ? 'viewable' : 'measured'),
        method: method ?? null,
        duration_ms: ms ?? null,
      }).catch(() => {});
      if (event) {
        recordEngagementEvent(pool, {
          tag_id: tagId,
          workspace_id: workspaceId,
          creative_id: creativeId ?? null,
          creative_size_variant_id: creativeSizeVariantId ?? null,
          impression_id: impressionId ?? null,
          event_type: String(event),
          ...context,
        }).catch(() => {});
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
      imp: impressionId,
      c: creativeId,
      csv: creativeSizeVariantId,
      event,
      hd: hoverDurationMs,
    } = req.query;

    if (workspaceId && event) {
      const context = collectTrackingContext(req, req.query);
      recordEngagementEvent(pool, {
        tag_id: tagId,
        workspace_id: workspaceId,
        creative_id: creativeId ?? null,
        creative_size_variant_id: creativeSizeVariantId ?? null,
        impression_id: impressionId ?? null,
        event_type: String(event),
        hover_duration_ms: hoverDurationMs ?? null,
        ...context,
      }).catch(() => {});
    }

    reply.header('Content-Type', 'image/gif');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
    return reply.send(PIXEL_GIF);
  });
}
