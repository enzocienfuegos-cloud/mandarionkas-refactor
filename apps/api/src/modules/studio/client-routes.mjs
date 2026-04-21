import {
  buildStudioSessionPayload,
  canManageStudioClient,
  handleCreateStudioBrand,
  handleCreateStudioClient,
  handleInviteStudioMember,
  hasStudioPermission,
  resolveStudioClientAccess,
  resolveStudioCurrentUser,
} from './shared.mjs';

export function handleStudioClientRoutes(app, { requireWorkspace, pool }, deps = {
  buildStudioSessionPayload,
  handleCreateStudioBrand,
  handleCreateStudioClient,
  handleInviteStudioMember,
  resolveStudioClientAccess,
  resolveStudioCurrentUser,
}) {
  app.post('/v1/clients/active', { preHandler: requireWorkspace }, async (req, reply) => {
    const { clientId } = req.body ?? {};
    const userId = req.authSession.userId;
    if (!clientId) {
      return reply.status(400).send({ ok: false, message: 'clientId is required' });
    }

    const access = await deps.resolveStudioClientAccess(pool, clientId, userId);
    if (!access) {
      return reply.status(403).send({ ok: false, message: 'Not a member of this client' });
    }

    req.session.workspaceId = clientId;
    const user = await deps.resolveStudioCurrentUser(pool, userId);
    if (!user) {
      return reply.status(401).send({ ok: false, message: 'Unauthorized' });
    }

    const payload = await deps.buildStudioSessionPayload(pool, req, { user, workspaceId: clientId });
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

    if (!canManageStudioClient(req.authSession)) {
      return reply.status(403).send({ ok: false, message: 'Only owners can create clients' });
    }
    if (!name || !String(name).trim()) {
      return reply.status(400).send({ ok: false, message: 'name is required' });
    }

    const workspaceId = await deps.handleCreateStudioClient(pool, userId, String(name).trim());
    req.session.workspaceId = workspaceId;
    req._auditMeta = {
      action: 'studio.client.created',
      workspace_id: workspaceId,
      resource_type: 'studio_client',
      resource_id: workspaceId,
      metadata: { name: String(name).trim() },
    };

    const user = await deps.resolveStudioCurrentUser(pool, userId);
    const payload = await deps.buildStudioSessionPayload(pool, req, { user, workspaceId });
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
    const access = await deps.resolveStudioClientAccess(pool, clientId, req.authSession.userId);

    if (!access || !hasStudioPermission(req.authSession, 'brandkits:manage', access.role)) {
      return reply.status(403).send({ ok: false, message: 'Insufficient permissions' });
    }
    if (!name || !primaryColor) {
      return reply.status(400).send({ ok: false, message: 'name and primaryColor are required' });
    }

    await deps.handleCreateStudioBrand(pool, clientId, { name: String(name).trim(), primaryColor });
    req._auditMeta = {
      action: 'studio.brand.created',
      workspace_id: clientId,
      resource_type: 'studio_brand',
      resource_id: clientId,
      metadata: { name: String(name).trim(), primaryColor },
    };
    const user = await deps.resolveStudioCurrentUser(pool, req.authSession.userId);
    const payload = await deps.buildStudioSessionPayload(pool, req, { user, workspaceId: req.session.workspaceId ?? clientId });
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
    const access = await deps.resolveStudioClientAccess(pool, clientId, req.authSession.userId);

    if (!access || !hasStudioPermission(req.authSession, 'clients:invite', access.role)) {
      return reply.status(403).send({ ok: false, message: 'Insufficient permissions' });
    }
    if (!email || !role) {
      return reply.status(400).send({ ok: false, message: 'email and role are required' });
    }

    await deps.handleInviteStudioMember(pool, clientId, req.authSession.userId, { email, role });
    req._auditMeta = {
      action: 'studio.invite.created',
      workspace_id: clientId,
      resource_type: 'user',
      resource_id: email.toLowerCase(),
      metadata: { email: email.toLowerCase(), role },
    };
    const user = await deps.resolveStudioCurrentUser(pool, req.authSession.userId);
    const payload = await deps.buildStudioSessionPayload(pool, req, { user, workspaceId: req.session.workspaceId ?? clientId });
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
