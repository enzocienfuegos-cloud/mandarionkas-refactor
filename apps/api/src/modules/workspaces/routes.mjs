import { badRequest, forbidden, sendJson, serviceUnavailable, unauthorized } from '../../lib/http.mjs';
import { requireAuthenticatedSession } from '../auth/service.mjs';
import {
  createBrandForWorkspace,
  createWorkspaceForUser,
  getWorkspaceById,
  inviteMemberToWorkspace,
  listWorkspaceTeamMembers,
  listWorkspacesForUser,
  removeWorkspaceMember,
  setSessionActiveWorkspace,
  updateWorkspaceMemberRole,
  updateWorkspaceProfile,
} from './service.mjs';
import { listRecentAuditEvents, recordAuditEvent } from '../../../../../packages/db/src/audit.mjs';

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

function hasPermission(session, permission) {
  return session.permissions.includes(permission);
}

async function withSession(ctx, callback) {
  const session = await requireAuthenticatedSession({ env: ctx.env, headers: ctx.req.headers });
  if (!session.ok) {
    if (session.statusCode === 503) {
      return serviceUnavailable(ctx.res, ctx.requestId, session.message);
    }
    if (session.statusCode === 401) {
      return unauthorized(ctx.res, ctx.requestId, session.message);
    }
    return false;
  }

  try {
    return await callback(session);
  } finally {
    await session.finish();
  }
}

function workspacesPayload(session, workspaces, activeWorkspaceId) {
  return {
    ok: true,
    requestId: undefined,
    activeWorkspaceId,
    activeClientId: activeWorkspaceId,
    workspaces,
    clients: workspaces,
    user: session.user,
    permissions: session.permissions,
  };
}

function getActiveWorkspaceId(session) {
  return session.session.activeWorkspaceId || session.workspaces[0]?.id || null;
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
          role: body?.role,
          invitedByUserId: session.user.id,
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
          role: body?.role,
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

  if (method === 'GET' && pathname === '/v1/admin/storage/diagnostics') {
    return sendJson(res, 200, { ...emptyDiagnostics(), requestId }, COMPAT_HEADERS);
  }

  if (method === 'POST' && pathname === '/v1/admin/storage/rebuild') {
    return sendJson(res, 200, { ...emptyDiagnostics(), requestId }, COMPAT_HEADERS);
  }

  if (method === 'GET' && pathname === '/v1/admin/audit-events') {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'clients:manage-members')) {
        return forbidden(res, requestId, 'You do not have permission to inspect audit events.');
      }
      const workspaceId = session.session.activeWorkspaceId || null;
      const events = await listRecentAuditEvents(session.client, { workspaceId, limit: 100 });
      return sendJson(res, 200, { ok: true, requestId, events });
    });
  }

  return false;
}
