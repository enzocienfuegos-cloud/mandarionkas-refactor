import { getPool } from '@smx/db/src/pool.mjs';
import { JOB_NAME, runTrackerFlushJob as run } from '../../../apps/api/src/modules/adserver/tracker/tracker-flush-job.mjs';

export { JOB_NAME };

export async function runTrackerFlushJob(pool = null) {
  const resolvedPool = pool || getPool(String(process.env.DATABASE_POOL_URL || process.env.DATABASE_URL || '').trim());
  return run(resolvedPool);
}
