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
  function getRequestBaseUrl(req) {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const forwardedHost = req.headers['x-forwarded-host'];
    const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
    const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost;
    if (proto && host) return `${proto}://${host}`.replace(/\/+$/, '');
    if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/+$/, '');
    return `https://${req.hostname}`.replace(/\/+$/, '');
  }

  function escapeCsv(value) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function buildTagSnippet(baseUrl, tag, variant) {
    const width = Number(tag.serving_width ?? 0) || 300;
    const height = Number(tag.serving_height ?? 0) || 250;
    const displayJsUrl = `${baseUrl}/v1/tags/display/${tag.id}.js`;
    const displayHtmlUrl = `${baseUrl}/v1/tags/display/${tag.id}.html`;
    const vastUrl = `${baseUrl}/v1/vast/tags/${tag.id}`;
    switch (variant) {
      case 'display-js':
        return `<script src="${displayJsUrl}" async></script>\n<noscript>\n  <iframe src="${displayHtmlUrl}" width="${width}" height="${height}" scrolling="no" frameborder="0" style="border:0;overflow:hidden;"></iframe>\n</noscript>`;
      case 'display-ins':
        return `<ins id="smx-ad-slot-${tag.id}" style="display:inline-block;width:${width}px;height:${height}px;"></ins>\n<script>\n  (function(slot) {\n    if (!slot) return;\n    var iframe = document.createElement('iframe');\n    iframe.src = ${JSON.stringify(displayHtmlUrl)};\n    iframe.width = ${JSON.stringify(String(width))};\n    iframe.height = ${JSON.stringify(String(height))};\n    iframe.scrolling = 'no';\n    iframe.frameBorder = '0';\n    iframe.style.border = '0';\n    iframe.style.overflow = 'hidden';\n    slot.replaceWith(iframe);\n  })(document.getElementById(${JSON.stringify(`smx-ad-slot-${tag.id}`)}));\n</script>`;
      case 'display-iframe':
        return `<iframe\n  src="${displayHtmlUrl}"\n  width="${width}"\n  height="${height}"\n  scrolling="no"\n  frameborder="0"\n  marginwidth="0"\n  marginheight="0"\n  style="border:0;overflow:hidden;"\n></iframe>`;
      case 'vast-url':
        return vastUrl;
      default:
        return '';
    }
  }
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

  app.get('/v1/campaigns/:id/tags-export', { preHandler: requireWorkspace }, async (req, reply) => {
    const { userId } = req.authSession;
    const { id } = req.params;
    const { rows: campaignRows } = await pool.query(
      `SELECT c.id, c.workspace_id, c.name, w.name AS workspace_name
       FROM campaigns c
       JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
       JOIN workspaces w ON w.id = c.workspace_id
       WHERE c.id = $1
         AND wm.user_id = $2
         AND wm.status = 'active'
       LIMIT 1`,
      [id, userId],
    );
    const campaign = campaignRows[0];
    if (!campaign) {
      return reply.status(404).send({ error: 'Not Found', message: 'Campaign not found' });
    }

    const { rows: tags } = await pool.query(
      `SELECT t.id, t.name, t.format, t.status,
              COALESCE(bound_sizes.serving_width, legacy_sizes.serving_width) AS serving_width,
              COALESCE(bound_sizes.serving_height, legacy_sizes.serving_height) AS serving_height
       FROM ad_tags t
       LEFT JOIN LATERAL (
         SELECT
           COALESCE(csv.width, cv.width) AS serving_width,
           COALESCE(csv.height, cv.height) AS serving_height
         FROM tag_bindings tb
         JOIN creative_versions cv ON cv.id = tb.creative_version_id
         LEFT JOIN creative_size_variants csv ON csv.id = tb.creative_size_variant_id
         WHERE tb.workspace_id = t.workspace_id
           AND tb.tag_id = t.id
           AND tb.status IN ('active', 'draft')
         ORDER BY tb.weight DESC, tb.created_at ASC
         LIMIT 1
       ) bound_sizes ON TRUE
       LEFT JOIN LATERAL (
         SELECT c.width AS serving_width, c.height AS serving_height
         FROM tag_creatives tc
         JOIN creatives c ON c.id = tc.creative_id
         WHERE tc.tag_id = t.id
         ORDER BY tc.weight DESC, tc.created_at ASC
         LIMIT 1
       ) legacy_sizes ON TRUE
       WHERE t.workspace_id = $1
         AND t.campaign_id = $2
       ORDER BY t.created_at DESC`,
      [campaign.workspace_id, id],
    );

    const baseUrl = getRequestBaseUrl(req);
    const rows = [
      ['campaign', 'client', 'tag_name', 'format', 'size', 'js_tag', 'ins_tag', 'iframe_tag', 'vast_url'],
      ...tags.map(tag => {
        const size = tag.serving_width && tag.serving_height ? `${tag.serving_width}x${tag.serving_height}` : '';
        const format = String(tag.format ?? '').toLowerCase();
        return [
          campaign.name,
          campaign.workspace_name ?? '',
          tag.name,
          format === 'vast' ? 'VAST' : format,
          size,
          format === 'display' ? buildTagSnippet(baseUrl, tag, 'display-js') : '',
          format === 'display' ? buildTagSnippet(baseUrl, tag, 'display-ins') : '',
          format === 'display' ? buildTagSnippet(baseUrl, tag, 'display-iframe') : '',
          format === 'vast' ? buildTagSnippet(baseUrl, tag, 'vast-url') : '',
        ];
      }),
    ];

    const csv = rows.map(row => row.map(escapeCsv).join(',')).join('\n');
    reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename=\"${campaign.name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase()}-tags.csv\"`)
      .send(csv);
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
