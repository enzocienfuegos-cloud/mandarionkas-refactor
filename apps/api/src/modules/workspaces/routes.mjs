import { badRequest, forbidden, sendJson, serviceUnavailable, unauthorized } from '../../lib/http.mjs';
import { withSession, hasPermission } from '../../lib/session.mjs';
import {
  createBrandForWorkspace,
  createWorkspaceForUser,
  getWorkspaceById,
  inviteMemberToWorkspace,
  listClientAccessAssignments,
  listWorkspaceTeamMembers,
  listWorkspacesForUser,
  removeWorkspaceMember,
  setSessionActiveWorkspace,
  updateWorkspaceMemberRole,
  updateWorkspaceProfile,
} from './service.mjs';
import { listRecentAuditEvents, recordAuditEvent } from '@smx/db/src/audit.mjs';

const COMPAT_HEADERS = {
  Deprecation: 'true',
  Sunset: 'Wed, 30 Sep 2026 23:59:59 GMT',
  Link: '</v1/workspaces>; rel="successor-version"',
};

function emptyDiagnostics() {
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    backend: 'postgres+r2',
    storageModel: 'managed-postgresql + object-storage',
    legacyStorePresent: false,
    compatibilityRoutesDeprecated: true,
    notes: ['Legacy R2-sidecar diagnostics are retired in the new platform.'],
  };
}



function workspacesPayload(session, workspaces, activeWorkspaceId) {
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || workspaces[0] || null;
  return {
    ok: true,
    requestId: undefined,
    activeWorkspaceId,
    activeClientId: activeWorkspaceId,
    productAccess: activeWorkspace?.product_access || { ad_server: true, studio: true },
    workspaces,
    clients: workspaces,
    user: session.user,
    permissions: session.permissions,
  };
}

function getActiveWorkspaceId(session) {
  return session.session.activeWorkspaceId || session.workspaces[0]?.id || null;
}

function normalizeClientAccessRole(role) {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'admin') return 'admin';
  if (value === 'designer') return 'member';
  if (value === 'ad_ops') return 'member';
  if (value === 'reviewer') return 'viewer';
  if (value === 'editor') return 'member';
  if (value === 'owner') return 'owner';
  return 'member';
}

function normalizeTeamRole(role) {
  return normalizeClientAccessRole(role);
}

function defaultProductAccessForPlatformRole(role, explicitAccess) {
  if (explicitAccess && typeof explicitAccess === 'object') return explicitAccess;
  const value = String(role || '').trim().toLowerCase();
  if (value === 'designer') return { ad_server: false, studio: true };
  if (value === 'ad_ops') return { ad_server: true, studio: false };
  return { ad_server: true, studio: true };
}

function serializeWorkspaceForSettings(workspace) {
  if (!workspace) return null;
  return {
    id: workspace.id,
    name: workspace.name,
    plan: 'free',
    createdAt: workspace.created_at?.toISOString?.() || workspace.createdAt || null,
    updatedAt: workspace.updated_at?.toISOString?.() || workspace.updatedAt || null,
  };
}

export async function handleWorkspaceRoutes(ctx) {
  const { method, pathname, body, res, requestId } = ctx;

  if (method === 'GET' && pathname === '/v1/workspaces') {
    return withSession(ctx, async (session) => sendJson(res, 200, { ...workspacesPayload(session, session.workspaces, session.session.activeWorkspaceId), requestId }));
  }

  if (method === 'POST' && pathname === '/v1/workspaces') {
    return withSession(ctx, async (session) => {
      const responseHeaders = ctx.compatHeaders || undefined;
      if (!hasPermission(session, 'clients:create')) {
        return forbidden(res, requestId, 'You do not have permission to create workspaces.');
      }
      const name = String(body?.name || '').trim();
      if (!name) {
        return badRequest(res, requestId, 'Workspace name is required.');
      }

      await session.client.query('begin');
      try {
        const workspace = await createWorkspaceForUser(session.client, { name, ownerUserId: session.user.id });
        await setSessionActiveWorkspace(session.client, {
          sessionId: session.session.id,
          workspaceId: workspace.id,
          userId: session.user.id,
        });
        await recordAuditEvent(session.client, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          action: 'workspace.created',
          targetType: 'workspace',
          targetId: workspace.id,
          payload: { name: workspace.name, slug: workspace.slug },
        });
        const workspaces = await listWorkspacesForUser(session.client, session.user.id);
        await session.client.query('commit');
        return sendJson(res, 201, {
          ok: true,
          requestId,
          workspace,
          client: workspace,
          activeWorkspaceId: workspace.id,
          activeClientId: workspace.id,
          workspaces,
          clients: workspaces,
        }, responseHeaders);
      } catch (error) {
        await session.client.query('rollback');
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'GET' && pathname === '/v1/workspace') {
    return withSession(ctx, async (session) => {
      const workspaceId = getActiveWorkspaceId(session);
      if (!workspaceId) {
        return badRequest(res, requestId, 'No active workspace available.');
      }
      const workspace = await getWorkspaceById(session.client, workspaceId);
      return sendJson(res, 200, { ok: true, requestId, workspace: serializeWorkspaceForSettings(workspace) });
    });
  }

  if (method === 'PUT' && pathname === '/v1/workspace') {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'clients:update')) {
        return forbidden(res, requestId, 'You do not have permission to update workspace settings.');
      }
      const workspaceId = getActiveWorkspaceId(session);
      if (!workspaceId) {
        return badRequest(res, requestId, 'No active workspace available.');
      }
      try {
        const workspace = await updateWorkspaceProfile(session.client, {
          workspaceId,
          name: body?.name,
        });
        await recordAuditEvent(session.client, {
          workspaceId,
          actorUserId: session.user.id,
          action: 'workspace.updated',
          targetType: 'workspace',
          targetId: workspaceId,
          payload: { name: workspace?.name || body?.name || null },
        });
        return sendJson(res, 200, { ok: true, requestId, workspace: serializeWorkspaceForSettings(workspace) });
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'GET' && pathname === '/v1/team') {
    return withSession(ctx, async (session) => {
      const workspaceId = getActiveWorkspaceId(session);
      if (!workspaceId) {
        return badRequest(res, requestId, 'No active workspace available.');
      }
      const members = await listWorkspaceTeamMembers(session.client, workspaceId);
      return sendJson(res, 200, { ok: true, requestId, members });
    });
  }

  if (method === 'POST' && pathname === '/v1/team/invite') {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'clients:invite')) {
        return forbidden(res, requestId, 'You do not have permission to invite members.');
      }
      const workspaceId = getActiveWorkspaceId(session);
      if (!workspaceId) {
        return badRequest(res, requestId, 'No active workspace available.');
      }
      try {
        await session.client.query('begin');
        const inviteResult = await inviteMemberToWorkspace(session.client, {
          workspaceId,
          email: body?.email,
          role: normalizeTeamRole(body?.role),
          invitedByUserId: session.user.id,
          productAccess: defaultProductAccessForPlatformRole(body?.role, body?.productAccess),
        });
        await recordAuditEvent(session.client, {
          workspaceId,
          actorUserId: session.user.id,
          action: 'workspace.invite.created',
          targetType: 'workspace_invite',
          targetId: inviteResult.invite?.id || null,
          payload: { email: body?.email || null, role: body?.role || 'member' },
        });
        await session.client.query('commit');
        return sendJson(res, 200, { ok: true, requestId, message: inviteResult.message, invite: inviteResult.invite || null });
      } catch (error) {
        await session.client.query('rollback');
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'PUT' && /\/v1\/team\/[^/]+\/role$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'clients:manage-members')) {
        return forbidden(res, requestId, 'You do not have permission to manage members.');
      }
      const workspaceId = getActiveWorkspaceId(session);
      if (!workspaceId) {
        return badRequest(res, requestId, 'No active workspace available.');
      }
      const userId = pathname.split('/')[3];
      try {
        const member = await updateWorkspaceMemberRole(session.client, {
          workspaceId,
          userId,
          role: normalizeTeamRole(body?.role),
          productAccess: defaultProductAccessForPlatformRole(body?.role, body?.productAccess),
        });
        await recordAuditEvent(session.client, {
          workspaceId,
          actorUserId: session.user.id,
          action: 'workspace.member.role_updated',
          targetType: 'workspace_member',
          targetId: userId,
          payload: { role: member?.role || body?.role || null },
        });
        return sendJson(res, 200, { ok: true, requestId, member });
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'DELETE' && /\/v1\/team\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'clients:manage-members')) {
        return forbidden(res, requestId, 'You do not have permission to remove members.');
      }
      const workspaceId = getActiveWorkspaceId(session);
      if (!workspaceId) {
        return badRequest(res, requestId, 'No active workspace available.');
      }
      const userId = pathname.split('/')[3];
      try {
        await removeWorkspaceMember(session.client, { workspaceId, userId });
        await recordAuditEvent(session.client, {
          workspaceId,
          actorUserId: session.user.id,
          action: 'workspace.member.removed',
          targetType: 'workspace_member',
          targetId: userId,
          payload: null,
        });
        return sendJson(res, 200, { ok: true, requestId });
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'GET' && pathname === '/v1/clients') {
    return withSession(ctx, async (session) => sendJson(res, 200, {
      ok: true,
      requestId,
      activeClientId: session.session.activeWorkspaceId,
      activeWorkspaceId: session.session.activeWorkspaceId,
      clients: session.workspaces,
      workspaces: session.workspaces,
    }, COMPAT_HEADERS));
  }

  if (method === 'POST' && pathname === '/v1/clients') {
    return handleWorkspaceRoutes({ ...ctx, pathname: '/v1/workspaces', compatHeaders: COMPAT_HEADERS });
  }

  if (method === 'POST' && pathname === '/v1/clients/active') {
    return withSession(ctx, async (session) => {
      const workspaceId = String(body?.clientId || body?.workspaceId || '').trim();
      if (!workspaceId) {
        return badRequest(res, requestId, 'clientId is required.');
      }
      try {
        await setSessionActiveWorkspace(session.client, {
          sessionId: session.session.id,
          workspaceId,
          userId: session.user.id,
        });
        await recordAuditEvent(session.client, {
          workspaceId,
          actorUserId: session.user.id,
          action: 'workspace.activated',
          targetType: 'session',
          targetId: session.session.id,
          payload: { workspaceId },
        });
        const workspaces = await listWorkspacesForUser(session.client, session.user.id);
        return sendJson(res, 200, {
          ok: true,
          requestId,
          activeClientId: workspaceId,
          activeWorkspaceId: workspaceId,
          clients: workspaces,
          workspaces,
        }, COMPAT_HEADERS);
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'POST' && /\/v1\/clients\/[^/]+\/brands$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'brandkits:manage')) {
        return forbidden(res, requestId, 'You do not have permission to manage brand kits.');
      }
      const workspaceId = pathname.split('/')[3];
      try {
        await session.client.query('begin');
        const brand = await createBrandForWorkspace(session.client, {
          workspaceId,
          name: body?.name,
          primaryColor: body?.primaryColor,
        });
        await recordAuditEvent(session.client, {
          workspaceId,
          actorUserId: session.user.id,
          action: 'brand.created',
          targetType: 'brand',
          targetId: brand.id,
          payload: { name: brand.name },
        });
        const workspaces = await listWorkspacesForUser(session.client, session.user.id);
        const workspace = workspaces.find((item) => item.id === workspaceId);
        await session.client.query('commit');
        return sendJson(res, 201, {
          ok: true,
          requestId,
          client: workspace,
          workspace,
          clients: workspaces,
          workspaces,
        }, COMPAT_HEADERS);
      } catch (error) {
        await session.client.query('rollback');
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'POST' && /\/v1\/clients\/[^/]+\/invites$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'clients:invite')) {
        return forbidden(res, requestId, 'You do not have permission to invite members.');
      }
      const workspaceId = pathname.split('/')[3];
      try {
        await session.client.query('begin');
        const inviteResult = await inviteMemberToWorkspace(session.client, {
          workspaceId,
          email: body?.email,
          role: body?.role,
          invitedByUserId: session.user.id,
          productAccess: body?.productAccess,
        });
        await recordAuditEvent(session.client, {
          workspaceId,
          actorUserId: session.user.id,
          action: 'workspace.invite.created',
          targetType: 'workspace_invite',
          targetId: inviteResult.invite?.id || null,
          payload: { email: body?.email, role: body?.role || 'editor' },
        });
        const workspaces = await listWorkspacesForUser(session.client, session.user.id);
        const workspace = workspaces.find((item) => item.id === workspaceId);
        await session.client.query('commit');
        return sendJson(res, 200, {
          ok: true,
          requestId,
          message: inviteResult.message,
          client: workspace,
          workspace,
          clients: workspaces,
          workspaces,
        }, COMPAT_HEADERS);
      } catch (error) {
        await session.client.query('rollback');
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'GET' && pathname === '/v1/clients/access') {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'clients:manage-members')) {
        return forbidden(res, requestId, 'You do not have permission to inspect client access.');
      }
      const clients = session.workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        role: 'member',
      }));
      const users = await listClientAccessAssignments(
        session.client,
        session.workspaces.map((workspace) => workspace.id),
      );
      return sendJson(res, 200, { ok: true, requestId, clients, users }, COMPAT_HEADERS);
    });
  }

  if (method === 'POST' && pathname === '/v1/clients/access') {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'clients:manage-members')) {
        return forbidden(res, requestId, 'You do not have permission to manage client access.');
      }
      const workspaceIds = Array.isArray(body?.workspaceIds)
        ? body.workspaceIds.map((value) => String(value || '').trim()).filter(Boolean)
        : [];
      if (!workspaceIds.length) {
        return badRequest(res, requestId, 'workspaceIds is required.');
      }
      const allowedWorkspaceIds = new Set(session.workspaces.map((workspace) => workspace.id));
      if (workspaceIds.some((workspaceId) => !allowedWorkspaceIds.has(workspaceId))) {
        return forbidden(res, requestId, 'One or more workspaces are not available to this user.');
      }

      try {
        await session.client.query('begin');
        for (const workspaceId of workspaceIds) {
          const inviteResult = await inviteMemberToWorkspace(session.client, {
            workspaceId,
            email: body?.email,
            role: normalizeClientAccessRole(body?.role),
            invitedByUserId: session.user.id,
            productAccess: body?.productAccess,
          });
          await recordAuditEvent(session.client, {
            workspaceId,
            actorUserId: session.user.id,
            action: 'workspace.access.granted',
            targetType: 'workspace_member',
            targetId: inviteResult.invite?.id || null,
            payload: {
              email: body?.email || null,
              role: body?.role || null,
              workspaceRole: normalizeClientAccessRole(body?.role),
              productAccess: body?.productAccess || null,
            },
          });
        }
        await session.client.query('commit');
        return sendJson(res, 200, { ok: true, requestId, message: 'Client access updated.' }, COMPAT_HEADERS);
      } catch (error) {
        await session.client.query('rollback');
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'PUT' && /\/v1\/clients\/[^/]+\/access\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'clients:manage-members')) {
        return forbidden(res, requestId, 'You do not have permission to manage client access.');
      }
      const [, , , workspaceId, , userId] = pathname.split('/');
      if (!session.workspaces.some((workspace) => workspace.id === workspaceId)) {
        return forbidden(res, requestId, 'Workspace not available to this user.');
      }
      try {
        const member = await updateWorkspaceMemberRole(session.client, {
          workspaceId,
          userId,
          role: normalizeClientAccessRole(body?.role),
          productAccess: body?.productAccess,
        });
        await recordAuditEvent(session.client, {
          workspaceId,
          actorUserId: session.user.id,
          action: 'workspace.access.updated',
          targetType: 'workspace_member',
          targetId: userId,
          payload: {
            role: body?.role || null,
            productAccess: body?.productAccess || null,
          },
        });
        return sendJson(res, 200, { ok: true, requestId, member }, COMPAT_HEADERS);
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'DELETE' && /\/v1\/clients\/[^/]+\/access\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'clients:manage-members')) {
        return forbidden(res, requestId, 'You do not have permission to manage client access.');
      }
      const [, , , workspaceId, , userId] = pathname.split('/');
      if (!session.workspaces.some((workspace) => workspace.id === workspaceId)) {
        return forbidden(res, requestId, 'Workspace not available to this user.');
      }
      try {
        await removeWorkspaceMember(session.client, { workspaceId, userId });
        await recordAuditEvent(session.client, {
          workspaceId,
          actorUserId: session.user.id,
          action: 'workspace.access.removed',
          targetType: 'workspace_member',
          targetId: userId,
          payload: null,
        });
        return sendJson(res, 200, { ok: true, requestId }, COMPAT_HEADERS);
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'GET' && pathname === '/v1/admin/storage/diagnostics') {
    return sendJson(res, 200, { ...emptyDiagnostics(), requestId }, COMPAT_HEADERS);
  }

  if (method === 'POST' && pathname === '/v1/admin/storage/rebuild') {
    return sendJson(res, 200, { ...emptyDiagnostics(), requestId }, COMPAT_HEADERS);
  }

  if (method === 'GET' && pathname === '/v1/admin/audit-events') {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'audit:read')) {
        return forbidden(res, requestId, 'You do not have permission to inspect audit events.');
      }
      const workspaceId = session.session.activeWorkspaceId || null;
      const events = await listRecentAuditEvents(session.client, { workspaceId, limit: 100 });
      return sendJson(res, 200, { ok: true, requestId, events });
    });
  }

  return false;
}
