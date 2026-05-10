import { createHash, randomBytes, randomUUID } from 'node:crypto';

const ALLOWED_SCOPES = new Set([
  'campaigns:read',
  'campaigns:write',
  'tags:read',
  'tags:write',
  'creatives:read',
  'creatives:write',
  'reporting:read',
  'team:manage',
  'webhooks:write',
  'audit:read',
]);

function normalizeScopes(input) {
  const scopes = Array.isArray(input) ? input : [];
  const normalized = [...new Set(scopes.map((scope) => String(scope || '').trim()).filter(Boolean))];
  if (!normalized.length) throw new Error('Select at least one scope.');
  for (const scope of normalized) {
    if (!ALLOWED_SCOPES.has(scope)) throw new Error(`Unsupported API key scope: ${scope}`);
  }
  return normalized;
}

function normalizeExpiry(value) {
  if (value == null || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error('Expiration date is invalid.');
  return date.toISOString();
}

function buildRawKey() {
  return `smx_${randomBytes(24).toString('hex')}`;
}

function buildPrefix(rawKey) {
  return rawKey.slice(0, 12);
}

function hashKey(rawKey) {
  return createHash('sha256').update(rawKey).digest('hex');
}

function mapApiKey(row) {
  const now = Date.now();
  const expiresAt = row.expires_at?.toISOString?.() || null;
  const expired = expiresAt ? new Date(expiresAt).getTime() < now : false;
  const status = row.status === 'revoked' ? 'revoked' : expired ? 'expired' : 'active';
  return {
    id: row.id,
    name: row.name,
    prefix: row.key_prefix,
    scopes: row.scopes || [],
    createdAt: row.created_at?.toISOString?.() || null,
    expiresAt,
    status,
    lastUsedAt: row.last_used_at?.toISOString?.() || null,
  };
}

export async function listApiKeys(client, workspaceId) {
  const { rows } = await client.query(
    `SELECT id, name, key_prefix, scopes, status, expires_at, last_used_at, created_at
     FROM api_keys
     WHERE workspace_id = $1
     ORDER BY created_at DESC`,
    [workspaceId],
  );
  return rows.map(mapApiKey);
}

export async function createApiKey(client, workspaceId, userId, input = {}) {
  const name = String(input?.name || '').trim();
  if (!name) throw new Error('Name is required.');
  const scopes = normalizeScopes(input?.scopes);
  const expiresAt = normalizeExpiry(input?.expiresAt ?? input?.expires_at ?? null);
  const rawKey = buildRawKey();
  const prefix = buildPrefix(rawKey);
  const id = randomUUID();

  await client.query(
    `INSERT INTO api_keys (
       id, workspace_id, name, key_prefix, key_hash, scopes, status, expires_at, created_by_user_id
     ) VALUES (
       $1, $2, $3, $4, $5, $6::text[], 'active', $7, $8
     )`,
    [id, workspaceId, name, prefix, hashKey(rawKey), scopes, expiresAt, userId],
  );

  const { rows } = await client.query(
    `SELECT id, name, key_prefix, scopes, status, expires_at, last_used_at, created_at
     FROM api_keys
     WHERE workspace_id = $1
       AND id = $2
     LIMIT 1`,
    [workspaceId, id],
  );

  return {
    key: mapApiKey(rows[0]),
    rawKey,
  };
}

export async function revokeApiKey(client, workspaceId, apiKeyId) {
  const { rowCount } = await client.query(
    `UPDATE api_keys
     SET status = 'revoked',
         revoked_at = NOW(),
         updated_at = NOW()
     WHERE workspace_id = $1
       AND id = $2
       AND status <> 'revoked'`,
    [workspaceId, apiKeyId],
  );
  if (!rowCount) throw new Error('API key not found.');
  return true;
}
