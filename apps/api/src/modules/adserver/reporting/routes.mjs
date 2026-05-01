import { badRequest, sendJson, serviceUnavailable, unauthorized } from '../../../lib/http.mjs';
import {
  createSavedAudience,
  deleteSavedAudience,
  getWorkspaceCampaignBreakdown,
  getWorkspaceCityBreakdown,
  getWorkspaceContextSnapshot,
  getWorkspaceCountryBreakdown,
  getWorkspaceCreativeBreakdown,
  getWorkspaceEngagementBreakdown,
  getWorkspaceOverview,
  getWorkspaceRegionBreakdown,
  getWorkspaceTimeline,
  getWorkspaceSiteBreakdown,
  getWorkspaceTagBreakdown,
  getWorkspaceTrackerBreakdown,
  getWorkspaceVariantBreakdown,
  listSavedAudiences,
} from '@smx/db/src/reporting.mjs';
import { withSession } from '../../../lib/session.mjs';

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

  if (method === 'GET' && pathname === '/v1/reporting/workspace') {
    return withSession(ctx, async (session) => {
      const opts = getOpts(url);
      const [stats, timeline] = await Promise.all([
        getWorkspaceOverview(session.client, session.session.activeWorkspaceId, opts),
        getWorkspaceTimeline(session.client, session.session.activeWorkspaceId, opts),
      ]);
      return sendJson(res, 200, { stats, timeline, requestId });
    });
  }

  if (method === 'GET' && pathname === '/v1/reporting/workspace/campaign-breakdown') {
    return withSession(ctx, async (session) => {
      const breakdown = await getWorkspaceCampaignBreakdown(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { breakdown, requestId });
    });
  }

  if (method === 'GET' && pathname === '/v1/reporting/workspace/tag-breakdown') {
    return withSession(ctx, async (session) => {
      const breakdown = await getWorkspaceTagBreakdown(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { breakdown, requestId });
    });
  }

  if (method === 'GET' && pathname === '/v1/reporting/workspace/site-breakdown') {
    return withSession(ctx, async (session) => {
      const breakdown = await getWorkspaceSiteBreakdown(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { breakdown, requestId });
    });
  }

  if (method === 'GET' && pathname === '/v1/reporting/workspace/country-breakdown') {
    return withSession(ctx, async (session) => {
      const breakdown = await getWorkspaceCountryBreakdown(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { breakdown, requestId });
    });
  }

  if (method === 'GET' && pathname === '/v1/reporting/workspace/region-breakdown') {
    return withSession(ctx, async (session) => {
      const breakdown = await getWorkspaceRegionBreakdown(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { breakdown, requestId });
    });
  }

  if (method === 'GET' && pathname === '/v1/reporting/workspace/city-breakdown') {
    return withSession(ctx, async (session) => {
      const breakdown = await getWorkspaceCityBreakdown(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { breakdown, requestId });
    });
  }

  if (method === 'GET' && pathname === '/v1/reporting/workspace/tracker-breakdown') {
    return withSession(ctx, async (session) => {
      const breakdown = await getWorkspaceTrackerBreakdown(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { breakdown, requestId });
    });
  }

  if (method === 'GET' && pathname === '/v1/reporting/workspace/engagement-breakdown') {
    return withSession(ctx, async (session) => {
      const breakdown = await getWorkspaceEngagementBreakdown(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { breakdown, requestId });
    });
  }

  if (method === 'GET' && pathname === '/v1/reporting/workspace/creative-breakdown') {
    return withSession(ctx, async (session) => {
      const breakdown = await getWorkspaceCreativeBreakdown(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { breakdown, requestId });
    });
  }

  if (method === 'GET' && pathname === '/v1/reporting/workspace/variant-breakdown') {
    return withSession(ctx, async (session) => {
      const breakdown = await getWorkspaceVariantBreakdown(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { breakdown, requestId });
    });
  }

  if (method === 'GET' && pathname === '/v1/reporting/workspace/context-snapshot') {
    return withSession(ctx, async (session) => {
      const payload = await getWorkspaceContextSnapshot(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { ...payload, requestId });
    });
  }

  if (
    method === 'GET' && (
    pathname === '/v1/reporting/workspace/identity-breakdown'
    || pathname === '/v1/reporting/workspace/identity-frequency-buckets'
    || pathname === '/v1/reporting/workspace/identity-segment-presets'
    || pathname === '/v1/reporting/workspace/identity-key-breakdown'
    || pathname === '/v1/reporting/workspace/identity-attribution-windows'
    )
  ) {
    return withSession(ctx, async () => sendJson(res, 200, emptyBreakdown(requestId)));
  }

  if (method === 'GET' && pathname === '/v1/reporting/workspace/saved-audiences') {
    return withSession(ctx, async (session) => {
      const audiences = await listSavedAudiences(session.client, session.session.activeWorkspaceId);
      return sendJson(res, 200, { audiences, requestId });
    });
  }

  if (method === 'POST' && pathname === '/v1/reporting/workspace/saved-audiences') {
    return withSession(ctx, async (session) => {
      const payload = await createSavedAudience(
        session.client,
        session.session.activeWorkspaceId,
        session.user.id,
        ctx.body ?? {},
      );
      return sendJson(res, 201, { audience: payload, requestId });
    });
  }

  if (method === 'DELETE' && /^\/v1\/reporting\/workspace\/saved-audiences\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const audienceId = pathname.split('/')[4];
      const deleted = await deleteSavedAudience(session.client, session.session.activeWorkspaceId, audienceId);
      if (!deleted) return badRequest(res, requestId, 'Saved audience not found.');
      res.statusCode = 204;
      res.end();
      return true;
    });
  }

  if (method === 'GET' && pathname === '/v1/reporting/workspace/identity-export') {
    return withSession(ctx, async () => {
      const csv = [
        'identity_type,identity_value,impressions,clicks,ctr,country,region,city',
      ].join('\n');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="identity-report.csv"');
      res.end(csv);
      return true;
    });
  }

  if (method === 'GET' && pathname === '/v1/reporting/workspace/identity-audience-export') {
    return withSession(ctx, async () => {
      const csv = [
        'canonical_type,country,site_domain,region,city,segment_preset,campaign_id,tag_id,creative_id,variant_id,min_impressions,min_clicks,activation_template',
      ].join('\n');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="identity-audience-export.csv"');
      res.end(csv);
      return true;
    });
  }

  return false;
}
