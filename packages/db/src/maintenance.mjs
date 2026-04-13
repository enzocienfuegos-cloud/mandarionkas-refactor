export async function expirePendingUploadSessions(client) {
  const result = await client.query(
    `
      update asset_upload_sessions
      set status = 'expired'
      where status = 'pending'
        and expires_at <= now()
    `,
  );
  return result.rowCount || 0;
}

export async function revokeExpiredSessions(client) {
  const result = await client.query(
    `
      update sessions
      set revoked_at = now()
      where revoked_at is null
        and expires_at <= now()
    `,
  );
  return result.rowCount || 0;
}

export async function pruneOldDrafts(client, { retentionDays = 30 } = {}) {
  const safeDays = Number.isFinite(retentionDays) ? Math.max(1, retentionDays) : 30;
  const result = await client.query(
    `
      delete from user_document_drafts
      where updated_at < now() - ($1::text || ' days')::interval
    `,
    [String(safeDays)],
  );
  return result.rowCount || 0;
}
