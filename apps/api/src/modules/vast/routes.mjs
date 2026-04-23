import { getTagServingSnapshot, getTagServingSnapshotById } from '@smx/db/tags';

const BASE_URL = (process.env.BASE_URL ?? '').trim();

function resolveBaseUrl(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] ?? '').split(',')[0].trim();
  const host = String(req.headers.host ?? '').trim();
  const proto = forwardedProto || (host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  const authority = forwardedHost || host;

  if (authority) return `${proto}://${authority}`;
  if (BASE_URL) return BASE_URL.replace(/\/$/, '');
  return 'http://localhost:4000';
}

function readRequestedSize(query = {}) {
  const width = Number(query?.width ?? query?.w ?? 0);
  const height = Number(query?.height ?? query?.h ?? 0);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return null;
  }
  return { width, height };
}

function buildVastXml(tag, workspaceId, baseUrl) {
  const tagId = tag.id;
  const servingCandidate = tag.servingCandidate ?? null;
  const creativeId = servingCandidate?.creativeId ?? 'no-creative';
  const creativeSizeVariantId = servingCandidate?.creativeSizeVariantId ?? null;
  const videoUrl = servingCandidate?.publicUrl ?? '';
  const clickUrl = servingCandidate?.clickUrl ?? '';
  const duration = servingCandidate?.durationMs
    ? formatDuration(servingCandidate.durationMs)
    : '00:00:30';
  const width = servingCandidate?.width ?? 1920;
  const height = servingCandidate?.height ?? 1080;
  const trackingParams = new URLSearchParams({ ws: String(workspaceId) });
  if (creativeId) trackingParams.set('c', String(creativeId));
  if (creativeSizeVariantId) trackingParams.set('csv', String(creativeSizeVariantId));
  const impressionUrl = `${baseUrl}/track/impression/${tagId}?${trackingParams.toString()}`;
  const trackingBase = `${baseUrl}/track`;
  const clickTrackingParams = new URLSearchParams(trackingParams);

  return `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="4.0" xmlns="http://www.iab.com/VAST" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <Ad id="${tagId}">
    <InLine>
      <AdSystem><![CDATA[SMX Studio]]></AdSystem>
      <AdTitle><![CDATA[${escapeXml(tag.name)}]]></AdTitle>
      <Impression id="smx-imp"><![CDATA[${impressionUrl}]]></Impression>
      <Creatives>
        <Creative id="${creativeId}" sequence="1">
          <Linear>
            <Duration>${duration}</Duration>
            <TrackingEvents>
              <Tracking event="start"><![CDATA[${trackingBase}/viewability/${tagId}?${trackingParams.toString()}&event=start]]></Tracking>
              <Tracking event="firstQuartile"><![CDATA[${trackingBase}/viewability/${tagId}?${trackingParams.toString()}&event=firstQuartile]]></Tracking>
              <Tracking event="midpoint"><![CDATA[${trackingBase}/viewability/${tagId}?${trackingParams.toString()}&event=midpoint]]></Tracking>
              <Tracking event="thirdQuartile"><![CDATA[${trackingBase}/viewability/${tagId}?${trackingParams.toString()}&event=thirdQuartile]]></Tracking>
              <Tracking event="complete"><![CDATA[${trackingBase}/viewability/${tagId}?${trackingParams.toString()}&event=complete]]></Tracking>
            </TrackingEvents>
            <VideoClicks>
              <ClickThrough><![CDATA[${clickUrl}]]></ClickThrough>
              <ClickTracking><![CDATA[${trackingBase}/click/${tagId}?${clickTrackingParams.toString()}]]></ClickTracking>
            </VideoClicks>
            <MediaFiles>
              <MediaFile delivery="progressive" type="video/mp4" width="${width}" height="${height}">
                <![CDATA[${videoUrl}]]>
              </MediaFile>
            </MediaFiles>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>`;
}

function formatDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':');
}

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildDisplaySnippet(tag, workspaceId, baseUrl) {
  const tagId = tag.id;
  const servingCandidate = tag.servingCandidate ?? null;
  const servingFormat = servingCandidate?.servingFormat ?? '';
  const width = servingCandidate?.width ?? 300;
  const height = servingCandidate?.height ?? 250;
  const clickUrl = servingCandidate?.clickUrl ?? '#';
  const trackingParams = new URLSearchParams({ ws: String(workspaceId) });
  if (servingCandidate?.creativeId) trackingParams.set('c', String(servingCandidate.creativeId));
  if (servingCandidate?.creativeSizeVariantId) trackingParams.set('csv', String(servingCandidate.creativeSizeVariantId));
  const impressionUrl = `${baseUrl}/track/impression/${tagId}?${trackingParams.toString()}`;
  const clickTrackParams = new URLSearchParams(trackingParams);
  clickTrackParams.set('url', clickUrl);
  const clickTrackUrl = `${baseUrl}/track/click/${tagId}?${clickTrackParams.toString()}`;
  const engagementBase = `${baseUrl}/track/engagement/${tagId}?${trackingParams.toString()}`;
  const creativeUrl = servingCandidate?.publicUrl ?? '';

  return `(function() {
  var ws = ${JSON.stringify(workspaceId)};
  var tagId = ${JSON.stringify(tagId)};
  var baseUrl = ${JSON.stringify(baseUrl)};
  var w = ${width}, h = ${height};
  var servingFormat = ${JSON.stringify(servingFormat)};
  var clickUrl = ${JSON.stringify(clickTrackUrl)};
  var creativeUrl = ${JSON.stringify(creativeUrl)};
  var impUrl = ${JSON.stringify(impressionUrl)};
  var engagementBase = ${JSON.stringify(engagementBase)};
  var pageUrl = (typeof window !== 'undefined' && window.location && window.location.href) ? window.location.href : '';
  var hoverStartedAt = null;

  function firePixel(url) {
    var img = new Image();
    img.src = url;
  }

  function buildEngagementUrl(eventType, extra) {
    var params = [];
    params.push('event=' + encodeURIComponent(eventType));
    if (pageUrl) params.push('pu=' + encodeURIComponent(pageUrl));
    if (extra && extra.hd != null) params.push('hd=' + encodeURIComponent(String(extra.hd)));
    return engagementBase + '&' + params.join('&');
  }

  // Record impression
  firePixel(impUrl + (pageUrl ? '&pu=' + encodeURIComponent(pageUrl) : ''));

  // Build container
  var div = document.createElement('div');
  div.style.cssText = 'width:' + w + 'px;height:' + h + 'px;overflow:hidden;position:relative;display:inline-block;';
  div.addEventListener('mouseenter', function() {
    hoverStartedAt = Date.now();
    firePixel(buildEngagementUrl('hover_start'));
  });
  div.addEventListener('mouseleave', function() {
    var duration = hoverStartedAt ? Math.max(0, Date.now() - hoverStartedAt) : 0;
    hoverStartedAt = null;
    firePixel(buildEngagementUrl('hover_end', { hd: duration }));
  });

  var link = document.createElement('a');
  link.href = clickUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.addEventListener('click', function() {
    firePixel(buildEngagementUrl('interaction'));
  });

  if (creativeUrl && servingFormat === 'display_html') {
    var iframe = document.createElement('iframe');
    iframe.src = creativeUrl;
    iframe.width = String(w);
    iframe.height = String(h);
    iframe.scrolling = 'no';
    iframe.frameBorder = '0';
    iframe.style.border = '0';
    iframe.style.overflow = 'hidden';
    div.appendChild(iframe);
  } else if (creativeUrl) {
    var img = document.createElement('img');
    img.src = creativeUrl;
    img.width = w;
    img.height = h;
    img.alt = '';
    img.style.display = 'block';
    link.appendChild(img);
  } else {
    var placeholder = document.createElement('div');
    placeholder.style.cssText = 'width:' + w + 'px;height:' + h + 'px;background:#eee;display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#999;font-size:12px;';
    placeholder.textContent = 'Advertisement';
    link.appendChild(placeholder);
  }

  div.appendChild(link);

  // Inject into current script's parent
  var scripts = document.getElementsByTagName('script');
  var currentScript = scripts[scripts.length - 1];
  if (currentScript && currentScript.parentNode) {
    currentScript.parentNode.insertBefore(div, currentScript);
  }
})();`;
}

function buildDisplayDocument(tag, workspaceId, baseUrl) {
  const tagId = tag.id;
  const servingCandidate = tag.servingCandidate ?? null;
  const servingFormat = servingCandidate?.servingFormat ?? '';
  const width = servingCandidate?.width ?? 300;
  const height = servingCandidate?.height ?? 250;
  const clickUrl = servingCandidate?.clickUrl ?? '#';
  const trackingParams = new URLSearchParams({ ws: String(workspaceId) });
  if (servingCandidate?.creativeId) trackingParams.set('c', String(servingCandidate.creativeId));
  if (servingCandidate?.creativeSizeVariantId) trackingParams.set('csv', String(servingCandidate.creativeSizeVariantId));
  const impressionUrl = `${baseUrl}/track/impression/${tagId}?${trackingParams.toString()}`;
  const clickTrackParams = new URLSearchParams(trackingParams);
  clickTrackParams.set('url', clickUrl);
  const clickTrackUrl = `${baseUrl}/track/click/${tagId}?${clickTrackParams.toString()}`;
  const engagementBase = `${baseUrl}/track/engagement/${tagId}?${trackingParams.toString()}`;
  const creativeUrl = servingCandidate?.publicUrl ?? '';

  const body = creativeUrl && servingFormat === 'display_html'
    ? `<iframe src="${escapeXml(creativeUrl)}" width="${width}" height="${height}" scrolling="no" frameborder="0" style="display:block;border:0;overflow:hidden;width:100%;height:100%;"></iframe>`
    : creativeUrl
    ? `<a href="${escapeXml(clickTrackUrl)}" target="_blank" rel="noopener noreferrer" style="display:block;width:100%;height:100%;">
  <img src="${escapeXml(creativeUrl)}" width="${width}" height="${height}" alt="" style="display:block;border:0;width:100%;height:100%;" />
</a>`
    : `<a href="${escapeXml(clickTrackUrl)}" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#eee;color:#999;font:12px sans-serif;text-decoration:none;">
  Advertisement
</a>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeXml(tag.name)}</title>
  </head>
  <body style="margin:0;padding:0;overflow:hidden;width:${width}px;height:${height}px;">
    ${body}
    <img id="smx-imp-pixel" src="${escapeXml(impressionUrl)}" alt="" width="1" height="1" style="position:absolute;left:-9999px;top:-9999px;" />
    <script>
      (function() {
        var pageUrl = (window.location && window.location.href) ? window.location.href : '';
        var hoverStartedAt = null;
        function fire(url) {
          var img = new Image();
          img.src = url;
        }
        var impPixel = document.getElementById('smx-imp-pixel');
        if (impPixel && pageUrl) {
          impPixel.src = ${JSON.stringify(impressionUrl)} + '&pu=' + encodeURIComponent(pageUrl);
        }
        function engagementUrl(eventType, hoverDurationMs) {
          var params = ['event=' + encodeURIComponent(eventType)];
          if (pageUrl) params.push('pu=' + encodeURIComponent(pageUrl));
          if (hoverDurationMs != null) params.push('hd=' + encodeURIComponent(String(hoverDurationMs)));
          return ${JSON.stringify(engagementBase)} + '&' + params.join('&');
        }
        document.body.addEventListener('mouseenter', function() {
          hoverStartedAt = Date.now();
          fire(engagementUrl('hover_start'));
        });
        document.body.addEventListener('mouseleave', function() {
          var duration = hoverStartedAt ? Math.max(0, Date.now() - hoverStartedAt) : 0;
          hoverStartedAt = null;
          fire(engagementUrl('hover_end', duration));
        });
        document.body.addEventListener('click', function() {
          fire(engagementUrl('interaction'));
        });
      })();
    </script>
  </body>
</html>`;
}

async function loadDisplayTag(req, reply, pool) {
  const { workspaceId } = req.authSession ?? req.apiKeyAuth ?? {};
  const { tagId } = req.params;
  const tag = workspaceId
    ? await getTagServingSnapshot(pool, workspaceId, tagId, {
        requestedSize: readRequestedSize(req.query),
      })
    : await getTagServingSnapshotById(pool, tagId, {
        requestedSize: readRequestedSize(req.query),
      });
  if (!tag) {
    reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    return null;
  }

  if (tag.format === 'vast' || tag.format === 'vast_video') {
    reply.status(400).send({
      error: 'Bad Request',
      message: 'Display endpoints cannot serve VAST tags',
    });
    return null;
  }

  return { tag, workspaceId: tag.workspace_id ?? workspaceId };
}

export function handleVastRoutes(app, { requireWorkspace, requireApiKey, pool }) {
  // Middleware that accepts session or api key when present, but does not require either.
  async function optionalAuth(req, reply) {
    // Try session first
    if (req.session?.userId && req.session?.workspaceId) {
      await requireWorkspace(req, reply);
      return;
    }
    // Fall back to API key
    const authHeader = req.headers['authorization'] ?? '';
    if (authHeader.startsWith('Bearer ')) {
      await requireApiKey(req, reply);
      if (req.apiKeyAuth) {
        // Synthesize authSession for downstream handlers
        req.authSession = {
          userId: null,
          workspaceId: req.apiKeyAuth.workspaceId,
          role: 'member',
          email: null,
        };
      }
      return;
    }
  }

  // GET /v1/vast/tags/:tagId — serve VAST XML for a tag
  app.get('/v1/vast/tags/:tagId', { preHandler: optionalAuth }, async (req, reply) => {
    const baseUrl = resolveBaseUrl(req);
    const { workspaceId } = req.authSession ?? req.apiKeyAuth ?? {};
    const { tagId } = req.params;

    const tag = workspaceId
      ? await getTagServingSnapshot(pool, workspaceId, tagId, {
          requestedSize: readRequestedSize(req.query),
        })
      : await getTagServingSnapshotById(pool, tagId, {
          requestedSize: readRequestedSize(req.query),
        });
    if (!tag) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    if (tag.format !== 'vast' && tag.format !== 'vast_video') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Tag format is "${tag.format}", not a VAST format`,
      });
    }

    const xml = buildVastXml(tag, tag.workspace_id ?? workspaceId, baseUrl);

    reply.header('Content-Type', 'application/xml; charset=utf-8');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('X-Content-Type-Options', 'nosniff');
    return reply.send(xml);
  });

  async function serveDisplayJavascript(req, reply) {
    const baseUrl = resolveBaseUrl(req);
    const loaded = await loadDisplayTag(req, reply, pool);
    if (!loaded) return;

    const snippet = buildDisplaySnippet(loaded.tag, loaded.workspaceId, baseUrl);
    reply.header('Content-Type', 'application/javascript; charset=utf-8');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    return reply.send(snippet);
  }

  async function serveDisplayDocument(req, reply) {
    const baseUrl = resolveBaseUrl(req);
    const loaded = await loadDisplayTag(req, reply, pool);
    if (!loaded) return;

    const html = buildDisplayDocument(loaded.tag, loaded.workspaceId, baseUrl);
    reply.header('Content-Type', 'text/html; charset=utf-8');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.removeHeader('X-Frame-Options');
    reply.header('Content-Security-Policy', "default-src 'self' data: blob: https:; img-src * data: blob:; media-src * data: blob:; script-src 'unsafe-inline' https:; style-src 'unsafe-inline' https:;");
    return reply.send(html);
  }

  // Legacy JS endpoint kept for compatibility.
  app.get('/v1/vast/display/:tagId', { preHandler: optionalAuth }, serveDisplayJavascript);
  // Semantically clearer display endpoints for embed snippets.
  app.get('/v1/tags/display/:tagId.js', { preHandler: optionalAuth }, serveDisplayJavascript);
  app.get('/v1/tags/display/:tagId.html', { preHandler: optionalAuth }, serveDisplayDocument);
  // Native currently reuses the display JS renderer until a dedicated native renderer exists.
  app.get('/v1/tags/native/:tagId.js', { preHandler: optionalAuth }, serveDisplayJavascript);
}
