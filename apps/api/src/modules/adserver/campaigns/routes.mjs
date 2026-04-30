import { badRequest, conflict, forbidden, sendJson, serviceUnavailable, unauthorized } from '../../../lib/http.mjs';
import { requireAuthenticatedSession } from '../../auth/service.mjs';
import {
  createCampaign,
  deleteCampaign,
  getCampaign,
  listCampaigns,
  listCampaignsForUser,
  updateCampaign,
} from '../../../../../../packages/db/src/campaigns.mjs';

function hasPermission(session, permission) {
  return session.permissions.includes(permission);
}

async function withSession(ctx, callback) {
  const session = await requireAuthenticatedSession({ env: ctx.env, headers: ctx.req.headers });
  if (!session.ok) {
    if (session.statusCode === 503) {
      return serviceUnavailable(ctx.res, ctx.requestId, session.message);
    }
    if (session.statusCode === 401) {
      return unauthorized(ctx.res, ctx.requestId, session.message);
    }
    return false;
  }

  try {
    return await callback(session);
  } finally {
    await session.finish();
  }
}

async function resolveTargetWorkspaceId(client, userId, fallbackWorkspaceId, requestedWorkspaceId) {
  const candidate = String(requestedWorkspaceId ?? '').trim();
  if (!candidate) return fallbackWorkspaceId;

  const { rowCount } = await client.query(
    `SELECT 1
     FROM workspace_members
     WHERE workspace_id = $1
       AND user_id = $2
     LIMIT 1`,
    [candidate, userId],
  );

  if (!rowCount) {
    const error = new Error('Not a member of the selected client');
    error.statusCode = 403;
    throw error;
  }

  return candidate;
}

function normalizeCampaign(row) {
  if (!row) return null;
  return {
    ...row,
    workspaceId: row.workspace_id ?? null,
    advertiserId: row.advertiser_id ?? null,
    advertiser: row.advertiser_id ? { id: row.advertiser_id, name: row.advertiser_name ?? '' } : null,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    impressionGoal: row.impression_goal ?? null,
    dailyBudget: row.daily_budget ?? null,
    totalHoverDurationMs: row.total_hover_duration_ms ?? 0,
    totalInViewDurationMs: row.total_in_view_duration_ms ?? 0,
    workspaceName: row.workspace_name ?? null,
  };
}

function parseCampaignInput(body = {}) {
  return {
    workspaceId: body.workspaceId ?? body.workspace_id ?? null,
    advertiser_id: body.advertiserId ?? body.advertiser_id ?? null,
    name: String(body.name || '').trim(),
    status: body.status ? String(body.status).trim().toLowerCase() : undefined,
    start_date: body.startDate ?? body.start_date ?? null,
    end_date: body.endDate ?? body.end_date ?? null,
    budget: body.budget ?? null,
    impression_goal: body.impressionGoal ?? body.impression_goal ?? null,
    daily_budget: body.dailyBudget ?? body.daily_budget ?? null,
    flight_type: body.flightType ?? body.flight_type ?? null,
    kpi: body.kpi ?? null,
    kpi_goal: body.kpiGoal ?? body.kpi_goal ?? null,
    currency: body.currency ?? undefined,
    timezone: body.timezone ?? undefined,
    notes: body.notes ?? null,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
  };
}

function buildCsvValue(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function handleCampaignRoutes(ctx) {
  const { method, pathname, body, res, requestId, url } = ctx;

  if (method === 'GET' && pathname === '/v1/campaigns') {
    return withSession(ctx, async (session) => {
      const scope = url.searchParams.get('scope');
      const workspaceFilter = url.searchParams.get('workspaceId') || url.searchParams.get('clientId');
      const campaigns = scope === 'all'
        ? await listCampaignsForUser(session.client, session.user.id, {
          status: url.searchParams.get('status'),
          workspaceId: workspaceFilter,
          limit: url.searchParams.get('limit'),
          offset: url.searchParams.get('offset'),
          search: url.searchParams.get('search'),
        })
        : await listCampaigns(session.client, session.session.activeWorkspaceId, {
          status: url.searchParams.get('status'),
          advertiserId: url.searchParams.get('advertiserId'),
          limit: url.searchParams.get('limit'),
          offset: url.searchParams.get('offset'),
          search: url.searchParams.get('search'),
        });
      return sendJson(res, 200, { campaigns: campaigns.map(normalizeCampaign), requestId });
    });
  }

  if (method === 'GET' && /^\/v1\/campaigns\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const id = pathname.split('/')[3];
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      const campaign = await getCampaign(session.client, workspaceId, id);
      if (!campaign) {
        return badRequest(res, requestId, 'Campaign not found.');
      }
      return sendJson(res, 200, { campaign: normalizeCampaign(campaign), requestId });
    });
  }

  if (method === 'POST' && pathname === '/v1/campaigns') {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:create')) {
        return forbidden(res, requestId, 'You do not have permission to create campaigns.');
      }

      const input = parseCampaignInput(body);
      if (!input.name) {
        return badRequest(res, requestId, 'Campaign name is required.');
      }

      try {
        const workspaceId = await resolveTargetWorkspaceId(
          session.client,
          session.user.id,
          session.session.activeWorkspaceId,
          input.workspaceId,
        );
        const campaign = await createCampaign(session.client, workspaceId, input);
        return sendJson(res, 201, { campaign: normalizeCampaign(campaign), requestId });
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'PUT' && /^\/v1\/campaigns\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to update campaigns.');
      }
      const id = pathname.split('/')[3];
      const input = parseCampaignInput(body);
      try {
        const workspaceId = await resolveTargetWorkspaceId(
          session.client,
          session.user.id,
          session.session.activeWorkspaceId,
          input.workspaceId,
        );
        const campaign = await updateCampaign(session.client, workspaceId, id, input);
        if (!campaign) {
          return badRequest(res, requestId, 'Campaign not found.');
        }
        return sendJson(res, 200, { campaign: normalizeCampaign(campaign), requestId });
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'DELETE' && /^\/v1\/campaigns\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:delete')) {
        return forbidden(res, requestId, 'You do not have permission to delete campaigns.');
      }
      const id = pathname.split('/')[3];
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      try {
        const deleted = await deleteCampaign(session.client, workspaceId, id);
        if (!deleted) {
          return badRequest(res, requestId, 'Campaign not found.');
        }
        res.statusCode = 204;
        res.end();
        return true;
      } catch (error) {
        if (error.code === 'CAMPAIGN_HAS_DEPENDENCIES') {
          return conflict(res, requestId, error.message);
        }
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'GET' && /^\/v1\/campaigns\/[^/]+\/tags-export$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const id = pathname.split('/')[3];
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      const campaign = await getCampaign(session.client, workspaceId, id);
      if (!campaign) {
        return badRequest(res, requestId, 'Campaign not found.');
      }
      const { rows } = await session.client.query(
        `SELECT id, name, format, status
         FROM ad_tags
         WHERE workspace_id = $1 AND campaign_id = $2
         ORDER BY created_at DESC`,
        [workspaceId, id],
      );
      const csv = [
        ['campaign', 'tag_id', 'tag_name', 'format', 'status'],
        ...rows.map((row) => [campaign.name, row.id, row.name, row.format, row.status]),
      ].map((line) => line.map(buildCsvValue).join(',')).join('\n');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${campaign.name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase()}-tags.csv"`);
      res.end(csv);
      return true;
    });
  }

  if (method === 'GET' && /^\/v1\/campaigns\/[^/]+\/events-export$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const id = pathname.split('/')[3];
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      const campaign = await getCampaign(session.client, workspaceId, id);
      if (!campaign) {
        return badRequest(res, requestId, 'Campaign not found.');
      }
      const { rows } = await session.client.query(
        `SELECT ie.id, ie.tag_id, ie.timestamp, ie.country, ie.region, ie.city, ie.site_domain, ie.viewable, ie.viewability_duration_ms
         FROM impression_events ie
         JOIN ad_tags t ON t.id = ie.tag_id
         WHERE ie.workspace_id = $1
           AND t.campaign_id = $2
         ORDER BY ie.timestamp DESC
         LIMIT 5000`,
        [workspaceId, id],
      );
      const csv = [
        ['campaign', 'event_id', 'tag_id', 'timestamp', 'country', 'region', 'city', 'site_domain', 'viewable', 'viewability_duration_ms'],
        ...rows.map((row) => [
          campaign.name,
          row.id,
          row.tag_id,
          row.timestamp?.toISOString?.() ?? row.timestamp,
          row.country ?? '',
          row.region ?? '',
          row.city ?? '',
          row.site_domain ?? '',
          row.viewable ?? '',
          row.viewability_duration_ms ?? 0,
        ]),
      ].map((line) => line.map(buildCsvValue).join(',')).join('\n');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${campaign.name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase()}-events.csv"`);
      res.end(csv);
      return true;
    });
  }

  return false;
}
