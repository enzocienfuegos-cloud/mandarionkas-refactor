import { getPool } from '@smx/db/src/pool.mjs';
import { JOB_NAME, runTrackerFlushJob as run } from '../../../api/src/modules/adserver/tracker/tracker-flush-job.mjs';
import { getWorkerConnectionString } from '../db-connection.mjs';

export { JOB_NAME };

export async function runTrackerFlushJob(pool = null) {
  const resolvedPool = pool || getPool(getWorkerConnectionString(process.env));
  return run(resolvedPool);
}
