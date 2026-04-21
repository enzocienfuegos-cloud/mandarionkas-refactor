import {
  changeStudioProjectOwner,
  deleteStudioProject,
  duplicateStudioProject,
  getStudioProject,
  listStudioProjectVersions,
  listStudioProjects,
  loadStudioProjectVersion,
  mapStudioProjectRowToDto,
  saveStudioProject,
  saveStudioProjectVersion,
  updateStudioProjectArchiveState,
} from '@smx/db';
import { canManageStudioClient, hasStudioPermission } from './shared.mjs';

export function handleStudioProjectRoutes(app, { requireWorkspace, pool }, deps = {
  changeStudioProjectOwner,
  deleteStudioProject,
  duplicateStudioProject,
  getStudioProject,
  listStudioProjectVersions,
  listStudioProjects,
  loadStudioProjectVersion,
  mapStudioProjectRowToDto,
  saveStudioProject,
  saveStudioProjectVersion,
  updateStudioProjectArchiveState,
}) {
  app.get('/v1/projects', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'projects:view-client')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const rows = await deps.listStudioProjects(pool, req.authSession.workspaceId);
    return reply.send({ projects: rows.map(deps.mapStudioProjectRowToDto) });
  });

  app.post('/v1/projects/save', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'projects:save')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const { state, projectId } = req.body ?? {};
    if (!state || typeof state !== 'object') {
      return reply.status(400).send({ message: 'state is required' });
    }
    const row = await deps.saveStudioProject(pool, {
      workspaceId: req.authSession.workspaceId,
      ownerUserId: req.authSession.userId,
      projectId,
      state,
    });
    return reply.send({ project: deps.mapStudioProjectRowToDto(row) });
  });

  app.get('/v1/projects/:projectId', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'projects:view-client')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const row = await deps.getStudioProject(pool, req.authSession.workspaceId, req.params.projectId);
    return reply.send({ state: row?.state ?? null });
  });

  app.delete('/v1/projects/:projectId', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'projects:delete')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    await deps.deleteStudioProject(pool, req.authSession.workspaceId, req.params.projectId);
    return reply.status(204).send();
  });

  app.post('/v1/projects/:projectId/duplicate', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'projects:save')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const row = await deps.duplicateStudioProject(pool, req.authSession.workspaceId, req.params.projectId, req.authSession.userId);
    if (!row) return reply.status(404).send({ message: 'Project not found' });
    return reply.send({ project: deps.mapStudioProjectRowToDto(row) });
  });

  app.post('/v1/projects/:projectId/archive', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'projects:delete')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    await deps.updateStudioProjectArchiveState(pool, req.authSession.workspaceId, req.params.projectId, true);
    return reply.send({ ok: true });
  });

  app.post('/v1/projects/:projectId/restore', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'projects:delete')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    await deps.updateStudioProjectArchiveState(pool, req.authSession.workspaceId, req.params.projectId, false);
    return reply.send({ ok: true });
  });

  app.post('/v1/projects/:projectId/owner', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!canManageStudioClient(req.authSession)) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const { ownerUserId } = req.body ?? {};
    if (!ownerUserId) return reply.status(400).send({ message: 'ownerUserId is required' });
    await deps.changeStudioProjectOwner(pool, req.authSession.workspaceId, req.params.projectId, ownerUserId);
    return reply.send({ ok: true });
  });

  app.get('/v1/projects/:projectId/versions', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'projects:view-client')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const rows = await deps.listStudioProjectVersions(pool, req.authSession.workspaceId, req.params.projectId);
    return reply.send({
      versions: rows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        projectName: row.project_name,
        versionNumber: row.version_number,
        savedAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
        note: row.note ?? undefined,
      })),
    });
  });

  app.post('/v1/projects/:projectId/versions', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'projects:save')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const { state, note } = req.body ?? {};
    if (!state || typeof state !== 'object') {
      return reply.status(400).send({ message: 'state is required' });
    }
    const row = await deps.saveStudioProjectVersion(pool, {
      workspaceId: req.authSession.workspaceId,
      projectId: req.params.projectId,
      state,
      note,
      createdBy: req.authSession.userId,
    });
    if (!row) return reply.status(404).send({ message: 'Project not found' });
    return reply.send({
      version: {
        id: row.id,
        projectId: row.project_id,
        projectName: state.document?.name ?? 'Untitled project',
        versionNumber: row.version_number,
        savedAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
        note: row.note ?? undefined,
      },
    });
  });

  app.get('/v1/projects/:projectId/versions/:versionId', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'projects:view-client')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const row = await deps.loadStudioProjectVersion(pool, req.authSession.workspaceId, req.params.projectId, req.params.versionId);
    return reply.send({ state: row?.state ?? null });
  });
}
