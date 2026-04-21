import {
  listTagHealth,
  checkTagHealth,
  getTagHealthSummary,
} from '@smx/db/tag-health';

export function handleTagHealthRoutes(app, { requireWorkspace, pool }) {
  // GET /v1/tags/health — must come before /v1/tags/:id routes
  app.get('/v1/tags/health', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { status, limit, offset } = req.query;

    const health = await listTagHealth(pool, workspaceId, { status, limit, offset });
    return reply.send({ health });
  });

  // GET /v1/tags/health/summary
  app.get('/v1/tags/health/summary', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const summary = await getTagHealthSummary(pool, workspaceId);
    return reply.send({ summary });
  });

  // GET /v1/tags/:id/health
  app.get('/v1/tags/:id/health', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    // Get the most recent health log for this tag
    const { rows } = await pool.query(
      `SELECT hl.id, hl.tag_id, hl.workspace_id, hl.status,
              hl.last_impression_at, hl.impression_count_24h, hl.error_rate,
              hl.details, hl.checked_at,
              t.name AS tag_name, t.format, t.status AS tag_status
       FROM tag_health_logs hl
       JOIN ad_tags t ON t.id = hl.tag_id
       WHERE hl.tag_id = $1 AND hl.workspace_id = $2
       ORDER BY hl.checked_at DESC
       LIMIT 1`,
      [id, workspaceId],
    );

    if (!rows.length) {
      // Tag may exist but has never been checked — verify tag exists
      const { rows: tagRows } = await pool.query(
        `SELECT id, name, format, status FROM ad_tags WHERE id = $1 AND workspace_id = $2`,
        [id, workspaceId],
      );
      if (!tagRows.length) {
        return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
      }
      return reply.send({
        health: {
          tag_id: id,
          workspace_id: workspaceId,
          status: 'unknown',
          last_impression_at: null,
          impression_count_24h: 0,
          error_rate: 0,
          details: {},
          checked_at: null,
          tag_name: tagRows[0].name,
          format: tagRows[0].format,
          tag_status: tagRows[0].status,
        },
      });
    }

    return reply.send({ health: rows[0] });
  });

  // POST /v1/tags/:id/health/check — trigger a health check now
  app.post('/v1/tags/:id/health/check', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const result = await checkTagHealth(pool, workspaceId, id);
    if (!result) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    return reply.send({ health: result });
  });
}
