import { getTagServingSnapshot } from '@smx/db/tags';

const BASE_URL = process.env.BASE_URL ?? 'https://api.smxstudio.io';

function buildVastXml(tag, workspaceId, baseUrl) {
  const tagId = tag.id;
  const servingCandidate = tag.servingCandidate ?? null;
  const creativeId = servingCandidate?.creativeVersionId ?? servingCandidate?.creativeId ?? 'no-creative';
  const videoUrl = servingCandidate?.publicUrl ?? '';
  const clickUrl = servingCandidate?.clickUrl ?? '';
  const duration = servingCandidate?.durationMs
    ? formatDuration(servingCandidate.durationMs)
    : '00:00:30';
  const width = servingCandidate?.width ?? 1920;
  const height = servingCandidate?.height ?? 1080;
  const impressionUrl = `${baseUrl}/track/impression/${tagId}?ws=${workspaceId}`;
  const trackingBase = `${baseUrl}/track`;

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
              <Tracking event="start"><![CDATA[${trackingBase}/viewability/${tagId}?ws=${workspaceId}&event=start]]></Tracking>
              <Tracking event="firstQuartile"><![CDATA[${trackingBase}/viewability/${tagId}?ws=${workspaceId}&event=firstQuartile]]></Tracking>
              <Tracking event="midpoint"><![CDATA[${trackingBase}/viewability/${tagId}?ws=${workspaceId}&event=midpoint]]></Tracking>
              <Tracking event="thirdQuartile"><![CDATA[${trackingBase}/viewability/${tagId}?ws=${workspaceId}&event=thirdQuartile]]></Tracking>
              <Tracking event="complete"><![CDATA[${trackingBase}/viewability/${tagId}?ws=${workspaceId}&event=complete]]></Tracking>
            </TrackingEvents>
            <VideoClicks>
              <ClickThrough><![CDATA[${clickUrl}]]></ClickThrough>
              <ClickTracking><![CDATA[${trackingBase}/click/${tagId}?ws=${workspaceId}]]></ClickTracking>
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
  const width = servingCandidate?.width ?? 300;
  const height = servingCandidate?.height ?? 250;
  const clickUrl = servingCandidate?.clickUrl ?? '#';
  const impressionUrl = `${baseUrl}/track/impression/${tagId}?ws=${workspaceId}`;
  const clickTrackUrl = `${baseUrl}/track/click/${tagId}?ws=${workspaceId}&url=${encodeURIComponent(clickUrl)}`;
  const creativeUrl = servingCandidate?.publicUrl ?? '';

  return `(function() {
  var ws = ${JSON.stringify(workspaceId)};
  var tagId = ${JSON.stringify(tagId)};
  var baseUrl = ${JSON.stringify(baseUrl)};
  var w = ${width}, h = ${height};
  var clickUrl = ${JSON.stringify(clickTrackUrl)};
  var creativeUrl = ${JSON.stringify(creativeUrl)};
  var impUrl = ${JSON.stringify(impressionUrl)};

  // Record impression
  (new Image()).src = impUrl;

  // Build container
  var div = document.createElement('div');
  div.style.cssText = 'width:' + w + 'px;height:' + h + 'px;overflow:hidden;position:relative;display:inline-block;';

  var link = document.createElement('a');
  link.href = clickUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  if (creativeUrl) {
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

export function handleVastRoutes(app, { requireWorkspace, requireApiKey, pool }) {
  // Middleware that accepts either session auth OR api key
  async function flexibleAuth(req, reply) {
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
    return reply.status(401).send({ error: 'Unauthorized', message: 'Session or API key required' });
  }

  // GET /v1/vast/tags/:tagId — serve VAST XML for a tag
  app.get('/v1/vast/tags/:tagId', { preHandler: flexibleAuth }, async (req, reply) => {
    const { workspaceId } = req.authSession ?? req.apiKeyAuth ?? {};
    const { tagId } = req.params;

    if (!workspaceId) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const tag = await getTagServingSnapshot(pool, workspaceId, tagId);
    if (!tag) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    if (tag.format !== 'vast' && tag.format !== 'vast_video') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Tag format is "${tag.format}", not a VAST format`,
      });
    }

    const xml = buildVastXml(tag, workspaceId, BASE_URL);

    reply.header('Content-Type', 'application/xml; charset=utf-8');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('X-Content-Type-Options', 'nosniff');
    return reply.send(xml);
  });

  // GET /v1/vast/display/:tagId — serve display tag snippet (JS)
  app.get('/v1/vast/display/:tagId', { preHandler: flexibleAuth }, async (req, reply) => {
    const { workspaceId } = req.authSession ?? req.apiKeyAuth ?? {};
    const { tagId } = req.params;

    if (!workspaceId) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const tag = await getTagServingSnapshot(pool, workspaceId, tagId);
    if (!tag) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    const snippet = buildDisplaySnippet(tag, workspaceId, BASE_URL);

    reply.header('Content-Type', 'application/javascript; charset=utf-8');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    return reply.send(snippet);
  });
}
