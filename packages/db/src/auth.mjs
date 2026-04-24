import bcryptjs from 'bcryptjs';
import { normalizeProductAccess } from './team.mjs';
const { hash, compare } = bcryptjs;

const SALT_ROUNDS = 12;

export async function hashPassword(password) {
  return hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password, hashVal) {
  return compare(password, hashVal);
}

export async function createUser(pool, data) {
  const { email, password, display_name, avatar_url } = data;
  const password_hash = password ? await hashPassword(password) : null;
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, display_name, avatar_url)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, display_name, avatar_url, email_verified, created_at`,
    [email.toLowerCase().trim(), password_hash, display_name ?? null, avatar_url ?? null],
  );
  return rows[0];
}

export async function getUserByEmail(pool, email) {
  const { rows } = await pool.query(
    `SELECT id, email, password_hash, display_name, avatar_url, email_verified, last_login_at, created_at, updated_at
     FROM users
     WHERE lower(email) = lower($1)`,
    [email],
  );
  return rows[0] ?? null;
}

export async function getUserById(pool, id) {
  const { rows } = await pool.query(
    `SELECT id, email, display_name, avatar_url, email_verified, last_login_at, created_at, updated_at, preferences
     FROM users
     WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function getUserPreferences(pool, userId) {
  const { rows } = await pool.query(
    `SELECT preferences
     FROM users
     WHERE id = $1`,
    [userId],
  );
  return rows[0]?.preferences ?? {};
}

export async function updateUserPreferences(pool, userId, patch) {
  const { rows } = await pool.query(
    `UPDATE users
     SET preferences = COALESCE(preferences, '{}'::jsonb) || $2::jsonb,
         updated_at = NOW()
     WHERE id = $1
     RETURNING preferences`,
    [userId, JSON.stringify(patch ?? {})],
  );
  return rows[0]?.preferences ?? {};
}

export async function completeInvitedUserRegistration(pool, { userId, password, display_name, avatar_url }) {
  const password_hash = await hashPassword(password);
  const { rows } = await pool.query(
    `UPDATE users
     SET password_hash = $2,
         display_name = COALESCE($3, display_name),
         avatar_url = COALESCE($4, avatar_url),
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, email, display_name, avatar_url, email_verified, created_at`,
    [userId, password_hash, display_name ?? null, avatar_url ?? null],
  );
  return rows[0] ?? null;
}

export async function createSession(pool, userId, workspaceId, expiresInMs = 7 * 24 * 60 * 60 * 1000) {
  const expiresAt = new Date(Date.now() + expiresInMs);
  const { rows } = await pool.query(
    `INSERT INTO sessions (user_id, workspace_id, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, workspace_id, expires_at, created_at`,
    [userId, workspaceId ?? null, expiresAt],
  );
  // Update last_login_at
  await pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [userId]);
  return rows[0];
}

export async function getSession(pool, sessionId) {
  const { rows } = await pool.query(
    `SELECT s.id, s.user_id, s.workspace_id, s.expires_at, s.created_at,
            u.email, u.display_name, u.avatar_url, u.email_verified
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > NOW()`,
    [sessionId],
  );
  return rows[0] ?? null;
}

export async function deleteSession(pool, sessionId) {
  const { rowCount } = await pool.query(
    `DELETE FROM sessions WHERE id = $1`,
    [sessionId],
  );
  return rowCount > 0;
}

export async function listWorkspacesForUser(pool, userId) {
  const { rows } = await pool.query(
    `SELECT w.id, w.name, w.slug, w.plan, w.logo_url, wm.role, wm.joined_at, wm.product_access
     FROM workspaces w
     JOIN workspace_members wm ON wm.workspace_id = w.id
     WHERE wm.user_id = $1
       AND wm.status = 'active'
     ORDER BY w.name ASC`,
    [userId],
  );
  return rows.map((row) => ({
    ...row,
    product_access: normalizeProductAccess(row.product_access),
  }));
}
