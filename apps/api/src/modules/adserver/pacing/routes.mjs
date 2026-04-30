import { badRequest, sendJson, serviceUnavailable, unauthorized } from '../../../lib/http.mjs';
import { requireAuthenticatedSession } from '../../auth/service.mjs';
import {
  getCampaignPacingBreakdown,
  listWorkspacePacingAlerts,
  listWorkspacePacingCampaigns,
} from '../../../../../../packages/db/src/pacing.mjs';

async function withSession(ctx, callback) {
  const session = await requireAuthenticatedSession({ env: ctx.env, headers: ctx.req.headers });
  if (!session.ok) {
    if (session.statusCode === 503) return serviceUnavailable(ctx.res, ctx.requestId, session.message);
    if (session.statusCode === 401) return unauthorized(ctx.res, ctx.requestId, session.message);
    return false;
  }

  try {
    return await callback(session);
  } finally {
    await session.finish();
  }
}

export async function handlePacingRoutes(ctx) {
  const { method, pathname, requestId, res, url } = ctx;

  if (method === 'GET' && pathname === '/v1/pacing') {
    return withSession(ctx, async (session) => {
      const campaigns = await listWorkspacePacingCampaigns(session.client, session.session.activeWorkspaceId);
      return sendJson(res, 200, { campaigns, requestId });
    });
  }

  if (method === 'GET' && pathname === '/v1/pacing/alerts') {
    return withSession(ctx, async (session) => {
      const alerts = await listWorkspacePacingAlerts(session.client, session.session.activeWorkspaceId);
      return sendJson(res, 200, { alerts, requestId });
    });
  }

  if (method === 'GET' && /^\/v1\/pacing\/[^/]+\/breakdown$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const campaignId = pathname.split('/')[3];
      if (!campaignId) return badRequest(res, requestId, 'Campaign id is required.');
      const breakdown = await getCampaignPacingBreakdown(
        session.client,
        session.session.activeWorkspaceId,
        campaignId,
        { days: url.searchParams.get('days') },
      );
      return sendJson(res, 200, { breakdown, requestId });
    });
  }

  return false;
}
