export const ACTION_TYPES = new Set([
  'tag.created',
  'tag.updated',
  'tag.deleted',
  'campaign.created',
  'campaign.updated',
  'campaign.deleted',
  'creative.created',
  'creative.uploaded',
  'creative.approved',
  'creative.rejected',
  'creative.archived',
  'api_key.created',
  'api_key.revoked',
  'user.login',
  'user.logout',
  'user.invited',
  'user.removed',
  'user.role_changed',
  'workspace.updated',
  'webhook.created',
  'webhook.deleted',
  'discrepancy.reported',
  'discrepancy.resolved',
  'search.performed',
  'audit.viewed',
  'ab_experiment.created',
  'ab_experiment.updated',
  'ab_result.viewed',
]);

export const RESOURCE_TYPES = new Set([
  'tag',
  'campaign',
  'creative',
  'advertiser',
  'api_key',
  'user',
  'workspace',
  'webhook',
  'discrepancy_report',
  'ab_experiment',
  'ab_variant',
  'embed_key',
  'session',
]);

export async function logAudit(pool, data) {
  try {
    const {
      workspace_id = null,
      actor_id = null,
      actor_email = null,
      action,
      resource_type = null,
      resource_id = null,
      metadata = null,
      ip_address = null,
      user_agent = null,
    } = data;

    if (!action) return null;

    const { rows } = await pool.query(
      `INSERT INTO audit_events
         (workspace_id, actor_id, actor_email, action, resource_type, resource_id,
          metadata, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::inet,$9)
       RETURNING id`,
      [workspace_id, actor_id, actor_email, action, resource_type, resource_id,
       metadata ? JSON.stringify(metadata) : null, ip_address, user_agent],
    );
    return rows[0]?.id ?? null;
  } catch {
    // audit logging must never throw
    return null;
  }
}

export async function listAuditEvents(pool, workspaceId, opts = {}) {
  const {
    action, actorEmail, resourceType, resourceId,
    dateFrom, dateTo,
    limit = 50, offset = 0,
  } = opts;

  const params = [workspaceId];
  const conditions = ['ae.workspace_id = $1'];

  if (action) {
    params.push(action);
    conditions.push(`ae.action = $${params.length}`);
  }
  if (actorEmail) {
    params.push(actorEmail.toLowerCase());
    conditions.push(`lower(ae.actor_email) = $${params.length}`);
  }
  if (resourceType) {
    params.push(resourceType);
    conditions.push(`ae.resource_type = $${params.length}`);
  }
  if (resourceId) {
    params.push(resourceId);
    conditions.push(`ae.resource_id = $${params.length}`);
  }
  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`ae.created_at >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`ae.created_at <= $${params.length}`);
  }

  const safeLimit = Math.min(Number(limit) || 50, 500);
  params.push(safeLimit);
  params.push(Number(offset) || 0);

  const { rows } = await pool.query(
    `SELECT ae.id, ae.workspace_id, ae.actor_id, ae.actor_email, ae.action,
            ae.resource_type, ae.resource_id, ae.metadata, ae.ip_address,
            ae.user_agent, ae.created_at
     FROM audit_events ae
     WHERE ${conditions.join(' AND ')}
     ORDER BY ae.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function getAuditEvent(pool, workspaceId, id) {
  const { rows } = await pool.query(
    `SELECT ae.id, ae.workspace_id, ae.actor_id, ae.actor_email, ae.action,
            ae.resource_type, ae.resource_id, ae.metadata, ae.ip_address,
            ae.user_agent, ae.created_at
     FROM audit_events ae
     WHERE ae.workspace_id = $1 AND ae.id = $2`,
    [workspaceId, id],
  );
  return rows[0] ?? null;
}
