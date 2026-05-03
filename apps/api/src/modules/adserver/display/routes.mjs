import { getPool } from '@smx/db/src/pool.mjs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function trimText(value) {
  return String(value ?? '').trim();
}

function isValidTagId(id) {
  return UUID_RE.test(String(id ?? ''));
}

function escapeScriptContext(jsonStr) {
  return jsonStr.replace(/<\//g, '<\\/');
}

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

async function resolveActiveCreativeForTag(pool, tagId) {
  if (!pool || !tagId) return null;
  try {
    const { rows } = await pool.query(
       `SELECT
         t.id            AS tag_id,
         t.frequency_cap,
         t.frequency_cap_window,
         t.omid_verification_vendor,
         t.omid_verification_js_url,
         t.omid_verification_params,
         COALESCE(tfc.display_width, 0)  AS width,
         COALESCE(tfc.display_height, 0) AS height,
         b.id AS binding_id,
         b.weight,
         b.created_at AS binding_created_at,
         cv.public_url,
         cv.entry_path,
         cv.source_kind,
         cv.serving_format,
         c.click_url     AS creative_click_url
       FROM ad_tags t
       LEFT JOIN tag_format_configs tfc ON tfc.tag_id = t.id
       JOIN creative_tag_bindings b
         ON b.tag_id = t.id
        AND b.status = 'active'
        AND (b.start_at IS NULL OR b.start_at <= NOW())
        AND (b.end_at   IS NULL OR b.end_at   >= NOW())
       JOIN creative_versions cv
         ON cv.id = b.creative_version_id
             AND cv.status IN ('published', 'approved', 'draft')
       JOIN creatives c ON c.id = cv.creative_id
       WHERE t.id = $1
         AND t.status = 'active'
       ORDER BY b.created_at DESC NULLS LAST`,
      [tagId],
    );
    return pickWeightedCreativeRow(rows);
  } catch {
    return null;
  }
}

export function buildDisplayHtml({ creativeUrl, width, height, clickTrackerUrl, impressionUrl, clickUrl, omidVerification }) {
  const w = Number(width) || 300;
  const h = Number(height) || 250;
  const safeCreativeUrl = trimText(creativeUrl);
  const safeClickTracker = trimText(clickTrackerUrl);
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
  const trackedClickTag = safeClickTracker
    ? (safeClickUrl
        ? `${safeClickTracker}?url=${encodeURIComponent(safeClickUrl)}`
        : safeClickTracker)
    : safeClickUrl;
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
  sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation"
></iframe>
<script>
(function(){
  ${safeImpressionJs ? `(new Image()).src = ${safeImpressionJs};` : '// impression suppressed'}

  var clickTracker = ${safeClickTrackerJs};
  var injectedClickTag = ${trackedClickTag ? escapeScriptContext(JSON.stringify(trackedClickTag)) : 'null'};
  var frame = document.getElementById('smx-creative-frame');
  if (frame && injectedClickTag) {
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
        var t = clickTracker + (clickTracker.indexOf('?') === -1 ? '?' : '&') + 'url=' + encodeURIComponent(resolvedClickUrl || clickTracker);
        if (navigator.sendBeacon) {
          navigator.sendBeacon(t);
        } else {
          (new Image()).src = t;
        }
      }
      if (navigateTo) {
        try { window.top.location.href = navigateTo; } catch(_) { window.open(navigateTo, '_blank'); }
      }
    } catch(_) {}
  });
})();
</script>
</body>
</html>`;
}

function buildDisplayJs({ displayHtmlUrl, width, height }) {
  const w = Number(width) || 300;
  const h = Number(height) || 250;

  return `(function(){
  var src = ${escapeScriptContext(JSON.stringify(displayHtmlUrl))};
  var w   = ${JSON.stringify(String(w))};
  var h   = ${JSON.stringify(String(h))};
  var script = document.currentScript;
  if (!script) return;
  var parent = script.parentNode;
  if (!parent) return;
  var iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.width  = w;
  iframe.height = h;
  iframe.scrolling = 'no';
  iframe.frameBorder = '0';
  iframe.marginWidth  = '0';
  iframe.marginHeight = '0';
  iframe.style.border   = '0';
  iframe.style.overflow = 'hidden';
  iframe.style.display  = 'block';
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation');
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
    const row = await resolveActiveCreativeForTag(pool, tagId);

    if (!row) {
      return sendHtml(res, '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><!-- smx: no content --></body></html>');
    }

    const baseUrl = resolveBaseUrl(ctx);
    const suppressImpression = url.searchParams.get('smx_no_imp') === '1';
    const impressionUrl = suppressImpression ? '' : `${baseUrl}/v1/tags/tracker/${tagId}/impression.gif`;
    const clickTrackerUrl = `${baseUrl}/v1/tags/tracker/${tagId}/click`;
    const resolvedClickUrl = trimText(row.creative_click_url) || '';

    const html = buildDisplayHtml({
      creativeUrl: row.public_url ?? '',
      width: row.width,
      height: row.height,
      clickTrackerUrl,
      impressionUrl,
      clickUrl: resolvedClickUrl,
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
    const row = await resolveActiveCreativeForTag(pool, tagId);

    const baseUrl = resolveBaseUrl(ctx);
    const displayHtmlUrl = `${baseUrl}/v1/tags/display/${tagId}.html`;
    const width = row?.width || 300;
    const height = row?.height || 250;

    return sendJs(res, buildDisplayJs({ displayHtmlUrl, width, height }));
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
    const row = await resolveActiveCreativeForTag(pool, tagId);

    const baseUrl = resolveBaseUrl(ctx);
    const displayHtmlUrl = `${baseUrl}/v1/tags/display/${tagId}.html`;
    const width = row?.width || 300;
    const height = row?.height || 250;

    return sendJs(res, buildDisplayJs({ displayHtmlUrl, width, height }));
  }

  return false;
}
