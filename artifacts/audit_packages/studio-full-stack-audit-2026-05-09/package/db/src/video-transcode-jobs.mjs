// packages/db/src/video-transcode-jobs.mjs
//
// CHANGE LOG — S51 fix:
//
// enqueueVideoTranscodeJob(): changed ON CONFLICT clause from the generic
// "ON CONFLICT DO NOTHING" to a targeted conflict that infers the partial
// unique index video_transcode_jobs_active_version_idx (created in migration 0023).
//
// WHY:
//   The old "ON CONFLICT DO NOTHING" fired on ANY unique violation across the
//   whole table, including the PK. More importantly, on regenerate flows the
//   old job was in status='stalled' or 'failed' — those statuses are NOT covered
//   by the partial unique index (which only covers pending/claimed/processing).
//   So a regenerate attempt correctly tried to INSERT a new row, but the broad
//   DO NOTHING could mask unexpected conflicts.
//
//   The new clause explicitly targets only the active-job deduplication index
//   by index inference, making the intent clear: "skip only if an active
//   (pending/claimed/processing) job already exists for this creative_version_id".
//   A completed/failed/stalled job does NOT block a new INSERT.
//
// NO OTHER CHANGES to this file.

import { randomUUID } from 'node:crypto';

const STALL_TIMEOUT_MINUTES = 15;

function toJson(value) {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

export async function enqueueVideoTranscodeJob(client, {
  workspaceId,
  creativeVersionId,
  assetId,
  sourceUrl,
  sourceStorageKey = null,
  targetPlan = [],
  createdBy = null,
  priority = 100,
  maxAttempts = 3,
}) {
  if (!workspaceId || !creativeVersionId || !assetId || !sourceUrl) {
    throw new Error('enqueueVideoTranscodeJob: workspaceId, creativeVersionId, assetId, and sourceUrl are required.');
  }

  const { rows } = await client.query(
    `
      INSERT INTO video_transcode_jobs (
        id, workspace_id, creative_version_id, asset_id,
        status, attempts, max_attempts,
        source_url, source_storage_key, target_plan,
        priority, available_at, created_by, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4,
        'pending', 0, $5,
        $6, $7, $8::jsonb,
        $9, NOW(), $10, NOW(), NOW()
      )
      ON CONFLICT (creative_version_id)
      WHERE status IN ('pending', 'claimed', 'processing')
      DO NOTHING
      RETURNING *
    `,
    [
      randomUUID(), workspaceId, creativeVersionId, assetId,
      maxAttempts,
      sourceUrl, sourceStorageKey, toJson(targetPlan),
      priority, createdBy,
    ],
  );

  return rows[0] ?? null;
}

export async function claimNextVideoTranscodeJob(client) {
  const { rows } = await client.query(
    `
      UPDATE video_transcode_jobs
      SET
        status     = 'claimed',
        attempts   = attempts + 1,
        claimed_at = NOW(),
        updated_at = NOW()
      WHERE id = (
        SELECT id
        FROM   video_transcode_jobs
        WHERE  status = 'pending'
          AND  attempts < max_attempts
          AND  available_at <= NOW()
        ORDER  BY priority ASC, available_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT  1
      )
      RETURNING *
    `,
  );

  return rows[0] ?? null;
}

export async function markVideoTranscodeJobProcessing(client, jobId) {
  const { rows } = await client.query(
    `
      UPDATE video_transcode_jobs
      SET
        status                = 'processing',
        processing_started_at = NOW(),
        updated_at            = NOW()
      WHERE id = $1 AND status = 'claimed'
      RETURNING *
    `,
    [jobId],
  );
  return rows[0] ?? null;
}

export async function completeVideoTranscodeJob(client, jobId, output) {
  const { rows } = await client.query(
    `
      UPDATE video_transcode_jobs
      SET
        status       = 'done',
        output       = $2::jsonb,
        completed_at = NOW(),
        updated_at   = NOW()
      WHERE id = $1 AND status IN ('claimed', 'processing')
      RETURNING *
    `,
    [jobId, toJson(output)],
  );
  return rows[0] ?? null;
}

export async function failVideoTranscodeJob(client, jobId, errorMessage, errorDetail = null) {
  const { rows } = await client.query(
    `
      UPDATE video_transcode_jobs
      SET
        status        = 'failed',
        error_message = $2,
        error_detail  = $3::jsonb,
        failed_at     = NOW(),
        updated_at    = NOW()
      WHERE id = $1 AND status IN ('claimed', 'processing')
      RETURNING *
    `,
    [jobId, errorMessage, toJson(errorDetail)],
  );
  return rows[0] ?? null;
}

export async function stallVideoTranscodeJob(client, jobId) {
  const { rows } = await client.query(
    `
      UPDATE video_transcode_jobs
      SET
        status     = 'stalled',
        stalled_at = NOW(),
        updated_at = NOW()
      WHERE id = $1 AND status = 'processing'
      RETURNING *
    `,
    [jobId],
  );
  return rows[0] ?? null;
}

export async function requeueStalledVideoTranscodeJob(client, jobId, retryDelaySeconds = 60) {
  const { rows } = await client.query(
    `
      UPDATE video_transcode_jobs
      SET
        status       = 'pending',
        stalled_at   = NULL,
        available_at = NOW() + ($2 || ' seconds')::interval,
        updated_at   = NOW()
      WHERE id = $1
        AND status = 'stalled'
        AND attempts < max_attempts
      RETURNING *
    `,
    [jobId, retryDelaySeconds],
  );

  if (rows[0]) return 're-enqueued';

  const { rows: check } = await client.query(
    `SELECT id, attempts, max_attempts FROM video_transcode_jobs WHERE id = $1`,
    [jobId],
  );
  if (!check[0]) return 'not-found';
  if (check[0].attempts >= check[0].max_attempts) return 'exhausted';
  return 'not-found';
}

export async function findStalledVideoTranscodeJobs(client) {
  const { rows } = await client.query(
    `
      SELECT *
      FROM   video_transcode_jobs
      WHERE  status = 'processing'
        AND  updated_at < NOW() - ($1 || ' minutes')::interval
      ORDER  BY updated_at ASC
    `,
    [STALL_TIMEOUT_MINUTES],
  );
  return rows;
}

export async function getVideoTranscodeJobForVersion(pool, workspaceId, creativeVersionId) {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM   video_transcode_jobs
      WHERE  workspace_id        = $1
        AND  creative_version_id = $2
      ORDER  BY created_at DESC
      LIMIT  1
    `,
    [workspaceId, creativeVersionId],
  );
  return rows[0] ?? null;
}

export async function getVideoTranscodeJobsForVersions(pool, workspaceId, creativeVersionIds) {
  if (!creativeVersionIds.length) return new Map();

  const { rows } = await pool.query(
    `
      SELECT DISTINCT ON (creative_version_id)
        id, creative_version_id, status, attempts, max_attempts,
        error_message, completed_at, failed_at, stalled_at, updated_at
      FROM   video_transcode_jobs
      WHERE  workspace_id        = $1
        AND  creative_version_id = ANY($2::text[])
      ORDER  BY creative_version_id, created_at DESC
    `,
    [workspaceId, creativeVersionIds],
  );

  return new Map(rows.map((row) => [row.creative_version_id, row]));
}

export function deriveTranscodeDisplayStatus(job) {
  if (!job) return 'no_job';
  if (job.status === 'done') return 'done';
  if (job.status === 'failed') return 'failed';
  if (job.status === 'stalled') return 'stalled';
  if (job.status === 'pending' || job.status === 'claimed') return 'pending';
  if (job.status === 'processing') return 'processing';
  return 'no_job';
}

export async function reconcileStalledVideoTranscodeJobs(client) {
  const stalledJobs = await findStalledVideoTranscodeJobs(client);
  let requeued = 0;
  let exhausted = 0;

  for (const job of stalledJobs) {
    await stallVideoTranscodeJob(client, job.id);

    const retryDelay = Math.min(600, 60 * Math.pow(2, Math.max(0, job.attempts - 1)));
    const result = await requeueStalledVideoTranscodeJob(client, job.id, retryDelay);

    if (result === 're-enqueued') requeued++;
    else exhausted++;
  }

  return { stalled: stalledJobs.length, requeued, exhausted };
}
