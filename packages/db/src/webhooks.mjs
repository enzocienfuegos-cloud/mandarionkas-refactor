export const WEBHOOK_EVENTS = [
  'tag.impression',
  'tag.click',
  'creative.approved',
  'creative.rejected',
  'campaign.started',
  'campaign.completed',
  'pacing.behind',
  'discrepancy.critical',
];

export async function listWebhooks(pool, workspaceId) {
  const { rows } = await pool.query(
    `SELECT id, workspace_id, name, url, events, is_active, created_at, updated_at
     FROM webhooks
     WHERE workspace_id = $1
     ORDER BY created_at DESC`,
    [workspaceId],
  );
  return rows;
}

export async function getWebhook(pool, workspaceId, id) {
  const { rows } = await pool.query(
    `SELECT id, workspace_id, name, url, events, is_active, created_at, updated_at
     FROM webhooks
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, id],
  );
  return rows[0] ?? null;
}

export async function createWebhook(pool, workspaceId, data) {
  const { name, url, events = [], secret = null, is_active = true } = data;

  const invalidEvents = events.filter(e => !WEBHOOK_EVENTS.includes(e));
  if (invalidEvents.length > 0) {
    throw new Error(`Invalid webhook events: ${invalidEvents.join(', ')}`);
  }

  const { rows } = await pool.query(
    `INSERT INTO webhooks (workspace_id, name, url, secret, events, is_active)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, workspace_id, name, url, events, is_active, created_at, updated_at`,
    [workspaceId, name, url, secret, events, is_active],
  );
  return rows[0];
}

export async function updateWebhook(pool, workspaceId, id, data) {
  const allowed = ['name', 'url', 'secret', 'events', 'is_active'];
  const setClauses = [];
  const params = [workspaceId, id];

  for (const key of allowed) {
    if (key in data) {
      if (key === 'events') {
        const invalidEvents = data.events.filter(e => !WEBHOOK_EVENTS.includes(e));
        if (invalidEvents.length > 0) {
          throw new Error(`Invalid webhook events: ${invalidEvents.join(', ')}`);
        }
      }
      params.push(data[key]);
      setClauses.push(`${key} = $${params.length}`);
    }
  }
  if (setClauses.length === 0) return getWebhook(pool, workspaceId, id);
  setClauses.push(`updated_at = NOW()`);

  const { rows } = await pool.query(
    `UPDATE webhooks SET ${setClauses.join(', ')}
     WHERE workspace_id = $1 AND id = $2
     RETURNING id, workspace_id, name, url, events, is_active, created_at, updated_at`,
    params,
  );
  return rows[0] ?? null;
}

export async function deleteWebhook(pool, workspaceId, id) {
  const { rowCount } = await pool.query(
    `DELETE FROM webhooks WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, id],
  );
  return rowCount > 0;
}

export async function recordDelivery(pool, webhookId, data) {
  const {
    event_type, payload = {}, response_status = null,
    response_body = null, duration_ms = null, success = false,
    error_message = null, attempts = 1,
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO webhook_deliveries
       (webhook_id, event_type, payload, response_status, response_body,
        duration_ms, success, error_message, attempts)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [webhookId, event_type, JSON.stringify(payload), response_status,
     response_body, duration_ms, success, error_message, attempts],
  );
  return rows[0];
}

export async function getWebhookDeliveries(pool, workspaceId, webhookId, opts = {}) {
  const { limit = 50, offset = 0, success } = opts;

  // Verify webhook belongs to workspace
  const { rows: whCheck } = await pool.query(
    `SELECT id FROM webhooks WHERE id = $1 AND workspace_id = $2`,
    [webhookId, workspaceId],
  );
  if (!whCheck.length) return null;

  const params = [webhookId];
  const conditions = ['wd.webhook_id = $1'];

  if (success !== undefined && success !== null) {
    params.push(success);
    conditions.push(`wd.success = $${params.length}`);
  }

  params.push(Math.min(Number(limit) || 50, 200));
  params.push(Number(offset) || 0);

  const { rows } = await pool.query(
    `SELECT wd.id, wd.webhook_id, wd.event_type, wd.payload, wd.response_status,
            wd.response_body, wd.duration_ms, wd.success, wd.error_message,
            wd.attempts, wd.delivered_at
     FROM webhook_deliveries wd
     WHERE ${conditions.join(' AND ')}
     ORDER BY wd.delivered_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}
