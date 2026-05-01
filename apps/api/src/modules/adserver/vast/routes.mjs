// apps/api/src/modules/adserver/vast/routes.mjs
//
// S46: Added frequency cap check to the two public live-VAST GET handlers.
//
// Before serving VAST XML, the route now:
//   1. Reads the smx_uid cookie (device ID) from the request.
//   2. Fetches frequency_cap + frequency_cap_window from ad_tags.
//   3. Counts impressions for this (tag, device) in the current window.
//   4. If capped → returns a VAST 3.0 <NoAd/> response (not a 403).
//   5. If not capped → serves VAST normally.
//
// The cap check is a best-effort fast-path:
//   - If the DB is unavailable or smx_uid is missing → serve VAST (no false blocks).
//   - If frequency_cap is null on the tag → no cap enforced.
//   - Cap check adds one SELECT query per VAST request for tagged devices only.
//
// Static VAST (/static/*.xml) and authenticated endpoints are NOT capped here —
// static VAST is consumed by DSPs that don't carry first-party cookies.

import { badRequest, forbidden, sendJson, serviceUnavailable, unauthorized } from '../../../lib/http.mjs';
import { withSession, hasPermission } from '../../../lib/session.mjs';
import { getPool } from '@smx/db/src/pool.mjs';
import {
  getLiveVastXml,
  getStaticVastXml,
  getVastDeliveryDiagnostics,
  publishStaticVastProfiles,
  queueStaticVastPublish,
  resolveVastChain,
  validateVastTag,
} from '@smx/db/src/vast.mjs';
import { checkFrequencyCap, getTagFrequencyCap } from '@smx/db/src/frequency-cap.mjs';
import { readDeviceId } from '../../../lib/device-id.mjs';
import { createR2Client } from '@smx/r2/src/client.mjs';

// ─── R2 singleton ──────────────────────────────────────────────────────────

let r2Client = null;

function getR2Client(env) {
  if (r2Client) return r2Client;
  r2Client = createR2Client({
    endpoint:        env.r2Endpoint || '',
    bucket:          env.r2Bucket || '',
    accessKeyId:     env.r2AccessKeyId || '',
    secretAccessKey: env.r2SecretAccessKey || '',
    publicBaseUrl:   env.r2PublicBaseUrl || env.assetsPublicBaseUrl || '',
  });
  return r2Client;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

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
  return getPool(env.databasePoolUrl || env.databaseUrl);
}

function parsePublishProfile(body = {}) {
  const raw = trimText(body.dsp || body.profile || body.targetProfile);
  if (!raw) return 'default';
  const normalized = raw.toLowerCase();
  if (normalized === 'basis')  return 'basis';
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
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.removeHeader('Access-Control-Allow-Credentials');
  }
  res.setHeader('Vary', 'Origin');
}

// ─── S46: Frequency cap ────────────────────────────────────────────────────

/**
 * Minimal VAST 3.0 NoAd response.
 * Returned when a device has exceeded the frequency cap for this tag.
 * DSP players interpret NoAd as "no fill" and move to the next ad source.
 */
function buildNoAdVast(tagId) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<VAST version="3.0">',
    `  <!-- Frequency cap reached for tag ${tagId} -->`,
    '  <Ad id="noad">',
    '    <InLine>',
    '      <AdSystem>SMX</AdSystem>',
    '      <AdTitle>No Ad</AdTitle>',
    '      <NoAd/>',
    '    </InLine>',
    '  </Ad>',
    '</VAST>',
  ].join('\n');
}

/**
 * Run the frequency cap check for a public VAST request.
 * Returns { blocked: true } if capped, { blocked: false } otherwise.
 * Never throws — fails open (uncapped) on any error.
 */
async function runFrequencyCapCheck(pool, req, tagId) {
  try {
    const deviceId = readDeviceId(req);
    if (!deviceId) return { blocked: false };

    const { cap, capWindow } = await getTagFrequencyCap(pool, tagId);
    if (!cap) return { blocked: false };

    const result = await checkFrequencyCap(pool, { tagId, deviceId, cap, capWindow });
    return { blocked: result.capped, deviceId, cap, capWindow, count: result.count };
  } catch {
    return { blocked: false };
  }
}

// ─── Route handler ─────────────────────────────────────────────────────────

export async function handleVastRoutes(ctx) {
  const { method, pathname, body, res, requestId, url } = ctx;
  const baseUrl = resolveBaseUrl(ctx);

  // ── Authenticated endpoints (unchanged) ──────────────────────────────────

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

  // ── Public live VAST — with S46 frequency cap check ──────────────────────

  if (method === 'GET' && /^\/v1\/vast\/tags\/[^/]+$/.test(pathname)) {
    const tagId = pathname.split('/')[4];
    const pool  = getDatabasePool(ctx.env);

    // S46: cap check before generating VAST.
    const capResult = await runFrequencyCapCheck(pool, ctx.req, tagId);
    if (capResult.blocked) {
      applyPublicCors(ctx.req, res);
      return sendXml(res, buildNoAdVast(tagId), { 'Cache-Control': 'private, no-store' });
    }

    const xml = await getLiveVastXml(pool, { tagId, profile: 'default', baseUrl });
    if (!xml) return badRequest(res, requestId, 'Tag not found.');
    applyPublicCors(ctx.req, res);
    return sendXml(res, xml, { 'Cache-Control': 'private, no-store' });
  }

  if (method === 'GET' && /^\/v1\/vast\/tags\/[^/]+\/(default|basis|illumin|vast4)\.xml$/.test(pathname)) {
    const segments = pathname.split('/');
    const tagId   = segments[4];
    const profile = segments[5].replace(/\.xml$/i, '');
    const pool    = getDatabasePool(ctx.env);

    // S46: cap check.
    const capResult = await runFrequencyCapCheck(pool, ctx.req, tagId);
    if (capResult.blocked) {
      applyPublicCors(ctx.req, res);
      return sendXml(res, buildNoAdVast(tagId), { 'Cache-Control': 'private, no-store' });
    }

    const xml = await getLiveVastXml(pool, { tagId, profile, baseUrl });
    if (!xml) return badRequest(res, requestId, 'Tag not found.');
    applyPublicCors(ctx.req, res);
    return sendXml(res, xml, { 'Cache-Control': 'private, no-store' });
  }

  // ── Static VAST — no cap check (DSP context, no first-party cookies) ─────

  if (method === 'GET' && /^\/v1\/vast\/tags\/[^/]+\/static\/(default|basis|illumin)\.xml$/.test(pathname)) {
    const segments = pathname.split('/');
    const tagId    = segments[4];
    const profile  = segments[6].replace(/\.xml$/i, '');
    const snapshot = await getStaticVastXml(getDatabasePool(ctx.env), { tagId, profile, baseUrl });
    if (!snapshot) return badRequest(res, requestId, 'Tag not found.');
    applyPublicCors(ctx.req, res);
    return sendXml(res, snapshot.xml, {
      ETag: snapshot.etag || undefined,
      'Cache-Control': 'private, max-age=60',
    });
  }

  // ── Publish endpoints (authenticated, unchanged) ─────────────────────────

  if (method === 'POST' && /^\/v1\/vast\/tags\/[^/]+\/publish-static$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to publish VAST delivery.');
      }
      const tagId = pathname.split('/')[4];
      const profile = parsePublishProfile(body || {});
      try {
        const state = await publishStaticVastProfiles(
          session.client,
          { tagId, baseUrl, profiles: [profile], trigger: 'manual_publish' },
          { r2: getR2Client(ctx.env) },
        );
        return sendJson(res, 200, {
          ok: true, state, requestId,
          r2Uploaded: state.manifest?.uploadedToR2 ?? false,
        });
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
        const state = await queueStaticVastPublish(
          session.client,
          { tagId, baseUrl, trigger: 'manual_queue' },
          { r2: getR2Client(ctx.env) },
        );
        return sendJson(res, 200, {
          ok: true, state, requestId,
          r2Uploaded: state.manifest?.uploadedToR2 ?? false,
        });
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

  return false;
}
