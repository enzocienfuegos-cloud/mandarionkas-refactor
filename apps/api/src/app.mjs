import { handleHealthRoutes } from './modules/health/routes.mjs';
import { handleAuthRoutes } from './modules/auth/routes.mjs';
import { handleAuditRoutes } from './modules/audit/routes.mjs';
import { handleWorkspaceRoutes } from './modules/workspaces/routes.mjs';
import { handleProjectRoutes } from './modules/projects/routes.mjs';
import { handleAssetRoutes } from './modules/assets/routes.mjs';
import { handleCampaignRoutes } from './modules/adserver/campaigns/routes.mjs';
import { handleApiKeyRoutes } from './modules/adserver/api-keys/routes.mjs';
import { handleCreativeRoutes } from './modules/adserver/creatives/routes.mjs';
import { handleDiscrepancyRoutes } from './modules/adserver/discrepancies/routes.mjs';
import { handleExperimentRoutes } from './modules/adserver/experiments/routes.mjs';
import { handlePacingRoutes } from './modules/adserver/pacing/routes.mjs';
import { handlePixelRoutes } from './modules/adserver/pixels/routes.mjs';
import { handleReportingRoutes } from './modules/adserver/reporting/routes.mjs';
import { handleSearchRoutes } from './modules/adserver/search/routes.mjs';
import { handleDisplayRoutes } from './modules/adserver/display/routes.mjs';
import { handleTagRoutes } from './modules/adserver/tags/routes.mjs';
import { createTrackerRoutes } from './modules/adserver/tracker/routes.mjs';
import { TrackerBuffer } from './modules/adserver/tracker/tracker-buffer.mjs';
import { handleTrackingRoutes } from './modules/adserver/tracking/routes.mjs';
import { handleVastRoutes } from './modules/adserver/vast/routes.mjs';
import { handleWebhookRoutes } from './modules/adserver/webhooks/routes.mjs';
import { applyCors, getRequestId, notFound, readJsonBody, sendJson } from './lib/http.mjs';
import { getApiConfig } from './plugins/config.mjs';
import { logError, logInfo } from './lib/logger.mjs';
import { getPool } from '@smx/db/src/pool.mjs';

const { env, warnings } = getApiConfig();
let trackerBuffer = null;

function initTrackerBuffer() {
  const connectionString = env.databasePoolUrl || env.databaseUrl || '';
  if (!connectionString) {
    logInfo({ service: env.appName, event: 'tracker_buffer_skipped', reason: 'no_database_url' });
    return null;
  }

  const pool = getPool(connectionString);
  const buffer = new TrackerBuffer(pool, {
    flushIntervalMs: env.trackerFlushIntervalMs,
    flushThreshold: env.trackerFlushThreshold,
  });
  buffer.start();
  logInfo({
    service: env.appName,
    event: 'tracker_buffer_started',
    flushIntervalMs: env.trackerFlushIntervalMs,
    flushThreshold: env.trackerFlushThreshold,
  });
  return buffer;
}

function buildRouteHandlers(buffer) {
  return [
    handleHealthRoutes,
    handleAuthRoutes,
    handleAuditRoutes,
    handleWorkspaceRoutes,
    handleProjectRoutes,
    handleAssetRoutes,
    handleCampaignRoutes,
    handleApiKeyRoutes,
    handleCreativeRoutes,
    handleDiscrepancyRoutes,
    handleExperimentRoutes,
    handlePacingRoutes,
    handlePixelRoutes,
    handleReportingRoutes,
    handleSearchRoutes,
    handleDisplayRoutes,
    createTrackerRoutes(buffer),
    handleVastRoutes,
    handleTagRoutes,
    handleTrackingRoutes,
    handleWebhookRoutes,
  ];
}

function logRequest({ requestId, method, pathname, statusCode, durationMs }) {
  logInfo({
    requestId,
    method,
    pathname,
    statusCode,
    durationMs,
    service: env.appName,
  });
}

export function createApp() {
  trackerBuffer = initTrackerBuffer();
  const routeHandlers = buildRouteHandlers(trackerBuffer);

  return async function handleRequest(req, res) {
    const startedAt = Date.now();
    const requestId = getRequestId(req.headers);
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const method = (req.method || 'GET').toUpperCase();
    const pathname = url.pathname.replace(/\/$/, '') || '/';

    applyCors(req, res, env);
    res.setHeader('X-Request-Id', requestId);

    if (method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      logRequest({ requestId, method, pathname, statusCode: 204, durationMs: Date.now() - startedAt });
      return;
    }

    const body = method === 'GET' || method === 'HEAD' ? null : await readJsonBody(req);
    if (body && body.__invalidJson) {
      sendJson(res, 400, {
        ok: false,
        code: 'invalid_json',
        requestId,
        message: 'Request body is not valid JSON.',
      });
      logRequest({ requestId, method, pathname, statusCode: 400, durationMs: Date.now() - startedAt });
      return;
    }

    const ctx = { method, pathname, url, req, res, body, requestId, env, warnings };

    let handled = false;
    try {
      for (const handler of routeHandlers) {
        if (await handler(ctx)) {
          handled = true;
          break;
        }
      }
    } catch (error) {
      logError({
        requestId,
        method,
        pathname,
        service: env.appName,
        message: 'Unhandled route error',
        error,
      });
      sendJson(res, 500, { ok: false, code: 'internal_error', requestId, message: 'Unhandled server error.' });
      handled = true;
    }

    if (!handled) {
      notFound(res, requestId, pathname);
    }

    logRequest({ requestId, method, pathname, statusCode: res.statusCode || 200, durationMs: Date.now() - startedAt });
  };
}

export async function shutdownApp() {
  if (trackerBuffer) {
    await trackerBuffer.stop();
  }
}
