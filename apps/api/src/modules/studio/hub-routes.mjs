import { getStudioHubOverview } from '@smx/db';
import { hasStudioPermission } from './shared.mjs';

export function handleStudioHubRoutes(app, { requireWorkspace, pool }, deps = { getStudioHubOverview }) {
  app.get('/v1/hub/overview', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'projects:view-client')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }

    const overview = await deps.getStudioHubOverview(pool, req.authSession.userId);
    return reply.send({ overview });
  });
}
