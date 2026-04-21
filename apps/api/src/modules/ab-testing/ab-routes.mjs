import {
  listExperiments,
  getExperiment,
  createExperiment,
  updateExperiment,
  deleteExperiment,
  getExperimentResults,
} from '@smx/db/ab-testing';

export function handleAbRoutes(app, { requireWorkspace, pool }) {
  // GET /v1/experiments
  app.get('/v1/experiments', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;

    const experiments = await listExperiments(pool, workspaceId);
    return reply.send({ experiments });
  });

  // POST /v1/experiments
  app.post('/v1/experiments', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { name, tagId, variants, description, status, trafficPct } = req.body ?? {};

    if (!name || !name.trim()) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name is required' });
    }
    if (!Array.isArray(variants) || variants.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'variants must be a non-empty array' });
    }

    // Validate each variant has a name and weight
    for (const v of variants) {
      if (!v.name) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Each variant must have a name' });
      }
      if (v.weight !== undefined && (typeof v.weight !== 'number' || v.weight < 0)) {
        return reply.status(400).send({ error: 'Bad Request', message: 'variant weight must be a non-negative number' });
      }
    }

    let experiment;
    try {
      experiment = await createExperiment(pool, workspaceId, {
        name: name.trim(),
        tag_id: tagId ?? null,
        description: description ?? null,
        status: status ?? 'draft',
        traffic_pct: trafficPct ?? 100,
        variants: variants.map(v => ({
          name: v.name,
          creative_id: v.creativeId ?? v.creative_id ?? null,
          weight: v.weight ?? 50,
        })),
      });
    } catch (err) {
      return reply.status(400).send({ error: 'Bad Request', message: err.message });
    }

    return reply.status(201).send({ experiment });
  });

  // GET /v1/experiments/results — static placeholder (handled below per id)

  // GET /v1/experiments/:id — after static routes
  app.get('/v1/experiments/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const experiment = await getExperiment(pool, workspaceId, id);
    if (!experiment) {
      return reply.status(404).send({ error: 'Not Found', message: 'Experiment not found' });
    }

    return reply.send({ experiment });
  });

  // PUT /v1/experiments/:id
  app.put('/v1/experiments/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;
    const body = req.body ?? {};

    const fieldMap = {
      name: 'name',
      description: 'description',
      status: 'status',
      trafficPct: 'traffic_pct',
      startedAt: 'started_at',
      endedAt: 'ended_at',
    };

    const data = {};
    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (camel in body) data[snake] = body[camel];
    }

    const experiment = await updateExperiment(pool, workspaceId, id, data);
    if (!experiment) {
      return reply.status(404).send({ error: 'Not Found', message: 'Experiment not found' });
    }

    return reply.send({ experiment });
  });

  // DELETE /v1/experiments/:id
  app.delete('/v1/experiments/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const deleted = await deleteExperiment(pool, workspaceId, id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Not Found', message: 'Experiment not found' });
    }

    return reply.status(204).send();
  });

  // GET /v1/experiments/:id/results
  app.get('/v1/experiments/:id/results', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const results = await getExperimentResults(pool, workspaceId, id);
    if (!results) {
      return reply.status(404).send({ error: 'Not Found', message: 'Experiment not found' });
    }

    return reply.send({ results });
  });
}
