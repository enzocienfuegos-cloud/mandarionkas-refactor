import { badRequest, sendJson, serviceUnavailable, unauthorized } from '../../../lib/http.mjs';
import {
  createExperiment,
  getExperiment,
  getExperimentResults,
  listExperiments,
  startExperiment,
  stopExperiment,
  updateExperiment,
} from '@smx/db/src/experiments.mjs';
import { withSession } from '../../../lib/session.mjs';

function getWorkspaceId(session) {
  return session.session.activeWorkspaceId || session.workspaces[0]?.id || null;
}

export async function handleExperimentRoutes(ctx) {
  const { method, pathname, requestId, res, body } = ctx;

  if (method === 'GET' && pathname === '/v1/experiments') {
    return withSession(ctx, async (session) => {
      const experiments = await listExperiments(session.client, getWorkspaceId(session));
      return sendJson(res, 200, { experiments, requestId });
    });
  }

  if (method === 'POST' && pathname === '/v1/experiments') {
    return withSession(ctx, async (session) => {
      if (!body || typeof body !== 'object') return badRequest(res, requestId, 'Experiment payload is required.');
      try {
        const experiment = await createExperiment(session.client, getWorkspaceId(session), session.user.id, body);
        return sendJson(res, 201, { experiment, requestId });
      } catch (error) {
        return badRequest(res, requestId, error?.message || 'Failed to create experiment.');
      }
    });
  }

  if (method === 'GET' && /^\/v1\/experiments\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const experimentId = pathname.split('/')[3];
      const experiment = await getExperiment(session.client, getWorkspaceId(session), experimentId);
      if (!experiment) return badRequest(res, requestId, 'Experiment not found.');
      return sendJson(res, 200, { experiment, requestId });
    });
  }

  if (method === 'PUT' && /^\/v1\/experiments\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!body || typeof body !== 'object') return badRequest(res, requestId, 'Experiment payload is required.');
      const experimentId = pathname.split('/')[3];
      try {
        const experiment = await updateExperiment(session.client, getWorkspaceId(session), experimentId, body);
        return sendJson(res, 200, { experiment, requestId });
      } catch (error) {
        return badRequest(res, requestId, error?.message || 'Failed to update experiment.');
      }
    });
  }

  if (method === 'POST' && /^\/v1\/experiments\/[^/]+\/start$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const experimentId = pathname.split('/')[3];
      try {
        const experiment = await startExperiment(session.client, getWorkspaceId(session), experimentId);
        return sendJson(res, 200, { experiment, requestId });
      } catch (error) {
        return badRequest(res, requestId, error?.message || 'Failed to start experiment.');
      }
    });
  }

  if (method === 'POST' && /^\/v1\/experiments\/[^/]+\/stop$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const experimentId = pathname.split('/')[3];
      try {
        const experiment = await stopExperiment(session.client, getWorkspaceId(session), experimentId);
        return sendJson(res, 200, { experiment, requestId });
      } catch (error) {
        return badRequest(res, requestId, error?.message || 'Failed to stop experiment.');
      }
    });
  }

  if (method === 'GET' && /^\/v1\/experiments\/[^/]+\/results$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const experimentId = pathname.split('/')[3];
      try {
        const results = await getExperimentResults(session.client, getWorkspaceId(session), experimentId);
        return sendJson(res, 200, { results, requestId });
      } catch (error) {
        return badRequest(res, requestId, error?.message || 'Failed to load experiment results.');
      }
    });
  }

  return false;
}
