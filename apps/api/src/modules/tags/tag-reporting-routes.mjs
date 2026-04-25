import {
  getTagDailyStats,
  getTagSummaryStats,
  getTopTags,
} from '@smx/db/tag-reporting';

export function handleTagReportingRoutes(app, { requireWorkspace, pool }) {
  // GET /v1/tags/top — must be before /v1/tags/:id routes
  app.get('/v1/tags/top', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { limit, metric, dateFrom, dateTo } = req.query;

    const safeLimit = limit !== undefined ? parseInt(limit, 10) : 10;
    if (isNaN(safeLimit) || safeLimit < 1 || safeLimit > 50) {
      return reply.status(400).send({ error: 'Bad Request', message: 'limit must be between 1 and 50' });
    }

    const validMetrics = ['impressions', 'clicks', 'ctr'];
    const orderBy = metric && validMetrics.includes(metric) ? metric : 'impressions';

    const tags = await getTopTags(pool, workspaceId, { limit: safeLimit, orderBy, dateFrom, dateTo });
    return reply.send({ tags });
  });

  // GET /v1/tags/:id/stats
  app.get('/v1/tags/:id/stats', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;
    const {
      days,
      dateFrom,
      dateTo,
      creativeId = '',
      creativeSizeVariantId = '',
    } = req.query;

    let safeLimit = 30;
    if (days !== undefined) {
      safeLimit = parseInt(days, 10);
      if (isNaN(safeLimit) || safeLimit < 1 || safeLimit > 90) {
        return reply.status(400).send({ error: 'Bad Request', message: 'days must be between 1 and 90' });
      }
    }

    const stats = await getTagDailyStats(pool, workspaceId, id, {
      limit: safeLimit,
      dateFrom,
      dateTo,
      creativeId,
      creativeSizeVariantId,
    });
    if (!stats) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    return reply.send({ stats });
  });

  // GET /v1/tags/:id/summary
  app.get('/v1/tags/:id/summary', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;
    const {
      creativeId = '',
      creativeSizeVariantId = '',
    } = req.query;

    const summary = await getTagSummaryStats(pool, workspaceId, id, {
      creativeId,
      creativeSizeVariantId,
    });
    if (!summary) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    return reply.send({ summary });
  });
}
