/**
 * server.mjs — SMX Studio API Server
 * Start: node src/server.mjs
 */
import 'dotenv/config';
import Fastify          from 'fastify';
import fastifyCookie    from '@fastify/cookie';
import fastifySession   from '@fastify/session';
import fastifyCors      from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';

import { createPool } from '@smx/db/pool';
import { buildCorsOriginMatcher, buildSessionCookieOptions } from './config/http.mjs';

import { handleAuthRoutes, buildRequireWorkspace } from './modules/auth/auth-routes.mjs';
import { handleTagRoutes }             from './modules/tags/tag-routes.mjs';
import { handleTagHealthRoutes }       from './modules/tags/health-routes.mjs';
import { handleTagReportingRoutes }    from './modules/tags/tag-reporting-routes.mjs';
import { handleCampaignRoutes }        from './modules/campaigns/campaign-routes.mjs';
import { handleCreativeRoutes }        from './modules/creatives/creative-routes.mjs';
import { handleCreativeApprovalRoutes } from './modules/creatives/creative-approval-routes.mjs';
import { handleTrackingRoutes }        from './modules/tracking/tracking-routes.mjs';
import { handleReportingRoutes }       from './modules/reporting/routes.mjs';
import { handlePacingRoutes }          from './modules/pacing/pacing-routes.mjs';
import { handleDiscrepancyRoutes }     from './modules/discrepancies/discrepancy-routes.mjs';
import { handleSearchRoutes }          from './modules/search/search-routes.mjs';
import { handleAuditRoutes, createAuditMiddleware } from './modules/audit/audit-routes.mjs';
import { handleApiKeyRoutes, buildRequireApiKey }   from './modules/api-keys/api-key-routes.mjs';
import { handleWebhookRoutes }         from './modules/webhooks/webhook-routes.mjs';
import { handleAbRoutes }              from './modules/ab-testing/ab-routes.mjs';
import { handleWorkspaceRoutes }       from './modules/team/workspace-routes.mjs';
import { handleTeamRoutes }            from './modules/team/team-routes.mjs';
import { handlePixelRoutes }           from './modules/pixels/pixel-routes.mjs';
import { handleVastRoutes }            from './modules/vast/routes.mjs';
import { handleVastValidatorRoutes }   from './modules/vast/validator-routes.mjs';
import { handleStudioClientRoutes }    from './modules/studio/client-routes.mjs';
import { handleStudioProjectRoutes }   from './modules/studio/project-routes.mjs';
import { handleStudioAssetRoutes }     from './modules/studio/asset-routes.mjs';

export async function buildApp(opts = {}) {
  const app = Fastify({
    trustProxy: true,
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport: process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
    ...opts,
  });

  const pool = createPool();

  await app.register(fastifyCors, {
    origin: buildCorsOriginMatcher(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  });

  await app.register(fastifyCookie);

  await app.register(fastifySession, {
    secret:     process.env.SESSION_SECRET ?? 'smx-dev-secret-change-in-production',
    cookieName: 'smx_session',
    cookie: buildSessionCookieOptions(),
  });

  await app.register(fastifyMultipart, {
    limits: { fileSize: parseInt(process.env.MAX_UPLOAD_BYTES, 10) || 100 * 1024 * 1024 },
  });

  const requireWorkspace = buildRequireWorkspace(pool);
  const requireApiKey    = buildRequireApiKey(pool);

  function buildRequestLogContext(req, reply) {
    return {
      requestId: req.id,
      method: req.method,
      url: req.url,
      route: req.routeOptions?.url ?? null,
      statusCode: reply.statusCode,
      origin: req.headers.origin ?? null,
      userId: req.session?.userId ?? null,
      workspaceId: req.session?.workspaceId ?? null,
    };
  }

  function isOperationallyInteresting(req, reply) {
    const route = req.routeOptions?.url ?? req.url;
    if (reply.statusCode >= 400) return true;
    return route.startsWith('/v1/auth')
      || route.startsWith('/v1/assets')
      || route.startsWith('/v1/projects')
      || route.startsWith('/v1/clients');
  }

  app.addHook('onRequest', async (req, reply) => {
    reply.header('X-Request-Id', req.id);
  });

  // Audit hook
  const auditMiddleware = createAuditMiddleware(pool);
  app.addHook('onResponse', auditMiddleware);
  app.addHook('onResponse', async (req, reply) => {
    if (!isOperationallyInteresting(req, reply)) return;
    const ctx = buildRequestLogContext(req, reply);
    if (reply.statusCode >= 500) {
      req.log.error(ctx, 'request failed');
      return;
    }
    if (reply.statusCode >= 400) {
      req.log.warn(ctx, 'request rejected');
      return;
    }
    req.log.info(ctx, 'request completed');
  });

  app.setErrorHandler((error, req, reply) => {
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    const logContext = {
      ...buildRequestLogContext(req, reply),
      statusCode,
      error: {
        name: error.name,
        code: error.code ?? null,
        message: error.message,
      },
    };

    if (statusCode >= 500) {
      req.log.error(logContext, 'unhandled request error');
    } else {
      req.log.warn(logContext, 'handled request error');
    }

    if (reply.sent) return;
    reply
      .code(statusCode)
      .send({
        error: statusCode >= 500 ? 'Internal Server Error' : (error.name ?? 'Request Error'),
        message: statusCode >= 500 ? 'Request failed' : error.message,
        requestId: req.id,
      });
  });

  // Health check
  app.get('/health', async () => {
    try { await pool.query('SELECT 1'); return { ok: true, db: 'connected' }; }
    catch { return { ok: false, db: 'error' }; }
  });

  const ctx = { requireWorkspace, pool };

  // Auth (no requireWorkspace — handles its own auth)
  handleAuthRoutes(app, { pool });

  // Platform management
  handleWorkspaceRoutes(app, ctx);
  handleTeamRoutes(app, ctx);
  handleStudioClientRoutes(app, ctx);
  handleStudioProjectRoutes(app, ctx);
  handleStudioAssetRoutes(app, ctx);
  handleApiKeyRoutes(app, { requireWorkspace, pool });

  // Core ad serving — public tracking, key-auth VAST
  handleTrackingRoutes(app, { pool });
  handleVastRoutes(app, { requireWorkspace, requireApiKey, pool });
  handleVastValidatorRoutes(app, ctx);

  // Campaign & creative management
  handleCampaignRoutes(app, ctx);
  handleCreativeRoutes(app, ctx);
  handleCreativeApprovalRoutes(app, ctx);

  // Tags
  handleTagRoutes(app, ctx);
  handleTagHealthRoutes(app, ctx);
  handleTagReportingRoutes(app, ctx);
  handlePixelRoutes(app, ctx);

  // Reporting & analytics
  handleReportingRoutes(app, ctx);
  handlePacingRoutes(app, ctx);
  handleDiscrepancyRoutes(app, ctx);

  // Platform features
  handleSearchRoutes(app, ctx);
  handleAuditRoutes(app, ctx);
  handleWebhookRoutes(app, ctx);
  handleAbRoutes(app, ctx);

  return app;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const app = await buildApp();
  const host = process.env.HOST ?? '0.0.0.0';
  const port = parseInt(process.env.PORT, 10) || 4000;
  try {
    await app.listen({ host, port });
    console.log(`\n🚀  SMX Studio API  →  http://${host}:${port}\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
