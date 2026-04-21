import {
  buildStudioSessionPayload,
  handleCreateStudioBrand,
  handleCreateStudioClient,
  handleInviteStudioMember,
  resolveStudioCurrentUser,
} from './shared.mjs';

export function handleStudioClientRoutes(app, { requireWorkspace, pool }) {
  app.post('/v1/clients/active', { preHandler: requireWorkspace }, async (req, reply) => {
    const { clientId } = req.body ?? {};
    const userId = req.authSession.userId;
    if (!clientId) {
      return reply.status(400).send({ ok: false, message: 'clientId is required' });
    }

    req.session.workspaceId = clientId;
    const user = await resolveStudioCurrentUser(pool, userId);
    if (!user) {
      return reply.status(401).send({ ok: false, message: 'Unauthorized' });
    }

    const payload = await buildStudioSessionPayload(pool, req, { user, workspaceId: clientId });
    return reply.send({
      ok: true,
      activeClientId: payload.activeClientId,
      activeWorkspaceId: payload.activeWorkspaceId,
      clients: payload.clients,
      workspaces: payload.workspaces,
    });
  });

  app.post('/v1/clients', { preHandler: requireWorkspace }, async (req, reply) => {
    const { name } = req.body ?? {};
    const userId = req.authSession.userId;
    const role = req.authSession.role;

    if (role !== 'owner') {
      return reply.status(403).send({ ok: false, message: 'Only owners can create clients' });
    }
    if (!name || !String(name).trim()) {
      return reply.status(400).send({ ok: false, message: 'name is required' });
    }

    const workspaceId = await handleCreateStudioClient(pool, userId, String(name).trim());
    req.session.workspaceId = workspaceId;

    const user = await resolveStudioCurrentUser(pool, userId);
    const payload = await buildStudioSessionPayload(pool, req, { user, workspaceId });
    const client = payload.clients.find((item) => item.id === workspaceId);

    return reply.send({
      ok: true,
      client,
      workspace: client,
      activeClientId: payload.activeClientId,
      activeWorkspaceId: payload.activeWorkspaceId,
      clients: payload.clients,
      workspaces: payload.workspaces,
    });
  });

  app.post('/v1/clients/:clientId/brands', { preHandler: requireWorkspace }, async (req, reply) => {
    const { clientId } = req.params;
    const { name, primaryColor } = req.body ?? {};
    const studioRole = req.authSession.role === 'viewer' ? 'reviewer' : req.authSession.role === 'owner' ? 'owner' : 'editor';

    if (studioRole === 'reviewer') {
      return reply.status(403).send({ ok: false, message: 'Insufficient permissions' });
    }
    if (!name || !primaryColor) {
      return reply.status(400).send({ ok: false, message: 'name and primaryColor are required' });
    }

    await handleCreateStudioBrand(pool, clientId, { name: String(name).trim(), primaryColor });
    const user = await resolveStudioCurrentUser(pool, req.authSession.userId);
    const payload = await buildStudioSessionPayload(pool, req, { user, workspaceId: req.session.workspaceId ?? clientId });
    const client = payload.clients.find((item) => item.id === clientId);
    return reply.send({
      ok: true,
      client,
      workspace: client,
      clients: payload.clients,
      workspaces: payload.workspaces,
    });
  });

  app.post('/v1/clients/:clientId/invites', { preHandler: requireWorkspace }, async (req, reply) => {
    const { clientId } = req.params;
    const { email, role } = req.body ?? {};
    const studioRole = req.authSession.role === 'viewer' ? 'reviewer' : req.authSession.role === 'owner' ? 'owner' : 'editor';
    if (studioRole === 'reviewer') {
      return reply.status(403).send({ ok: false, message: 'Insufficient permissions' });
    }
    if (!email || !role) {
      return reply.status(400).send({ ok: false, message: 'email and role are required' });
    }

    await handleInviteStudioMember(pool, clientId, req.authSession.userId, { email, role });
    const user = await resolveStudioCurrentUser(pool, req.authSession.userId);
    const payload = await buildStudioSessionPayload(pool, req, { user, workspaceId: req.session.workspaceId ?? clientId });
    const client = payload.clients.find((item) => item.id === clientId);
    return reply.send({
      ok: true,
      message: `Invitation sent to ${email}`,
      client,
      workspace: client,
      clients: payload.clients,
      workspaces: payload.workspaces,
    });
  });
}
