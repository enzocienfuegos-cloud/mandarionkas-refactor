import { randomUUID } from 'node:crypto';

function toJson(value) {
  return value ? JSON.stringify(value) : null;
}

function toPositiveInteger(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function enqueueVideoTranscodeJob(client, {
  workspaceId,
  ownerUserId = null,
  assetId,
  input,
  priority = 100,
  maxAttempts = 3,
}) {
  const result = await client.query(
    `
      insert into asset_processing_jobs (
        id,
        workspace_id,
        owner_user_id,
        asset_id,
        job_type,
        status,
        priority,
        max_attempts,
        input,
        available_at
      )
      values ($1, $2, $3, $4, 'video-transcode', 'pending', $5, $6, $7::jsonb, now())
      returning id, workspace_id, owner_user_id, asset_id, job_type, status, priority, attempts, max_attempts, input, output, error_message, claimed_at, completed_at, available_at, created_at, updated_at
    `,
    [randomUUID(), workspaceId, ownerUserId, assetId, priority, maxAttempts, toJson(input)],
  );

  return result.rows[0];
}

export async function enqueueImageDerivativeJob(client, {
  workspaceId,
  ownerUserId = null,
  assetId,
  input,
  priority = 90,
  maxAttempts = 3,
}) {
  const result = await client.query(
    `
      insert into asset_processing_jobs (
        id,
        workspace_id,
        owner_user_id,
        asset_id,
        job_type,
        status,
        priority,
        max_attempts,
        input,
        available_at
      )
      values ($1, $2, $3, $4, 'image-derivatives', 'pending', $5, $6, $7::jsonb, now())
      returning id, workspace_id, owner_user_id, asset_id, job_type, status, priority, attempts, max_attempts, input, output, error_message, claimed_at, completed_at, available_at, created_at, updated_at
    `,
    [randomUUID(), workspaceId, ownerUserId, assetId, priority, maxAttempts, toJson(input)],
  );

  return result.rows[0];
}

export async function claimNextAssetProcessingJob(client, { jobType }) {
  const result = await client.query(
    `
      update asset_processing_jobs
      set status = 'processing',
          attempts = attempts + 1,
          claimed_at = now(),
          updated_at = now(),
          error_message = null
      where id = (
        select id
        from asset_processing_jobs
        where job_type = $1
          and status = 'pending'
          and attempts < max_attempts
          and coalesce(available_at, now()) <= now()
        order by priority asc, created_at asc
        for update skip locked
        limit 1
      )
      returning id, workspace_id, owner_user_id, asset_id, job_type, status, priority, attempts, max_attempts, input, output, error_message, claimed_at, completed_at, available_at, created_at, updated_at
    `,
    [jobType],
  );

  return result.rows[0] || null;
}

export async function completeAssetProcessingJob(client, { jobId, output = null }) {
  const result = await client.query(
    `
      update asset_processing_jobs
      set status = 'completed',
          output = $2::jsonb,
          completed_at = now(),
          updated_at = now()
      where id = $1
      returning id, workspace_id, owner_user_id, asset_id, job_type, status, priority, attempts, max_attempts, input, output, error_message, claimed_at, completed_at, available_at, created_at, updated_at
    `,
    [jobId, toJson(output)],
  );
  return result.rows[0] || null;
}

export async function failAssetProcessingJob(client, { jobId, errorMessage, output = null, final = false, retryDelaySeconds = null }) {
  const normalizedRetryDelaySeconds = toPositiveInteger(retryDelaySeconds);
  const result = await client.query(
    `
      update asset_processing_jobs
      set status = case when $4::boolean then 'failed' else 'pending' end,
          error_message = $2,
          output = coalesce($3::jsonb, output),
          available_at = case
            when $4::boolean then now()
            when $5::integer is not null then now() + make_interval(secs => $5::integer)
            else now()
          end,
          completed_at = case when $4::boolean then now() else completed_at end,
          updated_at = now()
      where id = $1
      returning id, workspace_id, owner_user_id, asset_id, job_type, status, priority, attempts, max_attempts, input, output, error_message, claimed_at, completed_at, available_at, created_at, updated_at
    `,
    [jobId, errorMessage || 'Processing failed.', toJson(output), final, normalizedRetryDelaySeconds],
  );
  return result.rows[0] || null;
}

export async function skipAssetProcessingJob(client, { jobId, reason, output = null }) {
  const result = await client.query(
    `
      update asset_processing_jobs
      set status = 'skipped',
          error_message = $2,
          output = $3::jsonb,
          completed_at = now(),
          updated_at = now()
      where id = $1
      returning id, workspace_id, owner_user_id, asset_id, job_type, status, priority, attempts, max_attempts, input, output, error_message, claimed_at, completed_at, available_at, created_at, updated_at
    `,
    [jobId, reason || 'Skipped.', toJson(output)],
  );
  return result.rows[0] || null;
}

export async function patchAssetMetadata(client, { assetId, workspaceId, metadataPatch = {}, posterSrc = undefined, thumbnailUrl = undefined }) {
  const result = await client.query(
    `
      update assets
      set metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
          poster_src = coalesce($4, poster_src),
          thumbnail_url = coalesce($5, thumbnail_url),
          updated_at = now()
      where id = $1 and workspace_id = $2
      returning id
    `,
    [assetId, workspaceId, JSON.stringify(metadataPatch || {}), posterSrc ?? null, thumbnailUrl ?? null],
  );
  return Boolean(result.rows[0]);
}
