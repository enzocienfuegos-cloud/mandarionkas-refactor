import {
  recordImpression,
  recordClick,
  recordViewability,
} from '@smx/db/tracking';

const PIXEL_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

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

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? req.ip ?? null;
    const userAgent = req.headers['user-agent'] ?? null;
    const referer = req.headers['referer'] ?? req.headers['referrer'] ?? null;

    // Fire-and-forget — don't block pixel response
      recordImpression(pool, {
        tag_id: tagId,
        workspace_id: workspaceId,
        creative_id: creativeId ?? null,
        creative_size_variant_id: creativeSizeVariantId ?? null,
        ip,
        user_agent: userAgent,
        referer,
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
    const { ws: workspaceId, url: destinationUrl, imp: impressionId, c: creativeId, csv: creativeSizeVariantId } = req.query;

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? req.ip ?? null;
    const userAgent = req.headers['user-agent'] ?? null;
    const referer = req.headers['referer'] ?? req.headers['referrer'] ?? null;

    if (workspaceId) {
      // Fire-and-forget
      recordClick(pool, {
        tag_id: tagId,
        workspace_id: workspaceId,
        creative_id: creativeId ?? null,
        creative_size_variant_id: creativeSizeVariantId ?? null,
        impression_id: impressionId ?? null,
        ip,
        user_agent: userAgent,
        referer,
        redirect_url: destinationUrl ?? null,
      }).catch(() => {});
    }

    if (destinationUrl) {
      // Validate destination URL to prevent open redirect abuse
      let safeUrl;
      try {
        safeUrl = new URL(destinationUrl);
        if (safeUrl.protocol !== 'http:' && safeUrl.protocol !== 'https:') {
          return reply.status(400).send({ error: 'Bad Request', message: 'Invalid destination URL' });
        }
      } catch {
        return reply.status(400).send({ error: 'Bad Request', message: 'Invalid destination URL' });
      }
      return reply.redirect(302, safeUrl.toString());
    }

    // No URL provided — return a 204
    return reply.status(204).send();
  });

  // GET /track/viewability/:tagId — records viewability event
  app.get('/track/viewability/:tagId', async (req, reply) => {
    const { tagId } = req.params;
    const { ws: workspaceId, vp, imp: impressionId } = req.query;

    if (workspaceId) {
      const viewable = vp !== '0' && vp !== 'false';
      recordViewability(pool, {
        tag_id: tagId,
        workspace_id: workspaceId,
        impression_id: impressionId ?? null,
        viewable,
      }).catch(() => {});
    }

    reply.header('Content-Type', 'image/gif');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
    return reply.send(PIXEL_GIF);
  });
}
