import {
  getWorkspace,
  updateWorkspace,
} from '@smx/db/team';

export function handleWorkspaceRoutes(app, { requireWorkspace, pool }) {
  // GET /v1/workspace — get current workspace
  app.get('/v1/workspace', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;

    const workspace = await getWorkspace(pool, workspaceId);
    if (!workspace) {
      return reply.status(404).send({ error: 'Not Found', message: 'Workspace not found' });
    }

    return reply.send({ workspace });
  });

  // PUT /v1/workspace — update workspace (owner only)
  app.put('/v1/workspace', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId, role } = req.authSession;

    if (role !== 'owner') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only the workspace owner can update workspace settings' });
    }

    const { name, plan, logoUrl, settings } = req.body ?? {};

    const data = {};
    if (name !== undefined) data.name = name;
    if (plan !== undefined) data.plan = plan;
    if (logoUrl !== undefined) data.logo_url = logoUrl;
    if (settings !== undefined) data.settings = settings;

    if (Object.keys(data).length === 0) {
      const workspace = await getWorkspace(pool, workspaceId);
      return reply.send({ workspace });
    }

    const workspace = await updateWorkspace(pool, workspaceId, data);
    if (!workspace) {
      return reply.status(404).send({ error: 'Not Found', message: 'Workspace not found' });
    }

    return reply.send({ workspace });
  });
}
