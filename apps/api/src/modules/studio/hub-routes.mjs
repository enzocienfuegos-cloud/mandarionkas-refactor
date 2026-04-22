import { getStudioHubOverview, recordStudioProjectActivity } from '@smx/db';
import { hasStudioPermission } from './shared.mjs';

const MANUAL_ACTIVITY_ACTIONS = new Set(['exported', 'shared']);

export function handleStudioHubRoutes(app, { requireWorkspace, pool }, deps = { getStudioHubOverview, recordStudioProjectActivity }) {
  app.get('/v1/hub/overview', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'projects:view-client')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }

    const overview = await deps.getStudioHubOverview(pool, req.authSession.userId);
    return reply.send({ overview });
  });

  app.post('/v1/hub/projects/:projectId/activity', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'projects:save')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }

    const { action, metadata } = req.body ?? {};
    if (!MANUAL_ACTIVITY_ACTIONS.has(action)) {
      return reply.status(400).send({ message: 'Unsupported activity action' });
    }

    await deps.recordStudioProjectActivity(pool, {
      workspaceId: req.authSession.workspaceId,
      projectId: req.params.projectId,
      actorUserId: req.authSession.userId,
      action,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    });
    return reply.status(204).send();
  });
}
