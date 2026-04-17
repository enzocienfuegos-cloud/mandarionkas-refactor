import { executePostgresQuery } from './postgres-client.mjs';
import { table } from './postgres-support.mjs';
import { toDomainSession, toDomainUser, toSessionInsertParams } from './mappers/auth-mapper.mjs';

export async function listUsers() {
  const result = await executePostgresQuery(`SELECT * FROM ${table('users')} ORDER BY id ASC`);
  return (result.rows ?? []).map(toDomainUser);
}

export async function getUserById(userId) {
  const result = await executePostgresQuery(`SELECT * FROM ${table('users')} WHERE id = $1 LIMIT 1`, [userId]);
  const row = result.rows?.[0];
  return row ? toDomainUser(row) : null;
}

export async function getUserByEmail(email) {
  const result = await executePostgresQuery(
    `SELECT * FROM ${table('users')} WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email]
  );
  const row = result.rows?.[0];
  return row ? toDomainUser(row) : null;
}

export async function createSessionRecord(sessionId, session) {
  await executePostgresQuery(
    `INSERT INTO ${table('sessions')} (
      id, user_id, active_client_id, issued_at, expires_at, persistence_mode
    ) VALUES ($1, $2, $3, $4, $5, $6)`,
    toSessionInsertParams(sessionId, session)
  );
  return session;
}

export async function getSessionRecord(sessionId) {
  const result = await executePostgresQuery(`SELECT * FROM ${table('sessions')} WHERE id = $1 LIMIT 1`, [sessionId]);
  const row = result.rows?.[0];
  return row ? toDomainSession(row) : null;
}

export async function updateSessionActiveClient(sessionId, activeClientId) {
  const result = await executePostgresQuery(
    `UPDATE ${table('sessions')}
     SET active_client_id = $2
     WHERE id = $1
     RETURNING *`,
    [sessionId, activeClientId ?? null]
  );
  const row = result.rows?.[0];
  return row ? toDomainSession(row) : null;
}

export async function deleteSessionRecord(sessionId) {
  const result = await executePostgresQuery(`DELETE FROM ${table('sessions')} WHERE id = $1`, [sessionId]);
  return Number(result.rowCount || 0) > 0;
}

export async function cleanupExpiredSessionRecords(cutoffIso) {
  const selectResult = await executePostgresQuery(
    `SELECT id FROM ${table('sessions')}
     WHERE expires_at IS NULL OR expires_at <= $1`,
    [cutoffIso]
  );
  const removedSessionIds = (selectResult.rows ?? []).map((row) => row.id);
  if (!removedSessionIds.length) return [];
  await executePostgresQuery(
    `DELETE FROM ${table('sessions')}
     WHERE id = ANY($1::text[])`,
    [removedSessionIds]
  );
  return removedSessionIds;
}
