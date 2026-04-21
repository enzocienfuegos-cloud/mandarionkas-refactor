import {
  listWebhooks,
  getWebhook,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhookDeliveries,
  WEBHOOK_EVENTS,
} from '@smx/db/webhooks';

function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function handleWebhookRoutes(app, { requireWorkspace, pool }) {
  // GET /v1/webhooks
  app.get('/v1/webhooks', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;

    const webhooks = await listWebhooks(pool, workspaceId);
    return reply.send({ webhooks });
  });

  // POST /v1/webhooks
  app.post('/v1/webhooks', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { name, url, events, secret } = req.body ?? {};

    if (!name || !name.trim()) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name is required' });
    }
    if (!url) {
      return reply.status(400).send({ error: 'Bad Request', message: 'url is required' });
    }
    if (!isValidUrl(url)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'url must be a valid http or https URL' });
    }
    if (!Array.isArray(events) || events.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'events must be a non-empty array' });
    }

    const invalidEvents = events.filter(e => !WEBHOOK_EVENTS.includes(e));
    if (invalidEvents.length > 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Invalid events: ${invalidEvents.join(', ')}. Valid events: ${WEBHOOK_EVENTS.join(', ')}`,
      });
    }

    let webhook;
    try {
      webhook = await createWebhook(pool, workspaceId, { name: name.trim(), url, events, secret });
    } catch (err) {
      return reply.status(400).send({ error: 'Bad Request', message: err.message });
    }

    return reply.status(201).send({ webhook });
  });

  // GET /v1/webhooks/:id — after static routes
  app.get('/v1/webhooks/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const webhook = await getWebhook(pool, workspaceId, id);
    if (!webhook) {
      return reply.status(404).send({ error: 'Not Found', message: 'Webhook not found' });
    }
    return reply.send({ webhook });
  });

  // PUT /v1/webhooks/:id
  app.put('/v1/webhooks/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;
    const body = req.body ?? {};

    if ('url' in body && !isValidUrl(body.url)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'url must be a valid http or https URL' });
    }

    if ('events' in body) {
      if (!Array.isArray(body.events)) {
        return reply.status(400).send({ error: 'Bad Request', message: 'events must be an array' });
      }
      const invalidEvents = body.events.filter(e => !WEBHOOK_EVENTS.includes(e));
      if (invalidEvents.length > 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Invalid events: ${invalidEvents.join(', ')}`,
        });
      }
    }

    let webhook;
    try {
      webhook = await updateWebhook(pool, workspaceId, id, body);
    } catch (err) {
      return reply.status(400).send({ error: 'Bad Request', message: err.message });
    }

    if (!webhook) {
      return reply.status(404).send({ error: 'Not Found', message: 'Webhook not found' });
    }
    return reply.send({ webhook });
  });

  // DELETE /v1/webhooks/:id
  app.delete('/v1/webhooks/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const deleted = await deleteWebhook(pool, workspaceId, id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Not Found', message: 'Webhook not found' });
    }
    return reply.status(204).send();
  });

  // GET /v1/webhooks/:id/deliveries — delivery history
  app.get('/v1/webhooks/:id/deliveries', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;
    const { limit, offset } = req.query;

    const deliveries = await getWebhookDeliveries(pool, workspaceId, id, { limit, offset });
    if (deliveries === null) {
      return reply.status(404).send({ error: 'Not Found', message: 'Webhook not found' });
    }
    return reply.send({ deliveries });
  });
}
