import { randomUUID } from 'node:crypto';

export async function recordAuditEvent(client, { workspaceId = null, actorUserId = null, action, targetType, targetId = null, payload = null }) {
  if (!action || !targetType) {
    throw new Error('action and targetType are required for audit events.');
  }

  await client.query(
    `
      insert into audit_events (id, workspace_id, actor_user_id, action, target_type, target_id, payload)
      values ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [randomUUID(), workspaceId, actorUserId, action, targetType, targetId, payload ? JSON.stringify(payload) : null],
  );
}

export async function listRecentAuditEvents(client, { workspaceId = null, limit = 50 } = {}) {
  const result = workspaceId
    ? await client.query(
      `
        select id, workspace_id, actor_user_id, action, target_type, target_id, payload, created_at
        from audit_events
        where workspace_id = $1
        order by created_at desc
        limit $2
      `,
      [workspaceId, limit],
    )
    : await client.query(
      `
        select id, workspace_id, actor_user_id, action, target_type, target_id, payload, created_at
        from audit_events
        order by created_at desc
        limit $1
      `,
      [limit],
    );

  return result.rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id || undefined,
    actorUserId: row.actor_user_id || undefined,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id || undefined,
    payload: row.payload || undefined,
    createdAt: row.created_at.toISOString(),
  }));
}
