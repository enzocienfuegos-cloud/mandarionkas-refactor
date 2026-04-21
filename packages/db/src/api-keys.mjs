import { createHash, randomBytes } from 'crypto';

export const KEY_PREFIX = 'smx_live_';

export const VALID_SCOPES = [
  'tags:read',
  'tags:write',
  'campaigns:read',
  'campaigns:write',
  'creatives:read',
  'creatives:write',
  'reporting:read',
  'admin',
];

export function hashKey(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

export function generateKeyPair() {
  const secret = randomBytes(32).toString('hex');
  const raw = `${KEY_PREFIX}${secret}`;
  const prefix = raw.slice(0, KEY_PREFIX.length + 8);
  const hashed = hashKey(raw);
  return { raw, prefix, hashed };
}

export async function createApiKey(pool, workspaceId, data) {
  const {
    name, scopes = [], created_by = null, expires_at = null,
  } = data;

  const invalidScopes = scopes.filter(s => !VALID_SCOPES.includes(s));
  if (invalidScopes.length > 0) {
    throw new Error(`Invalid scopes: ${invalidScopes.join(', ')}`);
  }

  const { raw, prefix, hashed } = generateKeyPair();

  const { rows } = await pool.query(
    `INSERT INTO api_keys (workspace_id, name, hashed_key, prefix, scopes, created_by, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, workspace_id, name, prefix, scopes, created_by, expires_at, revoked_at, last_used_at, created_at`,
    [workspaceId, name, hashed, prefix, scopes, created_by, expires_at ?? null],
  );

  return { ...rows[0], raw };
}

export async function listApiKeys(pool, workspaceId) {
  const { rows } = await pool.query(
    `SELECT k.id, k.workspace_id, k.name, k.prefix, k.scopes, k.created_by,
            k.expires_at, k.revoked_at, k.last_used_at, k.created_at,
            u.email AS created_by_email
     FROM api_keys k
     LEFT JOIN users u ON u.id = k.created_by
     WHERE k.workspace_id = $1
     ORDER BY k.created_at DESC`,
    [workspaceId],
  );
  return rows;
}

export async function revokeApiKey(pool, workspaceId, id) {
  const { rows } = await pool.query(
    `UPDATE api_keys
     SET revoked_at = NOW()
     WHERE workspace_id = $1 AND id = $2 AND revoked_at IS NULL
     RETURNING id, revoked_at`,
    [workspaceId, id],
  );
  return rows[0] ?? null;
}

async function touchLastUsed(pool, id) {
  pool.query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [id]).catch(() => {});
}

export async function validateApiKey(pool, rawKey, requiredScope = null) {
  if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) return null;

  const hashed = hashKey(rawKey);

  const { rows } = await pool.query(
    `SELECT k.id, k.workspace_id, k.name, k.prefix, k.scopes, k.created_by,
            k.expires_at, k.revoked_at, k.last_used_at, k.created_at
     FROM api_keys k
     WHERE k.hashed_key = $1 AND k.revoked_at IS NULL`,
    [hashed],
  );

  const key = rows[0];
  if (!key) return null;
  if (isExpired(key)) return null;
  if (requiredScope && !hasScope(key, requiredScope)) return null;

  touchLastUsed(pool, key.id);
  return key;
}

export function isExpired(key) {
  if (!key.expires_at) return false;
  return new Date(key.expires_at) < new Date();
}

export function isRevoked(key) {
  return key.revoked_at != null;
}

export function isActive(key) {
  return !isRevoked(key) && !isExpired(key);
}

export function hasScope(key, scope) {
  if (!Array.isArray(key.scopes)) return false;
  if (key.scopes.includes('admin')) return true;
  return key.scopes.includes(scope);
}
