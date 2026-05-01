import { getPool } from '../../../../../../packages/db/src/pool.mjs';
import { recordClick, recordEngagement, recordImpression } from '../../../../../../packages/db/src/tracking.mjs';
import { getTagClickDestination } from '../../../../../../packages/db/src/vast.mjs';
import { logWarn } from '../../../lib/logger.mjs';

const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64',
);

function applyPublicCors(req, res) {
  const origin = String(req?.headers?.origin ?? '').trim();
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.removeHeader('Access-Control-Allow-Credentials');
  }
  res.setHeader('Vary', 'Origin');
}

function trimText(value) {
  return String(value ?? '').trim();
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

export function createTrackerRoutes(buffer = null) {
  return async function handleTrackerDeliveryRoutes(ctx) {
    const { method, pathname, res, req, requestId, url, env } = ctx;

    if (method === 'OPTIONS' && /^\/v1\/tags\/tracker\//.test(pathname)) {
      applyPublicCors(req, res);
      res.statusCode = 204;
      res.end();
      return true;
    }

    if (method === 'GET' && /^\/v1\/tags\/tracker\/[^/]+\/impression\.gif$/.test(pathname)) {
      const tagId = pathname.split('/')[4];
      applyPublicCors(req, res);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Content-Length', PIXEL_GIF.length);
      res.setHeader('Cache-Control', 'private, no-store');
      res.end(PIXEL_GIF);
      queueImpressionWrite(buffer, getDatabasePool(env), tagId, requestId);
      return true;
    }

    if (method === 'GET' && /^\/v1\/tags\/tracker\/[^/]+\/engagement$/.test(pathname)) {
      const tagId = pathname.split('/')[4];
      const event = trimText(url.searchParams.get('event'));
      const playhead = Number(url.searchParams.get('t') || url.searchParams.get('playhead') || 0);

      applyPublicCors(req, res);
      res.statusCode = 204;
      res.setHeader('Cache-Control', 'private, no-store');
      res.end();

      if (event) queueEngagementWrite(buffer, getDatabasePool(env), tagId, event, playhead, requestId);
      return true;
    }

    if (method === 'GET' && /^\/v1\/tags\/tracker\/[^/]+\/click$/.test(pathname)) {
      const tagId = pathname.split('/')[4];
      const explicitTarget = trimText(url.searchParams.get('url'));
      const pool = getDatabasePool(env);
      const destination =
        explicitTarget ||
        (pool ? await getTagClickDestination(pool, tagId).catch(() => null) : null) ||
        resolveBaseUrl(ctx);

      applyPublicCors(req, res);
      res.statusCode = 302;
      res.setHeader('Location', destination);
      res.setHeader('Cache-Control', 'private, no-store');
      res.end();

      queueClickWrite(buffer, pool, tagId, requestId);
      return true;
    }

    return false;
  };
}

function queueImpressionWrite(buffer, pool, tagId, requestId) {
  if (buffer) {
    buffer.addImpression(tagId);
    return;
  }
  if (!pool) return;
  recordImpression(pool, tagId).catch((err) =>
    logWarn({ service: 'smx-tracker', fn: 'queueImpressionWrite', tagId, requestId, message: err?.message }),
  );
}

function queueClickWrite(buffer, pool, tagId, requestId) {
  if (buffer) {
    buffer.addClick(tagId);
    return;
  }
  if (!pool) return;
  recordClick(pool, tagId).catch((err) =>
    logWarn({ service: 'smx-tracker', fn: 'queueClickWrite', tagId, requestId, message: err?.message }),
  );
}

function queueEngagementWrite(buffer, pool, tagId, eventType, durationMs, requestId) {
  if (buffer) {
    buffer.addEngagement(tagId, eventType, durationMs);
    return;
  }
  if (!pool) return;
  recordEngagement(pool, tagId, eventType, durationMs).catch((err) =>
    logWarn({
      service: 'smx-tracker',
      fn: 'queueEngagementWrite',
      tagId,
      eventType,
      requestId,
      message: err?.message,
    }),
  );
}
