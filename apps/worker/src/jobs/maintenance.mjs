import { getPool, closeAllPools } from '@smx/db/pool';
import { expirePendingUploadSessions, pruneOldDrafts, revokeExpiredSessions } from '@smx/db/maintenance';
import { logInfo } from '@smx/config/logger';

function getConnectionString(source = process.env) {
  return String(source.DATABASE_POOL_URL || source.DATABASE_URL || '').trim();
}

export async function runMaintenanceJob(source = process.env) {
  const connectionString = getConnectionString(source);
  if (!connectionString) {
    logInfo({ service: 'smx-worker', job: 'maintenance', status: 'skipped', reason: 'database_not_configured' });
    return { expiredUploadSessions: 0, revokedSessions: 0, prunedDrafts: 0, skipped: true };
  }

  const pool = getPool(connectionString);
  const client = await pool.connect();
  try {
    const retentionDays = Number.parseInt(String(source.DRAFT_RETENTION_DAYS || '30'), 10);
    const expiredUploadSessions = await expirePendingUploadSessions(client);
    const revokedSessions = await revokeExpiredSessions(client);
    const prunedDrafts = await pruneOldDrafts(client, { retentionDays });
    const summary = { expiredUploadSessions, revokedSessions, prunedDrafts, skipped: false };
    logInfo({ service: 'smx-worker', job: 'maintenance', status: 'completed', ...summary });
    return summary;
  } finally {
    client.release();
    await closeAllPools();
  }
}
