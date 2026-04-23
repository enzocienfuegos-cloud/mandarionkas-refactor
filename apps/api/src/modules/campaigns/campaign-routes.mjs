import {
  listCampaigns,
  listCampaignsForUser,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  listAdvertisers,
  getAdvertiser,
  createAdvertiser,
  updateAdvertiser,
} from '@smx/db/campaigns';

export function handleCampaignRoutes(app, { requireWorkspace, pool }) {
  // ---- Campaigns ----

  // GET /v1/campaigns
  app.get('/v1/campaigns', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId, userId } = req.authSession;
    const { status, advertiserId, limit, offset, search, scope, workspaceId: filterWorkspaceId } = req.query;

    const campaigns = scope === 'all'
      ? await listCampaignsForUser(pool, userId, {
        status,
        workspaceId: filterWorkspaceId,
        limit,
        offset,
        search,
      })
      : await listCampaigns(pool, workspaceId, { status, advertiserId, limit, offset, search });
    return reply.send({ campaigns });
  });

  // POST /v1/campaigns
  app.post('/v1/campaigns', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const {
      name, advertiserId, startDate, endDate, status,
      impressionGoal, dailyBudget, budget, flightType,
      kpi, kpiGoal, currency, timezone, notes, metadata,
    } = req.body ?? {};

    if (!name) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name is required' });
    }

    const campaign = await createCampaign(pool, workspaceId, {
      name,
      advertiser_id: advertiserId,
      start_date: startDate,
      end_date: endDate,
      status,
      impression_goal: impressionGoal,
      daily_budget: dailyBudget,
      budget,
      flight_type: flightType,
      kpi,
      kpi_goal: kpiGoal,
      currency,
      timezone,
      notes,
      metadata,
    });

    return reply.status(201).send({ campaign });
  });

  // GET /v1/campaigns/:id
  app.get('/v1/campaigns/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const campaign = await getCampaign(pool, workspaceId, id);
    if (!campaign) {
      return reply.status(404).send({ error: 'Not Found', message: 'Campaign not found' });
    }
    return reply.send({ campaign });
  });

  // PUT /v1/campaigns/:id
  app.put('/v1/campaigns/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;
    const body = req.body ?? {};

    const fieldMap = {
      name: 'name',
      advertiserId: 'advertiser_id',
      startDate: 'start_date',
      endDate: 'end_date',
      status: 'status',
      impressionGoal: 'impression_goal',
      dailyBudget: 'daily_budget',
      budget: 'budget',
      flightType: 'flight_type',
      kpi: 'kpi',
      kpiGoal: 'kpi_goal',
      currency: 'currency',
      timezone: 'timezone',
      notes: 'notes',
      metadata: 'metadata',
    };

    const data = {};
    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (camel in body) data[snake] = body[camel];
    }

    const campaign = await updateCampaign(pool, workspaceId, id, data);
    if (!campaign) {
      return reply.status(404).send({ error: 'Not Found', message: 'Campaign not found' });
    }
    return reply.send({ campaign });
  });

  // DELETE /v1/campaigns/:id
  app.delete('/v1/campaigns/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const deleted = await deleteCampaign(pool, workspaceId, id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Not Found', message: 'Campaign not found' });
    }
    return reply.status(204).send();
  });

  // ---- Advertisers ----

  // GET /v1/advertisers
  app.get('/v1/advertisers', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { status, limit, offset, search } = req.query;

    const advertisers = await listAdvertisers(pool, workspaceId, { status, limit, offset, search });
    return reply.send({ advertisers });
  });

  // POST /v1/advertisers
  app.post('/v1/advertisers', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { name, domain, industry, contactEmail, notes, status } = req.body ?? {};

    if (!name) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name is required' });
    }

    const advertiser = await createAdvertiser(pool, workspaceId, {
      name,
      domain,
      industry,
      contact_email: contactEmail,
      notes,
      status,
    });

    return reply.status(201).send({ advertiser });
  });

  // GET /v1/advertisers/:id
  app.get('/v1/advertisers/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const advertiser = await getAdvertiser(pool, workspaceId, id);
    if (!advertiser) {
      return reply.status(404).send({ error: 'Not Found', message: 'Advertiser not found' });
    }
    return reply.send({ advertiser });
  });

  // PUT /v1/advertisers/:id
  app.put('/v1/advertisers/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;
    const body = req.body ?? {};

    const fieldMap = {
      name: 'name',
      domain: 'domain',
      industry: 'industry',
      contactEmail: 'contact_email',
      notes: 'notes',
      status: 'status',
    };

    const data = {};
    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (camel in body) data[snake] = body[camel];
    }

    const advertiser = await updateAdvertiser(pool, workspaceId, id, data);
    if (!advertiser) {
      return reply.status(404).send({ error: 'Not Found', message: 'Advertiser not found' });
    }
    return reply.send({ advertiser });
  });

  // DELETE /v1/advertisers/:id
  app.delete('/v1/advertisers/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const { rowCount } = await pool.query(
      `DELETE FROM advertisers WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, id],
    );
    if (!rowCount) {
      return reply.status(404).send({ error: 'Not Found', message: 'Advertiser not found' });
    }
    return reply.status(204).send();
  });
}
