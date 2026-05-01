import { badRequest, sendJson, serviceUnavailable, unauthorized } from '../../../lib/http.mjs';
import {
  getDiscrepancySummary,
  getDiscrepancyThresholds,
  listDiscrepancies,
  updateDiscrepancyThresholds,
} from '@smx/db/src/discrepancies.mjs';
import { withSession } from '../../../lib/session.mjs';

function getOpts(url) {
  return {
    dateFrom: url.searchParams.get('dateFrom') || undefined,
    dateTo: url.searchParams.get('dateTo') || undefined,
    severity: url.searchParams.get('severity') || undefined,
  };
}

export async function handleDiscrepancyRoutes(ctx) {
  const { method, pathname, requestId, res, url, body } = ctx;

  if (method === 'GET' && pathname === '/v1/discrepancies') {
    return withSession(ctx, async (session) => {
      const reports = await listDiscrepancies(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { reports, requestId });
    });
  }

  if (method === 'GET' && pathname === '/v1/discrepancies/summary') {
    return withSession(ctx, async (session) => {
      const summary = await getDiscrepancySummary(session.client, session.session.activeWorkspaceId, getOpts(url));
      return sendJson(res, 200, { summary, requestId });
    });
  }

  if (method === 'GET' && pathname === '/v1/discrepancies/thresholds') {
    return withSession(ctx, async (session) => {
      const thresholds = await getDiscrepancyThresholds(session.client, session.session.activeWorkspaceId);
      return sendJson(res, 200, { thresholds, requestId });
    });
  }

  if (method === 'PUT' && pathname === '/v1/discrepancies/thresholds') {
    return withSession(ctx, async (session) => {
      if (!body || typeof body !== 'object') {
        return badRequest(res, requestId, 'Threshold payload is required.');
      }
      const thresholds = await updateDiscrepancyThresholds(
        session.client,
        session.session.activeWorkspaceId,
        session.user.id,
        body,
      );
      return sendJson(res, 200, { thresholds, requestId });
    });
  }

  return false;
}
