import {
  submitForReview,
  approveCreative,
  rejectCreative,
  listCreatives,
} from '@smx/db/creatives';

function canReview(role) {
  return role === 'admin' || role === 'owner';
}

export function handleCreativeApprovalRoutes(app, { requireWorkspace, pool }) {
  // GET /v1/creatives/pending-review
  app.get('/v1/creatives/pending-review', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;

    const creatives = await listCreatives(pool, workspaceId, {
      approval_status: 'pending_review',
      limit: 100,
    });

    return reply.send({ creatives });
  });

  // POST /v1/creatives/:id/submit — submit for review
  app.post('/v1/creatives/:id/submit', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const creative = await submitForReview(pool, workspaceId, id);
    if (!creative) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Creative not found or not in a state that can be submitted for review (must be draft or rejected)',
      });
    }

    return reply.send({ creative });
  });

  // POST /v1/creatives/:id/approve — admin/owner only
  app.post('/v1/creatives/:id/approve', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId, userId, role } = req.authSession;
    const { id } = req.params;
    const { notes } = req.body ?? {};

    if (!canReview(role)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only admins and owners can approve creatives' });
    }

    const creative = await approveCreative(pool, workspaceId, id, userId, notes ?? null);
    if (!creative) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Creative not found or not in pending_review state',
      });
    }

    return reply.send({ creative });
  });

  // POST /v1/creatives/:id/reject — admin/owner only
  app.post('/v1/creatives/:id/reject', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId, userId, role } = req.authSession;
    const { id } = req.params;
    const { reason } = req.body ?? {};

    if (!canReview(role)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only admins and owners can reject creatives' });
    }

    if (!reason || !reason.trim()) {
      return reply.status(400).send({ error: 'Bad Request', message: 'reason is required when rejecting a creative' });
    }

    const creative = await rejectCreative(pool, workspaceId, id, userId, reason.trim());
    if (!creative) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Creative not found or not in pending_review state',
      });
    }

    return reply.send({ creative });
  });
}
