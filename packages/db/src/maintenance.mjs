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

const PENDING_CREATIVE_UPLOAD_TTL_HOURS = 24;
const FAILED_CREATIVE_INGESTION_TTL_HOURS = 24 * 7;

export async function pruneOrphanCreativeIngestions(client, {
  pendingUploadTtlHours = PENDING_CREATIVE_UPLOAD_TTL_HOURS,
  failedTtlHours = FAILED_CREATIVE_INGESTION_TTL_HOURS,
  limit = 200,
} = {}) {
  const safePendingHours = Number.isFinite(Number(pendingUploadTtlHours))
    ? Math.max(1, Number(pendingUploadTtlHours))
    : PENDING_CREATIVE_UPLOAD_TTL_HOURS;
  const safeFailedHours = Number.isFinite(Number(failedTtlHours))
    ? Math.max(1, Number(failedTtlHours))
    : FAILED_CREATIVE_INGESTION_TTL_HOURS;
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Number(limit)) : 200;

  const stalePending = await client.query(
    `
      update creative_ingestions
      set status = 'failed',
          error_code = 'upload_abandoned',
          error_detail = 'Upload session expired before R2 PutObject completed.',
          updated_at = now()
      where status = 'pending_upload'
        and created_at < now() - ($1::text || ' hours')::interval
    `,
    [String(safePendingHours)],
  );

  const { rows: pendingR2Sweep } = await client.query(
    `
      select ci.id, ci.workspace_id, ci.storage_key
      from creative_ingestions ci
      where ci.status = 'failed'
        and ci.storage_key is not null
        and ci.updated_at < now() - ($1::text || ' hours')::interval
        and not exists (
          select 1
          from creative_artifacts ca
          where ca.workspace_id = ci.workspace_id
            and ca.storage_key = ci.storage_key
        )
      order by ci.updated_at asc
      limit $2
    `,
    [String(safeFailedHours), safeLimit],
  );

  return {
    markedFailed: stalePending.rowCount || 0,
    pendingR2Sweep,
  };
}

export async function deleteCreativeIngestionRows(client, ids = []) {
  const safeIds = Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
  if (!safeIds.length) return 0;

  const result = await client.query(
    `
      delete from creative_ingestions
      where id = any($1::text[])
    `,
    [safeIds],
  );
  return result.rowCount || 0;
}
