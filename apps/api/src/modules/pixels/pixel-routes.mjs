const VALID_EVENTS = ['impression', 'click', 'viewability'];

export function handlePixelRoutes(app, { requireWorkspace, pool }) {
  // GET /v1/tags/:id/pixels — list third-party pixels for a tag
  app.get('/v1/tags/:id/pixels', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id: tagId } = req.params;

    // Verify tag belongs to workspace
    const { rows: tagRows } = await pool.query(
      `SELECT id FROM ad_tags WHERE id = $1 AND workspace_id = $2`,
      [tagId, workspaceId],
    );
    if (!tagRows.length) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    const { rows: pixels } = await pool.query(
      `SELECT id, tag_id, name, url, event, created_at
       FROM tag_pixels
       WHERE tag_id = $1
       ORDER BY created_at ASC`,
      [tagId],
    );

    return reply.send({ pixels });
  });

  // POST /v1/tags/:id/pixels — add pixel
  app.post('/v1/tags/:id/pixels', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id: tagId } = req.params;
    const { name, url, event } = req.body ?? {};

    // Verify tag belongs to workspace
    const { rows: tagRows } = await pool.query(
      `SELECT id FROM ad_tags WHERE id = $1 AND workspace_id = $2`,
      [tagId, workspaceId],
    );
    if (!tagRows.length) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    if (!name || !name.trim()) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name is required' });
    }
    if (!url || !url.trim()) {
      return reply.status(400).send({ error: 'Bad Request', message: 'url is required' });
    }
    if (!event || !VALID_EVENTS.includes(event)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `event must be one of: ${VALID_EVENTS.join(', ')}`,
      });
    }

    // Validate URL format
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return reply.status(400).send({ error: 'Bad Request', message: 'url must be an http or https URL' });
      }
    } catch {
      return reply.status(400).send({ error: 'Bad Request', message: 'url must be a valid URL' });
    }

    const { rows } = await pool.query(
      `INSERT INTO tag_pixels (tag_id, name, url, event)
       VALUES ($1, $2, $3, $4)
       RETURNING id, tag_id, name, url, event, created_at`,
      [tagId, name.trim(), url.trim(), event],
    );

    return reply.status(201).send({ pixel: rows[0] });
  });

  // DELETE /v1/tags/:id/pixels/:pixelId — remove pixel
  app.delete('/v1/tags/:id/pixels/:pixelId', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id: tagId, pixelId } = req.params;

    // Verify tag belongs to workspace
    const { rows: tagRows } = await pool.query(
      `SELECT id FROM ad_tags WHERE id = $1 AND workspace_id = $2`,
      [tagId, workspaceId],
    );
    if (!tagRows.length) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    const { rowCount } = await pool.query(
      `DELETE FROM tag_pixels WHERE id = $1 AND tag_id = $2`,
      [pixelId, tagId],
    );

    if (!rowCount) {
      return reply.status(404).send({ error: 'Not Found', message: 'Pixel not found' });
    }

    return reply.status(204).send();
  });
}
