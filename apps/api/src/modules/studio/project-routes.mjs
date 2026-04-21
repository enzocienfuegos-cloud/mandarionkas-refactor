import {
  changeStudioProjectOwner,
  deleteStudioProject,
  duplicateStudioProject,
  getStudioProject,
  listStudioProjects,
  mapStudioProjectRowToDto,
  saveStudioProject,
  updateStudioProjectArchiveState,
} from '@smx/db';

export function handleStudioProjectRoutes(app, { requireWorkspace, pool }) {
  app.get('/v1/projects', { preHandler: requireWorkspace }, async (req, reply) => {
    const rows = await listStudioProjects(pool, req.authSession.workspaceId);
    return reply.send({ projects: rows.map(mapStudioProjectRowToDto) });
  });

  app.post('/v1/projects/save', { preHandler: requireWorkspace }, async (req, reply) => {
    const { state, projectId } = req.body ?? {};
    if (!state || typeof state !== 'object') {
      return reply.status(400).send({ message: 'state is required' });
    }
    const row = await saveStudioProject(pool, {
      workspaceId: req.authSession.workspaceId,
      ownerUserId: req.authSession.userId,
      projectId,
      state,
    });
    return reply.send({ project: mapStudioProjectRowToDto(row) });
  });

  app.get('/v1/projects/:projectId', { preHandler: requireWorkspace }, async (req, reply) => {
    const row = await getStudioProject(pool, req.authSession.workspaceId, req.params.projectId);
    return reply.send({ state: row?.state ?? null });
  });

  app.delete('/v1/projects/:projectId', { preHandler: requireWorkspace }, async (req, reply) => {
    await deleteStudioProject(pool, req.authSession.workspaceId, req.params.projectId);
    return reply.status(204).send();
  });

  app.post('/v1/projects/:projectId/duplicate', { preHandler: requireWorkspace }, async (req, reply) => {
    const row = await duplicateStudioProject(pool, req.authSession.workspaceId, req.params.projectId, req.authSession.userId);
    if (!row) return reply.status(404).send({ message: 'Project not found' });
    return reply.send({ project: mapStudioProjectRowToDto(row) });
  });

  app.post('/v1/projects/:projectId/archive', { preHandler: requireWorkspace }, async (req, reply) => {
    await updateStudioProjectArchiveState(pool, req.authSession.workspaceId, req.params.projectId, true);
    return reply.send({ ok: true });
  });

  app.post('/v1/projects/:projectId/restore', { preHandler: requireWorkspace }, async (req, reply) => {
    await updateStudioProjectArchiveState(pool, req.authSession.workspaceId, req.params.projectId, false);
    return reply.send({ ok: true });
  });

  app.post('/v1/projects/:projectId/owner', { preHandler: requireWorkspace }, async (req, reply) => {
    const { ownerUserId } = req.body ?? {};
    if (!ownerUserId) return reply.status(400).send({ message: 'ownerUserId is required' });
    await changeStudioProjectOwner(pool, req.authSession.workspaceId, req.params.projectId, ownerUserId);
    return reply.send({ ok: true });
  });
}
