import { badRequest, forbidden, sendJson, sendNoContent, serviceUnavailable, unauthorized } from '../../lib/http.mjs';
import { requireAuthenticatedSession } from '../auth/service.mjs';
import {
  deleteProject,
  duplicateProject,
  getProjectManagementSnapshot,
  getProjectState,
  hasUserDraft,
  listProjectsForWorkspace,
  listProjectVersions,
  loadProjectVersion,
  loadUserDraft,
  saveProject,
  saveProjectVersion,
  saveUserDraft,
  setProjectArchived,
  setProjectOwner,
  deleteUserDraft,
} from './service.mjs';
import { recordAuditEvent } from '../../../../../packages/db/src/audit.mjs';

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

function getActiveWorkspace(session) {
  return session.workspaces.find((workspace) => workspace.id === session.session.activeWorkspaceId) || session.workspaces[0] || null;
}

async function ensureProjectManagementAllowed(session, projectId) {
  const workspace = getActiveWorkspace(session);
  if (!workspace) {
    throw new Error('Active workspace is required.');
  }
  const snapshot = await getProjectManagementSnapshot(session.client, { projectId, workspaceId: workspace.id });
  if (!snapshot) {
    throw new Error('Project not found.');
  }
  if (hasPermission(session, 'projects:delete') || snapshot.owner_user_id === session.user.id) {
    return { workspace, snapshot };
  }
  throw new Error('You do not have permission to manage this project.');
}

export async function handleProjectRoutes(ctx) {
  const { method, pathname, res, requestId, body } = ctx;

  if (method === 'GET' && pathname === '/v1/projects') {
    return withSession(ctx, async (session) => {
      const workspace = getActiveWorkspace(session);
      if (!workspace) {
        return sendJson(res, 200, { projects: [] });
      }
      const projects = await listProjectsForWorkspace(session.client, workspace.id);
      return sendJson(res, 200, { projects });
    });
  }

  if (method === 'POST' && pathname === '/v1/projects/save') {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to save projects.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) {
        return badRequest(res, requestId, 'An active workspace is required to save a project.');
      }
      try {
        await session.client.query('begin');
        const project = await saveProject(session.client, {
          workspace,
          userId: session.user.id,
          projectId: body?.projectId,
          state: body?.state,
        });
        await recordAuditEvent(session.client, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          action: body?.projectId ? 'project.updated' : 'project.created',
          targetType: 'project',
          targetId: project.id,
          payload: { name: project.name, revision: project.revision ?? undefined },
        });
        await session.client.query('commit');
        return sendJson(res, 200, { project, requestId });
      } catch (error) {
        await session.client.query('rollback');
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'GET' && /^\/v1\/projects\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const workspace = getActiveWorkspace(session);
      if (!workspace) {
        return sendJson(res, 404, { ok: false, requestId, code: 'project_not_found', message: 'Project not found.' });
      }
      const projectId = pathname.split('/')[3];
      const state = await getProjectState(session.client, { projectId, workspaceId: workspace.id });
      if (!state) {
        return sendJson(res, 404, { ok: false, requestId, code: 'project_not_found', message: 'Project not found.' });
      }
      return sendJson(res, 200, { state });
    });
  }

  if (method === 'DELETE' && /^\/v1\/projects\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const projectId = pathname.split('/')[3];
      try {
        const { workspace } = await ensureProjectManagementAllowed(session, projectId);
        await session.client.query('begin');
        await deleteProject(session.client, { projectId, workspaceId: workspace.id });
        await recordAuditEvent(session.client, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          action: 'project.deleted',
          targetType: 'project',
          targetId: projectId,
        });
        await session.client.query('commit');
        return sendNoContent(res);
      } catch (error) {
        try { await session.client.query('rollback'); } catch {}
        return forbidden(res, requestId, error.message);
      }
    });
  }

  if (method === 'POST' && /^\/v1\/projects\/[^/]+\/duplicate$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:view-client')) {
        return forbidden(res, requestId, 'You do not have permission to duplicate projects.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) {
        return badRequest(res, requestId, 'An active workspace is required to duplicate a project.');
      }
      const projectId = pathname.split('/')[3];
      try {
        await session.client.query('begin');
        const project = await duplicateProject(session.client, { projectId, workspace, userId: session.user.id });
        await recordAuditEvent(session.client, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          action: 'project.duplicated',
          targetType: 'project',
          targetId: project.id,
          payload: { sourceProjectId: projectId, name: project.name },
        });
        await session.client.query('commit');
        return sendJson(res, 200, { project, requestId });
      } catch (error) {
        await session.client.query('rollback');
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'POST' && /^\/v1\/projects\/[^/]+\/(archive|restore)$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const projectId = pathname.split('/')[3];
      const action = pathname.split('/')[4];
      try {
        const { workspace } = await ensureProjectManagementAllowed(session, projectId);
        await session.client.query('begin');
        await setProjectArchived(session.client, { projectId, workspaceId: workspace.id, archived: action === 'archive' });
        await recordAuditEvent(session.client, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          action: action === 'archive' ? 'project.archived' : 'project.restored',
          targetType: 'project',
          targetId: projectId,
        });
        await session.client.query('commit');
        return sendJson(res, 200, { ok: true, requestId });
      } catch (error) {
        try { await session.client.query('rollback'); } catch {}
        return forbidden(res, requestId, error.message);
      }
    });
  }

  if (method === 'POST' && /^\/v1\/projects\/[^/]+\/owner$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const projectId = pathname.split('/')[3];
      try {
        const { workspace } = await ensureProjectManagementAllowed(session, projectId);
        const ownerUserId = String(body?.ownerUserId || '').trim();
        await session.client.query('begin');
        await setProjectOwner(session.client, { projectId, workspaceId: workspace.id, ownerUserId });
        await recordAuditEvent(session.client, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          action: 'project.owner.changed',
          targetType: 'project',
          targetId: projectId,
          payload: { ownerUserId },
        });
        await session.client.query('commit');
        return sendJson(res, 200, { ok: true, requestId });
      } catch (error) {
        try { await session.client.query('rollback'); } catch {}
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'GET' && /^\/v1\/projects\/[^/]+\/versions$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const workspace = getActiveWorkspace(session);
      if (!workspace) {
        return sendJson(res, 200, { versions: [] });
      }
      const projectId = pathname.split('/')[3];
      const versions = await listProjectVersions(session.client, { projectId, workspaceId: workspace.id });
      return sendJson(res, 200, { versions });
    });
  }

  if (method === 'POST' && /^\/v1\/projects\/[^/]+\/versions$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to save project versions.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) {
        return badRequest(res, requestId, 'An active workspace is required to save a version.');
      }
      const projectId = pathname.split('/')[3];
      try {
        await session.client.query('begin');
        const version = await saveProjectVersion(session.client, {
          workspace,
          userId: session.user.id,
          projectId,
          state: body?.state,
          note: body?.note,
        });
        await recordAuditEvent(session.client, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          action: 'project.version.saved',
          targetType: 'project_version',
          targetId: version.id,
          payload: { projectId, versionNumber: version.versionNumber },
        });
        await session.client.query('commit');
        return sendJson(res, 200, { version, requestId });
      } catch (error) {
        await session.client.query('rollback');
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'GET' && /^\/v1\/projects\/[^/]+\/versions\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const workspace = getActiveWorkspace(session);
      if (!workspace) {
        return sendJson(res, 404, { ok: false, requestId, code: 'version_not_found', message: 'Version not found.' });
      }
      const [, , , projectId, , versionId] = pathname.split('/');
      const state = await loadProjectVersion(session.client, { projectId, versionId, workspaceId: workspace.id });
      if (!state) {
        return sendJson(res, 404, { ok: false, requestId, code: 'version_not_found', message: 'Version not found.' });
      }
      return sendJson(res, 200, { state });
    });
  }

  if (method === 'GET' && pathname === '/v1/documents/autosave/exists') {
    return withSession(ctx, async (session) => {
      const workspace = getActiveWorkspace(session);
      const exists = workspace ? await hasUserDraft(session.client, { userId: session.user.id, workspaceId: workspace.id, kind: 'autosave' }) : false;
      return sendJson(res, 200, { exists });
    });
  }

  if (method === 'GET' && pathname === '/v1/documents/manual-save/exists') {
    return withSession(ctx, async (session) => {
      const workspace = getActiveWorkspace(session);
      const exists = workspace ? await hasUserDraft(session.client, { userId: session.user.id, workspaceId: workspace.id, kind: 'manual' }) : false;
      return sendJson(res, 200, { exists });
    });
  }

  if (method === 'GET' && (pathname === '/v1/documents/autosave' || pathname === '/v1/documents/manual-save')) {
    return withSession(ctx, async (session) => {
      const workspace = getActiveWorkspace(session);
      const kind = pathname.endsWith('/autosave') ? 'autosave' : 'manual';
      const state = workspace ? await loadUserDraft(session.client, { userId: session.user.id, workspaceId: workspace.id, kind }) : null;
      return sendJson(res, 200, { state });
    });
  }

  if (method === 'POST' && (pathname === '/v1/documents/autosave' || pathname === '/v1/documents/manual-save')) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to persist document drafts.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) {
        return badRequest(res, requestId, 'An active workspace is required to persist document drafts.');
      }
      const kind = pathname.endsWith('/autosave') ? 'autosave' : 'manual';
      try {
        await saveUserDraft(session.client, {
          userId: session.user.id,
          workspaceId: workspace.id,
          kind,
          state: body?.state,
        });
        await recordAuditEvent(session.client, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          action: `document_draft.${kind}.saved`,
          targetType: 'user_document_draft',
          targetId: `${session.user.id}:${kind}`,
        });
        return sendJson(res, 200, { ok: true, requestId });
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'DELETE' && pathname === '/v1/documents/autosave') {
    return withSession(ctx, async (session) => {
      const workspace = getActiveWorkspace(session);
      if (workspace) {
        await deleteUserDraft(session.client, { userId: session.user.id, workspaceId: workspace.id, kind: 'autosave' });
        await recordAuditEvent(session.client, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          action: 'document_draft.autosave.deleted',
          targetType: 'user_document_draft',
          targetId: `${session.user.id}:autosave`,
        });
      }
      return sendNoContent(res);
    });
  }

  return false;
}
