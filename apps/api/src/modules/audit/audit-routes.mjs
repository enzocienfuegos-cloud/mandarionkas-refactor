import {
  ACTION_TYPES,
  listAuditEvents,
  getAuditEvent,
  logAudit,
} from '@smx/db/audit-log';

export function createAuditMiddleware(pool) {
  return async function auditOnResponse(req, reply, done) {
    try {
      const meta = req._auditMeta;
      if (meta && meta.action) {
        await logAudit(pool, {
          workspace_id: meta.workspace_id ?? req.authSession?.workspaceId ?? null,
          actor_id: meta.actor_id ?? req.authSession?.userId ?? null,
          actor_email: meta.actor_email ?? req.authSession?.email ?? null,
          action: meta.action,
          resource_type: meta.resource_type ?? null,
          resource_id: meta.resource_id ?? null,
          metadata: meta.metadata ?? null,
          ip_address: req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? req.ip ?? null,
          user_agent: req.headers['user-agent'] ?? null,
        });
      }
    } catch {
      // Audit middleware must never throw
    }
    done();
  };
}

export function handleAuditRoutes(app, { requireWorkspace, pool }) {
  // GET /v1/audit — admin/owner only
  app.get('/v1/audit', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId, role } = req.authSession;

    if (role !== 'admin' && role !== 'owner') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only admins and owners can view audit logs' });
    }

    const {
      action,
      actorEmail,
      resourceType,
      dateFrom,
      dateTo,
      limit = 50,
      offset,
    } = req.query;

    const events = await listAuditEvents(pool, workspaceId, {
      action,
      actorEmail,
      resourceType,
      dateFrom,
      dateTo,
      limit,
      offset,
    });

    return reply.send({ events });
  });

  // GET /v1/audit/:id — admin/owner only
  app.get('/v1/audit/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId, role } = req.authSession;
    const { id } = req.params;

    if (role !== 'admin' && role !== 'owner') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only admins and owners can view audit logs' });
    }

    const event = await getAuditEvent(pool, workspaceId, id);
    if (!event) {
      return reply.status(404).send({ error: 'Not Found', message: 'Audit event not found' });
    }

    return reply.send({ event });
  });
}
