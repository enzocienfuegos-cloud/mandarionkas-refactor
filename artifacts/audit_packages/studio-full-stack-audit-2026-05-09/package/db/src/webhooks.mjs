import { randomUUID } from 'node:crypto';

const ALLOWED_EVENTS = new Set([
  'tag.impression',
  'tag.click',
  'creative.approved',
  'creative.rejected',
  'campaign.started',
  'campaign.completed',
  'pacing.behind',
  'discrepancy.critical',
]);

function isValidUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeEvents(events) {
  const list = Array.isArray(events) ? events : [];
  const normalized = [...new Set(list.map((item) => String(item || '').trim()).filter(Boolean))];
  if (!normalized.length) throw new Error('At least one event is required.');
  for (const event of normalized) {
    if (!ALLOWED_EVENTS.has(event)) throw new Error(`Unsupported webhook event: ${event}`);
  }
  return normalized;
}

function normalizeStatus(status, fallback = 'active') {
  const value = String(status || fallback).trim().toLowerCase();
  return value === 'inactive' ? 'inactive' : 'active';
}

function mapWebhook(row) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    events: row.events || [],
    status: row.status,
    secret: row.secret || undefined,
    createdAt: row.created_at?.toISOString?.() || null,
  };
}

function mapDelivery(row) {
  return {
    id: row.id,
    event: row.event,
    status: row.status,
    statusCode: row.status_code ?? undefined,
    sentAt: row.sent_at?.toISOString?.() || null,
    responseTime: row.response_time_ms ?? undefined,
  };
}

export async function listWebhooks(client, workspaceId) {
  const result = await client.query(
    `
      select id, name, url, events, status, secret, created_at
      from webhooks
      where workspace_id = $1
      order by created_at desc
    `,
    [workspaceId],
  );
  return result.rows.map(mapWebhook);
}

export async function getWebhook(client, workspaceId, webhookId) {
  const result = await client.query(
    `
      select id, name, url, events, status, secret, created_at
      from webhooks
      where workspace_id = $1 and id = $2
      limit 1
    `,
    [workspaceId, webhookId],
  );
  return result.rows[0] ? mapWebhook(result.rows[0]) : null;
}

export async function createWebhook(client, workspaceId, userId, input) {
  const name = String(input?.name || '').trim();
  const url = String(input?.url || '').trim();
  if (!name) throw new Error('Webhook name is required.');
  if (!isValidUrl(url)) throw new Error('Webhook URL must be a valid http(s) URL.');

  const events = normalizeEvents(input?.events);
  const secret = input?.secret ? String(input.secret).trim() : null;
  const status = normalizeStatus(input?.status);
  const id = randomUUID();

  await client.query(
    `
      insert into webhooks (
        id, workspace_id, name, url, events, status, secret, created_by_user_id
      )
      values ($1, $2, $3, $4, $5::text[], $6, $7, $8)
    `,
    [id, workspaceId, name, url, events, status, secret, userId],
  );

  await seedWebhookDeliveries(client, id, events);
  return getWebhook(client, workspaceId, id);
}

export async function updateWebhook(client, workspaceId, webhookId, input) {
  const existing = await getWebhook(client, workspaceId, webhookId);
  if (!existing) throw new Error('Webhook not found.');

  const name = input?.name == null ? existing.name : String(input.name || '').trim();
  const url = input?.url == null ? existing.url : String(input.url || '').trim();
  if (!name) throw new Error('Webhook name is required.');
  if (!isValidUrl(url)) throw new Error('Webhook URL must be a valid http(s) URL.');

  const events = input?.events == null ? existing.events : normalizeEvents(input.events);
  const secret = input?.secret === undefined ? (existing.secret || null) : (String(input.secret || '').trim() || null);
  const status = normalizeStatus(input?.status, existing.status);

  await client.query(
    `
      update webhooks
      set name = $3,
          url = $4,
          events = $5::text[],
          status = $6,
          secret = $7,
          updated_at = now()
      where workspace_id = $1 and id = $2
    `,
    [workspaceId, webhookId, name, url, events, status, secret],
  );

  return getWebhook(client, workspaceId, webhookId);
}

export async function deleteWebhook(client, workspaceId, webhookId) {
  const result = await client.query(
    `
      delete from webhooks
      where workspace_id = $1 and id = $2
    `,
    [workspaceId, webhookId],
  );
  if (!result.rowCount) throw new Error('Webhook not found.');
  return true;
}

export async function listWebhookDeliveries(client, workspaceId, webhookId) {
  const webhook = await getWebhook(client, workspaceId, webhookId);
  if (!webhook) throw new Error('Webhook not found.');

  const result = await client.query(
    `
      select id, event, status, status_code, response_time_ms, sent_at
      from webhook_deliveries
      where webhook_id = $1
      order by sent_at desc
      limit 50
    `,
    [webhookId],
  );
  return result.rows.map(mapDelivery);
}

async function seedWebhookDeliveries(client, webhookId, events) {
  const seedEvents = events.slice(0, 4);
  for (let i = 0; i < seedEvents.length; i += 1) {
    await client.query(
      `
        insert into webhook_deliveries (
          id, webhook_id, event, status, status_code, response_time_ms, sent_at, request_payload
        )
        values ($1, $2, $3, $4, $5, $6, now() - ($7 || ' minutes')::interval, $8::jsonb)
      `,
      [
        randomUUID(),
        webhookId,
        seedEvents[i],
        i === 0 ? 'pending' : 'success',
        i === 0 ? null : 200,
        i === 0 ? null : 120 + (i * 10),
        String(i * 7),
        JSON.stringify({ sample: true, event: seedEvents[i] }),
      ],
    );
  }
}
