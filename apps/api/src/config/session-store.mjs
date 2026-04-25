const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function computeExpiresAt(session) {
  const cookie = session?.cookie ?? {};
  if (cookie.expires) {
    const expiresAt = new Date(cookie.expires);
    if (!Number.isNaN(expiresAt.getTime())) {
      return expiresAt;
    }
  }

  const maxAge = Number(cookie.originalMaxAge ?? cookie.maxAge);
  if (Number.isFinite(maxAge) && maxAge > 0) {
    return new Date(Date.now() + maxAge);
  }

  return new Date(Date.now() + DEFAULT_TTL_MS);
}

function normalizeSessionPayload(session) {
  return JSON.parse(JSON.stringify(session));
}

export class PostgresSessionStore {
  constructor(pool) {
    this.pool = pool;
  }

  set(sessionId, session, callback) {
    const expiresAt = computeExpiresAt(session);
    const payload = normalizeSessionPayload(session);

    this.pool.query(
      `INSERT INTO app_sessions (session_id, data, expires_at)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (session_id)
       DO UPDATE SET
         data = EXCLUDED.data,
         expires_at = EXCLUDED.expires_at,
         updated_at = NOW()`,
      [sessionId, JSON.stringify(payload), expiresAt.toISOString()],
    ).then(() => callback?.()).catch((error) => callback?.(error));
  }

  get(sessionId, callback) {
    this.pool.query(
      `SELECT data
       FROM app_sessions
       WHERE session_id = $1
         AND expires_at > NOW()`,
      [sessionId],
    ).then(({ rows }) => {
      const row = rows[0];
      callback?.(null, row?.data ?? null);
    }).catch((error) => callback?.(error));
  }

  destroy(sessionId, callback) {
    this.pool.query(
      'DELETE FROM app_sessions WHERE session_id = $1',
      [sessionId],
    ).then(() => callback?.()).catch((error) => callback?.(error));
  }
}
