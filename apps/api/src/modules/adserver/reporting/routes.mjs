import { sendJson, serviceUnavailable, unauthorized } from '../../../lib/http.mjs';
import { requireAuthenticatedSession } from '../../auth/service.mjs';
import {
  getWorkspaceCampaignBreakdown,
  getWorkspaceCityBreakdown,
  getWorkspaceContextSnapshot,
  getWorkspaceCountryBreakdown,
  getWorkspaceCreativeBreakdown,
  getWorkspaceEngagementBreakdown,
  getWorkspaceOverview,
  getWorkspaceRegionBreakdown,
  getWorkspaceSiteBreakdown,
  getWorkspaceTagBreakdown,
  getWorkspaceTimeline,
  getWorkspaceTrackerBreakdown,
  getWorkspaceVariantBreakdown,
} from '../../../../../../packages/db/src/reporting.mjs';

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

function getOpts(url) {
  return {
    dateFrom: url.searchParams.get('dateFrom') || undefined,
    dateTo: url.searchParams.get('dateTo') || undefined,
    campaignId: url.searchParams.get('campaignId') || undefined,
    tagId: url.searchParams.get('tagId') || undefined,
    tagIds: (url.searchParams.get('tagIds') || '').split(',').map((item) => item.trim()).filter(Boolean),
    limit: url.searchParams.get('limit') || undefined,
  };
}

function emptyBreakdown(requestId) {
  return { breakdown: [], requestId };
}

export async function handleReportingRoutes(ctx) {
  const { method, pathname, res, requestId, url } = ctx;
  if (method !== 'GET') {
    return false;
  }

  if (pathname === '/v1/reporting/workspace') {
    return withSession(ctx, async (session) => {
      const opts = getOpts(url);
      const [stats, timeline] = await Promise.all([
        getWorkspaceOverview(session.client, session.session.activeWorkspaceId, opts),
        getWorkspaceTimeline(session.client, session.session.activeWorkspaceId, opts),
      ]);
      return sendJson(res, 200, { stats, timeline, requestId });
    });
  }

  if (pathname === '/v1/reporting/workspace/campaign-breakdown') {
    return withSession(ctx, async (session) => {
      const breakdown = await getWorkspaceCampaignBreakdown(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { breakdown, requestId });
    });
  }

  if (pathname === '/v1/reporting/workspace/tag-breakdown') {
    return withSession(ctx, async (session) => {
      const breakdown = await getWorkspaceTagBreakdown(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { breakdown, requestId });
    });
  }

  if (pathname === '/v1/reporting/workspace/site-breakdown') {
    return withSession(ctx, async (session) => {
      const breakdown = await getWorkspaceSiteBreakdown(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { breakdown, requestId });
    });
  }

  if (pathname === '/v1/reporting/workspace/country-breakdown') {
    return withSession(ctx, async (session) => {
      const breakdown = await getWorkspaceCountryBreakdown(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { breakdown, requestId });
    });
  }

  if (pathname === '/v1/reporting/workspace/region-breakdown') {
    return withSession(ctx, async (session) => {
      const breakdown = await getWorkspaceRegionBreakdown(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { breakdown, requestId });
    });
  }

  if (pathname === '/v1/reporting/workspace/city-breakdown') {
    return withSession(ctx, async (session) => {
      const breakdown = await getWorkspaceCityBreakdown(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { breakdown, requestId });
    });
  }

  if (pathname === '/v1/reporting/workspace/tracker-breakdown') {
    return withSession(ctx, async (session) => {
      const breakdown = await getWorkspaceTrackerBreakdown(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { breakdown, requestId });
    });
  }

  if (pathname === '/v1/reporting/workspace/engagement-breakdown') {
    return withSession(ctx, async (session) => {
      const breakdown = await getWorkspaceEngagementBreakdown(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { breakdown, requestId });
    });
  }

  if (pathname === '/v1/reporting/workspace/creative-breakdown') {
    return withSession(ctx, async (session) => {
      const breakdown = await getWorkspaceCreativeBreakdown(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { breakdown, requestId });
    });
  }

  if (pathname === '/v1/reporting/workspace/variant-breakdown') {
    return withSession(ctx, async (session) => {
      const breakdown = await getWorkspaceVariantBreakdown(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { breakdown, requestId });
    });
  }

  if (pathname === '/v1/reporting/workspace/context-snapshot') {
    return withSession(ctx, async (session) => {
      const payload = await getWorkspaceContextSnapshot(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { ...payload, requestId });
    });
  }

  if (
    pathname === '/v1/reporting/workspace/identity-breakdown'
    || pathname === '/v1/reporting/workspace/identity-frequency-buckets'
    || pathname === '/v1/reporting/workspace/identity-segment-presets'
    || pathname === '/v1/reporting/workspace/identity-key-breakdown'
    || pathname === '/v1/reporting/workspace/identity-attribution-windows'
  ) {
    return withSession(ctx, async () => sendJson(res, 200, emptyBreakdown(requestId)));
  }

  if (pathname === '/v1/reporting/workspace/saved-audiences') {
    return withSession(ctx, async () => sendJson(res, 200, { audiences: [], requestId }));
  }

  return false;
}
