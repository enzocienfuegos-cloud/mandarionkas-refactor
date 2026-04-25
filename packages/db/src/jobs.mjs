export async function createJob(pool, {
  queue = 'default',
  type,
  payload = {},
  priority = 0,
  maxAttempts = 3,
  runAt = null,
}) {
  const { rows } = await pool.query(
    `INSERT INTO jobs (
       queue, type, payload, priority, max_attempts, run_at
     ) VALUES (
       $1, $2, $3::jsonb, $4, $5, COALESCE($6, NOW())
     )
     RETURNING *`,
    [
      queue,
      type,
      JSON.stringify(payload ?? {}),
      priority,
      maxAttempts,
      runAt,
    ],
  );
  return rows[0] ?? null;
}

export async function getJob(pool, jobId) {
  const { rows } = await pool.query(
    `SELECT *
     FROM jobs
     WHERE id = $1`,
    [jobId],
  );
  return rows[0] ?? null;
}

export async function updateJob(pool, jobId, patch = {}) {
  const fieldMap = {
    queue: 'queue',
    type: 'type',
    payload: 'payload',
    status: 'status',
    priority: 'priority',
    attempts: 'attempts',
    maxAttempts: 'max_attempts',
    runAt: 'run_at',
    startedAt: 'started_at',
    completedAt: 'completed_at',
    failedAt: 'failed_at',
    error: 'error',
    workerId: 'worker_id',
  };

  const params = [jobId];
  const setClauses = [];

  for (const [camel, column] of Object.entries(fieldMap)) {
    if (!(camel in patch)) continue;
    let value = patch[camel];
    if (column === 'payload') {
      value = JSON.stringify(value ?? {});
      setClauses.push(`${column} = $${params.length + 1}::jsonb`);
    } else {
      setClauses.push(`${column} = $${params.length + 1}`);
    }
    params.push(value);
  }

  if (!setClauses.length) {
    return getJob(pool, jobId);
  }

  setClauses.push('updated_at = NOW()');

  const { rows } = await pool.query(
    `UPDATE jobs
     SET ${setClauses.join(', ')}
     WHERE id = $1
     RETURNING *`,
    params,
  );
  return rows[0] ?? null;
}
