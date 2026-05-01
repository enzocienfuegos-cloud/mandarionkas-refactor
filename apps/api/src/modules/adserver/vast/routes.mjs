import { badRequest, forbidden, sendJson, serviceUnavailable, unauthorized } from '../../../lib/http.mjs';
import { requireAuthenticatedSession } from '../../auth/service.mjs';
import { getPool } from '../../../../../../packages/db/src/pool.mjs';
import {
  getLiveVastXml,
  getStaticVastXml,
  getTagClickDestination,
  getVastDeliveryDiagnostics,
  publishStaticVastProfiles,
  queueStaticVastPublish,
  resolveVastChain,
  validateVastTag,
} from '../../../../../../packages/db/src/vast.mjs';

const PIXEL_GIF = Buffer.from('R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');

function trimText(value) {
  return String(value ?? '').trim();
}

function hasPermission(session, permission) {
  return session.permissions.includes(permission);
}

async function withSession(ctx, callback) {
  const session = await requireAuthenticatedSession({ env: ctx.env, headers: ctx.req.headers });
  if (!session.ok) {
    if (session.statusCode === 503) return serviceUnavailable(ctx.res, ctx.requestId, session.message);
    if (session.statusCode === 401) return unauthorized(ctx.res, ctx.requestId, session.message);
    return false;
  }
  try {
    return await callback(session);
  } finally {
    await session.finish();
  }
}

function resolveBaseUrl(ctx) {
  const explicit = trimText(ctx.env.apiBaseUrl || ctx.env.apiPublicBaseUrl || ctx.env.baseUrl);
  if (explicit) return explicit.replace(/\/+$/, '');
  const protocol = trimText(ctx.req.headers['x-forwarded-proto']) || 'https';
  const host = trimText(ctx.req.headers['x-forwarded-host'] || ctx.req.headers.host);
  return host ? `${protocol}://${host}` : 'https://localhost';
}

function getDatabasePool(env) {
  return getPool(env.databasePoolUrl || env.databaseUrl);
}

function parsePublishProfile(body = {}) {
  const raw = trimText(body.dsp || body.profile || body.targetProfile);
  if (!raw) return 'default';
  const normalized = raw.toLowerCase();
  if (normalized === 'basis') return 'basis';
  if (normalized === 'illumin') return 'illumin';
  if (normalized === 'vast4' || normalized === '4.2') return 'vast4';
  return 'default';
}

function sendXml(res, xml, extraHeaders = {}) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  for (const [key, value] of Object.entries(extraHeaders)) {
    if (value !== undefined && value !== null) res.setHeader(key, value);
  }
  res.end(xml);
  return true;
}

function applyPublicCors(req, res) {
  const origin = trimText(req?.headers?.origin);
  if (origin) {
    // Public VAST/tag delivery endpoints are intentionally readable cross-origin.
    // Some validators fetch them in credentialed mode, which is incompatible with '*'.
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.removeHeader('Access-Control-Allow-Credentials');
  }
  res.setHeader('Vary', 'Origin');
}

export async function handleVastRoutes(ctx) {
  const { method, pathname, body, res, requestId, url } = ctx;
  const baseUrl = resolveBaseUrl(ctx);

  if (method === 'POST' && pathname === '/v1/vast/validate') {
    return withSession(ctx, async () => {
      try {
        const result = await validateVastTag({
          xml: body?.xml ?? body?.vastXml ?? '',
          url: body?.url ?? body?.vastUrl ?? '',
        });
        return sendJson(res, 200, { ...result, requestId });
      } catch (error) {
        return badRequest(res, requestId, error.message || 'Failed to validate VAST.');
      }
    });
  }

  if (method === 'POST' && pathname === '/v1/vast/chain') {
    return withSession(ctx, async () => {
      try {
        const result = await resolveVastChain({
          url: body?.url ?? body?.vastUrl ?? '',
          maxDepth: Number(body?.maxDepth || body?.depth || 10) || 10,
        });
        return sendJson(res, 200, { ...result, requestId });
      } catch (error) {
        return badRequest(res, requestId, error.message || 'Failed to resolve wrapper chain.');
      }
    });
  }

  if (method === 'GET' && /^\/v1\/vast\/tags\/[^/]+$/.test(pathname)) {
    const tagId = pathname.split('/')[4];
    const xml = await getLiveVastXml(getDatabasePool(ctx.env), {
      tagId,
      profile: 'default',
      baseUrl,
    });
    if (!xml) return badRequest(res, requestId, 'Tag not found.');
    applyPublicCors(ctx.req, res);
    return sendXml(res, xml, { 'Cache-Control': 'private, no-store' });
  }

  if (method === 'GET' && /^\/v1\/vast\/tags\/[^/]+\/(default|basis|illumin|vast4)\.xml$/.test(pathname)) {
    const segments = pathname.split('/');
    const tagId = segments[4];
    const profile = segments[5].replace(/\.xml$/i, '');
    const xml = await getLiveVastXml(getDatabasePool(ctx.env), {
      tagId,
      profile,
      baseUrl,
    });
    if (!xml) return badRequest(res, requestId, 'Tag not found.');
    applyPublicCors(ctx.req, res);
    return sendXml(res, xml, { 'Cache-Control': 'private, no-store' });
  }

  if (method === 'GET' && /^\/v1\/vast\/tags\/[^/]+\/static\/(default|basis|illumin)\.xml$/.test(pathname)) {
    const segments = pathname.split('/');
    const tagId = segments[4];
    const profile = segments[6].replace(/\.xml$/i, '');
    const snapshot = await getStaticVastXml(getDatabasePool(ctx.env), {
      tagId,
      profile,
      baseUrl,
    });
    if (!snapshot) return badRequest(res, requestId, 'Tag not found.');
    applyPublicCors(ctx.req, res);
    return sendXml(res, snapshot.xml, {
      ETag: snapshot.etag || undefined,
      'Cache-Control': 'private, max-age=60',
    });
  }

  if (method === 'POST' && /^\/v1\/vast\/tags\/[^/]+\/publish-static$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to publish VAST delivery.');
      }
      const tagId = pathname.split('/')[4];
      const profile = parsePublishProfile(body || {});
      try {
        const state = await publishStaticVastProfiles(session.client, {
          tagId,
          baseUrl,
          profiles: [profile],
          trigger: 'manual_publish',
        });
        return sendJson(res, 200, { ok: true, state, requestId });
      } catch (error) {
        return badRequest(res, requestId, error.message || 'Failed to publish static VAST delivery.');
      }
    });
  }

  if (method === 'POST' && /^\/v1\/vast\/tags\/[^/]+\/queue-static-publish$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to queue VAST delivery publish.');
      }
      const tagId = pathname.split('/')[4];
      try {
        const state = await queueStaticVastPublish(session.client, {
          tagId,
          baseUrl,
          trigger: 'manual_queue',
        });
        return sendJson(res, 200, { ok: true, state, requestId });
      } catch (error) {
        return badRequest(res, requestId, error.message || 'Failed to queue static VAST delivery publish.');
      }
    });
  }

  if (method === 'GET' && /^\/v1\/tags\/[^/]+\/delivery-diagnostics$/.test(pathname)) {
    return withSession(ctx, async () => {
      const tagId = pathname.split('/')[3];
      const diagnostics = await getVastDeliveryDiagnostics(getDatabasePool(ctx.env), { tagId, baseUrl });
      if (!diagnostics) return badRequest(res, requestId, 'Tag not found.');
      return sendJson(res, 200, { ...diagnostics, requestId });
    });
  }

  if (method === 'GET' && /^\/v1\/tags\/tracker\/[^/]+\/impression\.gif$/.test(pathname)) {
    res.statusCode = 200;
    applyPublicCors(ctx.req, res);
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(PIXEL_GIF);
    return true;
  }

  if (method === 'GET' && /^\/v1\/tags\/tracker\/[^/]+\/engagement$/.test(pathname)) {
    res.statusCode = 204;
    applyPublicCors(ctx.req, res);
    res.end();
    return true;
  }

  if (method === 'GET' && /^\/v1\/tags\/tracker\/[^/]+\/click$/.test(pathname)) {
    const tagId = pathname.split('/')[4];
    const explicitTarget = trimText(url.searchParams.get('url'));
    const destination = explicitTarget || await getTagClickDestination(getDatabasePool(ctx.env), tagId);
    res.statusCode = 302;
    applyPublicCors(ctx.req, res);
    res.setHeader('Location', destination || baseUrl);
    res.end();
    return true;
  }

  return false;
}
