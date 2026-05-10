export function toDomainUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role,
  };
}

export function toDomainSession(row) {
  return {
    userId: row.user_id,
    activeClientId: row.active_client_id ?? undefined,
    issuedAt: row.issued_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    persistenceMode: row.persistence_mode ?? 'session',
  };
}

export function toSessionInsertParams(sessionId, session) {
  return [
    sessionId,
    session.userId,
    session.activeClientId ?? null,
    session.issuedAt ?? null,
    session.expiresAt ?? null,
    session.persistenceMode ?? 'session',
  ];
}
