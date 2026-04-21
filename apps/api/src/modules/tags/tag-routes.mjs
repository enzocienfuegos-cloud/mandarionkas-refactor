import {
  listTags,
  getTag,
  createTag,
  updateTag,
  deleteTag,
  getTagWithCreatives,
} from '@smx/db/tags';

export function handleTagRoutes(app, { requireWorkspace, pool }) {
  // GET /v1/tags
  app.get('/v1/tags', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { campaignId, format, status, limit, offset, search } = req.query;

    const tags = await listTags(pool, workspaceId, {
      campaignId,
      format,
      status,
      limit,
      offset,
      search,
    });

    return reply.send({ tags });
  });

  // POST /v1/tags
  app.post('/v1/tags', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { name, campaignId, format, status, clickUrl, impressionUrl, description, targeting, frequencyCap, frequencyCapWindow, geoTargets, deviceTargets } = req.body ?? {};

    if (!name) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name is required' });
    }

    const tag = await createTag(pool, workspaceId, {
      name,
      campaign_id: campaignId,
      format,
      status,
      click_url: clickUrl,
      impression_url: impressionUrl,
      description,
      targeting,
      frequency_cap: frequencyCap,
      frequency_cap_window: frequencyCapWindow,
      geo_targets: geoTargets,
      device_targets: deviceTargets,
    });

    return reply.status(201).send({ tag });
  });

  // GET /v1/tags/:id
  app.get('/v1/tags/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const tag = await getTagWithCreatives(pool, workspaceId, id);
    if (!tag) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    return reply.send({ tag });
  });

  // PUT /v1/tags/:id
  app.put('/v1/tags/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;
    const body = req.body ?? {};

    // Map camelCase to snake_case for the DB layer
    const data = {};
    const fieldMap = {
      name: 'name',
      campaignId: 'campaign_id',
      format: 'format',
      status: 'status',
      clickUrl: 'click_url',
      impressionUrl: 'impression_url',
      description: 'description',
      targeting: 'targeting',
      frequencyCap: 'frequency_cap',
      frequencyCapWindow: 'frequency_cap_window',
      geoTargets: 'geo_targets',
      deviceTargets: 'device_targets',
    };

    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (camel in body) data[snake] = body[camel];
    }

    const tag = await updateTag(pool, workspaceId, id, data);
    if (!tag) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    return reply.send({ tag });
  });

  // DELETE /v1/tags/:id
  app.delete('/v1/tags/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const deleted = await deleteTag(pool, workspaceId, id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    return reply.status(204).send();
  });
}
