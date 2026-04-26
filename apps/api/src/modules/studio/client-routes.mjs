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
import {
  updateWorkspace,
  inviteMember,
  removeMember,
  updateMemberRole,
  updateMemberProductAccess,
  listUsersWithWorkspaceAccess,
  listStudioClientsForUser,
  listWorkspacesForUser,
  getMember,
  mapWorkspaceRoleToDbRole,
} from '@smx/db';

export function handleStudioClientRoutes(app, { requireWorkspace, pool }, deps = {
  buildStudioSessionPayload,
  handleCreateStudioBrand,
  handleCreateStudioClient,
  handleInviteStudioMember,
  resolveStudioClientAccess,
  resolveStudioCurrentUser,
}) {
  app.get('/v1/clients/access', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!req.authSession.productAccess?.ad_server) {
      return reply.status(403).send({ ok: false, message: 'No Ad Server access for this workspace' });
    }
    const clients = await listWorkspacesForUser(pool, req.authSession.userId);
    const manageableClients = clients.filter((client) => client.role === 'owner' || client.role === 'admin');
    const users = await listUsersWithWorkspaceAccess(pool, manageableClients.map((client) => client.id));
    return reply.send({
      clients: manageableClients.map((client) => ({
        id: client.id,
        name: client.name,
        role: client.role,
      })),
      users,
    });
  });

  app.post('/v1/clients/access', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!req.authSession.productAccess?.ad_server) {
      return reply.status(403).send({ ok: false, message: 'No Ad Server access for this workspace' });
    }
    const { email, role = 'editor', workspaceIds = [], productAccess } = req.body ?? {};
    if (!email || !String(email).trim()) {
      return reply.status(400).send({ ok: false, message: 'email is required' });
    }
    if (!Array.isArray(workspaceIds) || workspaceIds.length === 0) {
      return reply.status(400).send({ ok: false, message: 'Select at least one client' });
    }
    if (!['owner', 'editor', 'reviewer'].includes(role)) {
      return reply.status(400).send({ ok: false, message: 'role must be one of: owner, editor, reviewer' });
    }
    if (!productAccess || (productAccess.ad_server !== true && productAccess.studio !== true)) {
      return reply.status(400).send({ ok: false, message: 'Select at least one product access' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    for (const workspaceId of workspaceIds) {
      const member = await getMember(pool, workspaceId, req.authSession.userId);
      if (!member || member.status !== 'active' || (member.role !== 'owner' && member.role !== 'admin')) {
        return reply.status(403).send({ ok: false, message: 'Insufficient permissions for one or more selected clients' });
      }
      if (role === 'owner' && member.role !== 'owner') {
        return reply.status(403).send({ ok: false, message: 'Only owners can assign owner access' });
      }
    }

    for (const workspaceId of workspaceIds) {
      await inviteMember(pool, workspaceId, {
        email: normalizedEmail,
        role: mapWorkspaceRoleToDbRole(role),
        invited_by: req.authSession.userId,
        product_access: productAccess,
      });
    }

    req._auditMeta = {
      action: 'user.invited',
      workspace_id: req.authSession.workspaceId,
      resource_type: 'user',
      resource_id: normalizedEmail,
      metadata: { email: normalizedEmail, role, workspaceIds },
    };

    return reply.status(201).send({ ok: true, message: `Access granted to ${normalizedEmail}` });
  });

  app.delete('/v1/clients/:clientId/access/:userId', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!req.authSession.productAccess?.ad_server) {
      return reply.status(403).send({ ok: false, message: 'No Ad Server access for this workspace' });
    }
    const { clientId, userId } = req.params;
    const member = await getMember(pool, clientId, req.authSession.userId);
    if (!member || member.status !== 'active' || (member.role !== 'owner' && member.role !== 'admin')) {
      return reply.status(403).send({ ok: false, message: 'Insufficient permissions' });
    }
    try {
      const removed = await removeMember(pool, clientId, userId);
      if (!removed) {
        return reply.status(404).send({ ok: false, message: 'Member not found' });
      }
    } catch (error) {
      return reply.status(400).send({ ok: false, message: error.message });
    }
    return reply.status(204).send();
  });

  app.put('/v1/clients/:clientId/access/:userId', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!req.authSession.productAccess?.ad_server) {
      return reply.status(403).send({ ok: false, message: 'No Ad Server access for this workspace' });
    }
    const { clientId, userId } = req.params;
    const { role, productAccess } = req.body ?? {};
    if (!['owner', 'editor', 'reviewer'].includes(role)) {
      return reply.status(400).send({ ok: false, message: 'role must be one of: owner, editor, reviewer' });
    }
    if (!productAccess || (productAccess.ad_server !== true && productAccess.studio !== true)) {
      return reply.status(400).send({ ok: false, message: 'Select at least one product access' });
    }

    const actingMember = await getMember(pool, clientId, req.authSession.userId);
    if (!actingMember || actingMember.status !== 'active' || (actingMember.role !== 'owner' && actingMember.role !== 'admin')) {
      return reply.status(403).send({ ok: false, message: 'Insufficient permissions' });
    }
    if (role === 'owner' && actingMember.role !== 'owner') {
      return reply.status(403).send({ ok: false, message: 'Only owners can assign owner access' });
    }

    const dbRole = mapWorkspaceRoleToDbRole(role);
    const nextRole = await updateMemberRole(pool, clientId, userId, dbRole);
    if (!nextRole) {
      return reply.status(404).send({ ok: false, message: 'Member not found' });
    }
    const nextAccess = await updateMemberProductAccess(pool, clientId, userId, productAccess);
    if (!nextAccess) {
      return reply.status(404).send({ ok: false, message: 'Member not found' });
    }

    req._auditMeta = {
      action: 'user.role_changed',
      workspace_id: clientId,
      resource_type: 'user',
      resource_id: userId,
      metadata: { role: dbRole, productAccess },
    };

    return reply.send({ ok: true });
  });

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
    if (!req.authSession.productAccess?.ad_server) {
      return reply.status(403).send({ ok: false, message: 'No Ad Server access for this workspace' });
    }
    const { name, website = '' } = req.body ?? {};
    const userId = req.authSession.userId;

    if (!canManageStudioClient(req.authSession)) {
      return reply.status(403).send({ ok: false, message: 'Only owners can create clients' });
    }
    if (!name || !String(name).trim()) {
      return reply.status(400).send({ ok: false, message: 'name is required' });
    }

    const workspaceId = await deps.handleCreateStudioClient(pool, userId, String(name).trim());
    const settingsPatch = {
      website: String(website ?? '').trim() || null,
    };
    if (settingsPatch.website) {
      const currentWorkspace = await updateWorkspace(pool, workspaceId, {
        settings: settingsPatch,
      });
      req._auditMeta = {
        action: 'studio.client.created',
        workspace_id: workspaceId,
        resource_type: 'studio_client',
        resource_id: workspaceId,
        metadata: {
          name: String(name).trim(),
          website: currentWorkspace?.settings?.website ?? settingsPatch.website,
        },
      };
    }
    req.session.workspaceId = workspaceId;
    req._auditMeta = {
      action: 'studio.client.created',
      workspace_id: workspaceId,
      resource_type: 'studio_client',
      resource_id: workspaceId,
      metadata: { name: String(name).trim(), website: settingsPatch.website },
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
