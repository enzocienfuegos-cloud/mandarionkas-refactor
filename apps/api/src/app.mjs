import { handleHealthRoutes } from './modules/health/routes.mjs';
import { handleAuthRoutes } from './modules/auth/routes.mjs';
import { handleWorkspaceRoutes } from './modules/workspaces/routes.mjs';
import { handleProjectRoutes } from './modules/projects/routes.mjs';
import { handleAssetRoutes } from './modules/assets/routes.mjs';
import { handleCampaignRoutes } from './modules/adserver/campaigns/routes.mjs';
import { handleCreativeRoutes } from './modules/adserver/creatives/routes.mjs';
import { handleDiscrepancyRoutes } from './modules/adserver/discrepancies/routes.mjs';
import { handleExperimentRoutes } from './modules/adserver/experiments/routes.mjs';
import { handlePacingRoutes } from './modules/adserver/pacing/routes.mjs';
import { handleReportingRoutes } from './modules/adserver/reporting/routes.mjs';
import { handleTagRoutes } from './modules/adserver/tags/routes.mjs';
import { handleWebhookRoutes } from './modules/adserver/webhooks/routes.mjs';
import { applyCors, getRequestId, notFound, readJsonBody, sendJson } from './lib/http.mjs';
import { getApiConfig } from './plugins/config.mjs';
import { logError, logInfo } from './lib/logger.mjs';

const { env, warnings } = getApiConfig();
const routeHandlers = [
  handleHealthRoutes,
  handleAuthRoutes,
  handleWorkspaceRoutes,
  handleProjectRoutes,
  handleAssetRoutes,
  handleCampaignRoutes,
  handleCreativeRoutes,
  handleDiscrepancyRoutes,
  handleExperimentRoutes,
  handlePacingRoutes,
  handleReportingRoutes,
  handleTagRoutes,
  handleWebhookRoutes,
];

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
