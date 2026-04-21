import {
  getWorkspaceStats,
  getCampaignStats,
  getTagStats,
} from '@smx/db/reporting';

export function handleReportingRoutes(app, { requireWorkspace, pool }) {
  // GET /v1/reporting/workspace — workspace-level aggregate stats
  app.get('/v1/reporting/workspace', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo } = req.query;

    const stats = await getWorkspaceStats(pool, workspaceId, { dateFrom, dateTo });
    return reply.send({ stats });
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
