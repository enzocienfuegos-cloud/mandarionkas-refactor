import {
  getWorkspaceOverview,
  getWorkspaceStats,
  getWorkspaceCampaignBreakdown,
  getWorkspaceTagBreakdown,
  getWorkspaceCreativeBreakdown,
  getWorkspaceVariantBreakdown,
  getCampaignStats,
  getTagStats,
} from '@smx/db/reporting';
import {
  getWorkspaceSiteBreakdown,
  getWorkspaceCountryBreakdown,
  getWorkspaceEngagementBreakdown,
  getWorkspaceIdentityBreakdown,
} from '@smx/db/tracking';

export function handleReportingRoutes(app, { requireWorkspace, pool }) {
  // GET /v1/reporting/workspace — workspace-level aggregate stats
  app.get('/v1/reporting/workspace', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo } = req.query;

    const [stats, timeline] = await Promise.all([
      getWorkspaceOverview(pool, workspaceId, { dateFrom, dateTo }),
      getWorkspaceStats(pool, workspaceId, { dateFrom, dateTo }),
    ]);
    return reply.send({ stats, timeline });
  });

  app.get('/v1/reporting/workspace/campaign-breakdown', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, limit } = req.query;
    const breakdown = await getWorkspaceCampaignBreakdown(pool, workspaceId, { dateFrom, dateTo, limit });
    return reply.send({ breakdown });
  });

  app.get('/v1/reporting/workspace/tag-breakdown', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, limit } = req.query;
    const breakdown = await getWorkspaceTagBreakdown(pool, workspaceId, { dateFrom, dateTo, limit });
    return reply.send({ breakdown });
  });

  app.get('/v1/reporting/workspace/site-breakdown', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, limit } = req.query;
    const breakdown = await getWorkspaceSiteBreakdown(pool, workspaceId, { dateFrom, dateTo, limit });
    return reply.send({ breakdown });
  });

  app.get('/v1/reporting/workspace/country-breakdown', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, limit } = req.query;
    const breakdown = await getWorkspaceCountryBreakdown(pool, workspaceId, { dateFrom, dateTo, limit });
    return reply.send({ breakdown });
  });

  app.get('/v1/reporting/workspace/engagement-breakdown', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, limit } = req.query;
    const breakdown = await getWorkspaceEngagementBreakdown(pool, workspaceId, { dateFrom, dateTo, limit });
    return reply.send({ breakdown });
  });

  app.get('/v1/reporting/workspace/identity-breakdown', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, limit } = req.query;
    const breakdown = await getWorkspaceIdentityBreakdown(pool, workspaceId, { dateFrom, dateTo, limit });
    return reply.send({ breakdown });
  });

  app.get('/v1/reporting/workspace/creative-breakdown', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, limit } = req.query;
    const breakdown = await getWorkspaceCreativeBreakdown(pool, workspaceId, { dateFrom, dateTo, limit });
    return reply.send({ breakdown });
  });

  app.get('/v1/reporting/workspace/variant-breakdown', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, limit } = req.query;
    const breakdown = await getWorkspaceVariantBreakdown(pool, workspaceId, { dateFrom, dateTo, limit });
    return reply.send({ breakdown });
  });

  // GET /v1/reporting/campaigns/:id — campaign-level stats
  app.get('/v1/reporting/campaigns/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;
    const { dateFrom, dateTo, limit } = req.query;

    const stats = await getCampaignStats(pool, workspaceId, id, { dateFrom, dateTo, limit });
    return reply.send({ stats });
  });

  // GET /v1/reporting/tags/:id — tag-level daily stats
  app.get('/v1/reporting/tags/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;
    const { dateFrom, dateTo, limit } = req.query;

    const stats = await getTagStats(pool, workspaceId, id, { dateFrom, dateTo, limit });
    if (!stats) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }
    return reply.send({ stats });
  });
}
