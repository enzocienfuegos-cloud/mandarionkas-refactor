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
  const origin = trimText(req?.headers?.origin);
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.removeHeader('Access-Control-Allow-Credentials');
  }
  res.setHeader('Vary', 'Origin');
}

function sendHtml(res, html, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-Frame-Options', 'ALLOWALL');
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

async function resolveActiveCreativeForTag(pool, tagId) {
  if (!pool || !tagId) return null;
  try {
    const { rows } = await pool.query(
      `SELECT
         t.id            AS tag_id,
         t.click_url,
         t.frequency_cap,
         t.frequency_cap_window,
         COALESCE(tfc.display_width, 0)  AS width,
         COALESCE(tfc.display_height, 0) AS height,
         cv.public_url,
         cv.entry_path,
         cv.source_kind,
         cv.serving_format
       FROM ad_tags t
       LEFT JOIN tag_format_configs tfc ON tfc.tag_id = t.id
       LEFT JOIN creative_tag_bindings b
              ON b.tag_id = t.id
             AND b.status = 'active'
             AND (b.start_at IS NULL OR b.start_at <= NOW())
             AND (b.end_at   IS NULL OR b.end_at   >= NOW())
       LEFT JOIN creative_versions cv
              ON cv.id = b.creative_version_id
             AND cv.status = 'published'
       WHERE t.id = $1
         AND t.status = 'active'
       ORDER BY b.weight DESC NULLS LAST, b.created_at DESC NULLS LAST
       LIMIT 1`,
      [tagId],
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

function buildDisplayHtml({ creativeUrl, width, height, clickTrackerUrl, impressionUrl }) {
  const w = Number(width) || 300;
  const h = Number(height) || 250;
  const safeCreativeUrl = trimText(creativeUrl);
  const safeClickTracker = trimText(clickTrackerUrl);
  const safeImpression = trimText(impressionUrl);

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
</head>
<body>
<iframe
  id="smx-creative-frame"
  src="${safeCreativeUrl}"
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
  window.addEventListener('message', function(e) {
    try {
      var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (!data || data.type !== 'smx:exit') return;
      var dest = (typeof data.url === 'string' && data.url) ? data.url : '';
      if (clickTracker) {
        var t = clickTracker + (clickTracker.indexOf('?') === -1 ? '?' : '&') + 'url=' + encodeURIComponent(dest || clickTracker);
        (new Image()).src = t;
      }
      if (dest) {
        try { window.top.location.href = dest; } catch(_) { window.open(dest, '_blank'); }
      } else if (clickTracker) {
        try { window.top.location.href = clickTracker; } catch(_) { window.open(clickTracker, '_blank'); }
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

    const html = buildDisplayHtml({
      creativeUrl: row.public_url ?? '',
      width: row.width,
      height: row.height,
      clickTrackerUrl,
      impressionUrl,
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
