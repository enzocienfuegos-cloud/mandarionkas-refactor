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

function normalizeLimit(limit, fallback = 50) {
  return Math.min(Math.max(Number(limit) || fallback, 1), 500);
}

function normalizeOffset(offset) {
  return Math.max(Number(offset) || 0, 0);
}

function trimText(value) {
  return String(value ?? '').trim();
}

function buildAuditFilters({
  workspaceId = null,
  action = '',
  actorEmail = '',
  resourceType = '',
  dateFrom = '',
  dateTo = '',
}) {
  const conditions = [];
  const params = [];

  if (workspaceId) {
    params.push(workspaceId);
    conditions.push(`e.workspace_id = $${params.length}`);
  }

  const normalizedAction = trimText(action).toLowerCase();
  if (normalizedAction) {
    params.push(`%${normalizedAction}%`);
    conditions.push(`lower(e.action) like $${params.length}`);
  }

  const normalizedActorEmail = trimText(actorEmail).toLowerCase();
  if (normalizedActorEmail) {
    params.push(`%${normalizedActorEmail}%`);
    conditions.push(`lower(u.email) like $${params.length}`);
  }

  const normalizedResourceType = trimText(resourceType).toLowerCase();
  if (normalizedResourceType && normalizedResourceType !== 'all') {
    params.push(normalizedResourceType);
    conditions.push(`lower(e.target_type) = $${params.length}`);
  }

  const normalizedDateFrom = trimText(dateFrom);
  if (normalizedDateFrom) {
    params.push(normalizedDateFrom);
    conditions.push(`e.created_at >= $${params.length}::date`);
  }

  const normalizedDateTo = trimText(dateTo);
  if (normalizedDateTo) {
    params.push(normalizedDateTo);
    conditions.push(`e.created_at < ($${params.length}::date + interval '1 day')`);
  }

  return {
    params,
    whereClause: conditions.length ? `where ${conditions.join(' and ')}` : '',
  };
}

function normalizeAuditEventRow(row) {
  return {
    id: row.id,
    timestamp: row.created_at.toISOString(),
    actorEmail: row.actor_email || 'system',
    action: row.action,
    resourceType: row.target_type,
    resourceId: row.target_id || '',
    metadata: row.payload || undefined,
    ipAddress: undefined,
  };
}

export async function queryAuditEvents(
  client,
  {
    workspaceId = null,
    limit = 50,
    offset = 0,
    action = '',
    actorEmail = '',
    resourceType = '',
    dateFrom = '',
    dateTo = '',
  } = {},
) {
  const filters = buildAuditFilters({ workspaceId, action, actorEmail, resourceType, dateFrom, dateTo });
  const listParams = [...filters.params, normalizeLimit(limit), normalizeOffset(offset)];
  const countParams = [...filters.params];

  const [eventsResult, countResult] = await Promise.all([
    client.query(
      `
        select
          e.id,
          e.workspace_id,
          e.actor_user_id,
          e.action,
          e.target_type,
          e.target_id,
          e.payload,
          e.created_at,
          u.email as actor_email
        from audit_events e
        left join users u on u.id = e.actor_user_id
        ${filters.whereClause}
        order by e.created_at desc
        limit $${listParams.length - 1}
        offset $${listParams.length}
      `,
      listParams,
    ),
    client.query(
      `
        select count(*)::int as total
        from audit_events e
        left join users u on u.id = e.actor_user_id
        ${filters.whereClause}
      `,
      countParams,
    ),
  ]);

  return {
    events: eventsResult.rows.map(normalizeAuditEventRow),
    total: countResult.rows[0]?.total || 0,
    limit: normalizeLimit(limit),
    offset: normalizeOffset(offset),
  };
}
