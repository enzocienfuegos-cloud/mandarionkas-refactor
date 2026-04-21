import {
  PACING_STATUSES,
  listCampaignsPacing,
  getCampaignPacing,
  getCampaignDailyBreakdown,
  getPacingAlerts,
} from '@smx/db/pacing';

export function handlePacingRoutes(app, { requireWorkspace, pool }) {
  // GET /v1/pacing — list all campaigns with pacing (static route first)
  app.get('/v1/pacing', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { status } = req.query;

    if (status && !PACING_STATUSES.includes(status)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `status must be one of: ${PACING_STATUSES.join(', ')}`,
      });
    }

    const campaigns = await listCampaignsPacing(pool, workspaceId, { status });
    return reply.send({ campaigns });
  });

  // GET /v1/pacing/alerts — static route before parameterized
  app.get('/v1/pacing/alerts', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;

    const alerts = await getPacingAlerts(pool, workspaceId);
    return reply.send({ alerts });
  });

  // GET /v1/pacing/:campaignId
  app.get('/v1/pacing/:campaignId', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { campaignId } = req.params;

    const pacing = await getCampaignPacing(pool, workspaceId, campaignId);
    if (!pacing) {
      return reply.status(404).send({ error: 'Not Found', message: 'Campaign not found' });
    }

    return reply.send({ pacing });
  });

  // GET /v1/pacing/:campaignId/breakdown — daily series
  app.get('/v1/pacing/:campaignId/breakdown', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { campaignId } = req.params;
    const { days } = req.query;

    if (days !== undefined) {
      const numDays = Number(days);
      if (!Number.isFinite(numDays) || isNaN(numDays) || numDays <= 0 || numDays > 90) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'days must be a number between 1 and 90',
        });
      }
    }

    // Verify campaign belongs to workspace
    const { rows } = await pool.query(
      `SELECT id FROM campaigns WHERE id = $1 AND workspace_id = $2`,
      [campaignId, workspaceId],
    );
    if (!rows.length) {
      return reply.status(404).send({ error: 'Not Found', message: 'Campaign not found' });
    }

    const breakdown = await getCampaignDailyBreakdown(pool, workspaceId, campaignId, days ?? 30);
    return reply.send({ breakdown });
  });
}
