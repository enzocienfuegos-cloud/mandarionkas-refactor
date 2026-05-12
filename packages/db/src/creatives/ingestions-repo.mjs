import {
  randomUUID,
  enqueueVideoTranscodeJob,
  trimText,
  normalizeLimit,
  normalizeOffset,
  normalizeSearch,
  extractJsonObject,
  normalizeRawClickUrl,
  hasPublishedRenditionAsset,
  latestVersionSelect,
  normalizeCreativeStatus,
  normalizeBindingStatus,
  normalizeSourceKind,
  inferCreativeType,
  inferServingFormat,
  inferArtifactKind,
  normalizeHtmlEntryPath,
  resolvePublishedHtml5PreviewUrl,
  buildAutoVideoOutputPlan,
  getVideoProfileOutputKey,
  buildQueuedVideoProcessingMetadata,
  normalizeVariantStatus,
  normalizeRenditionStatus,
  normalizePositiveInteger,
  buildVariantLabel,
  estimateBitrateKbps,
  buildVideoLadderProfiles,
  buildVideoTargetProfiles,
} from './shared.mjs';

export async function listCreativeIngestions(pool, workspaceId, opts = {}) {
  const { status, sourceKind, limit = 100, offset = 0 } = opts;
  const params = [workspaceId];
  const conditions = ['ci.workspace_id = $1'];

  if (status) {
    params.push(status);
    conditions.push(`ci.status = $${params.length}`);
  }
  if (sourceKind) {
    params.push(sourceKind);
    conditions.push(`ci.source_kind = $${params.length}`);
  }

  params.push(normalizeLimit(limit));
  params.push(normalizeOffset(offset));

  const { rows } = await pool.query(
    `SELECT ci.id, ci.workspace_id, ci.created_by, ci.creative_id, ci.creative_version_id,
            ci.source_kind, ci.status, ci.original_filename, ci.mime_type, ci.size_bytes,
            ci.storage_key, ci.public_url, ci.checksum, ci.metadata, ci.validation_report,
            ci.error_code, ci.error_detail, ci.created_at, ci.updated_at
     FROM creative_ingestions ci
     WHERE ${conditions.join(' AND ')}
     ORDER BY ci.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function listCreativeIngestionsForUser(pool, userId, opts = {}) {
  const { workspaceId, status, sourceKind, limit = 100, offset = 0 } = opts;
  const params = [userId];
  const conditions = ['wm.user_id = $1'];

  if (workspaceId) {
    params.push(workspaceId);
    conditions.push(`ci.workspace_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`ci.status = $${params.length}`);
  }
  if (sourceKind) {
    params.push(sourceKind);
    conditions.push(`ci.source_kind = $${params.length}`);
  }

  params.push(normalizeLimit(limit));
  params.push(normalizeOffset(offset));

  const { rows } = await pool.query(
    `SELECT ci.id, ci.workspace_id, w.name AS workspace_name, ci.created_by, ci.creative_id, ci.creative_version_id,
            ci.source_kind, ci.status, ci.original_filename, ci.mime_type, ci.size_bytes,
            ci.storage_key, ci.public_url, ci.checksum, ci.metadata, ci.validation_report,
            ci.error_code, ci.error_detail, ci.created_at, ci.updated_at
     FROM creative_ingestions ci
     JOIN workspace_members wm ON wm.workspace_id = ci.workspace_id
     JOIN workspaces w ON w.id = ci.workspace_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY ci.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function getCreativeIngestion(pool, workspaceId, ingestionId) {
  const { rows } = await pool.query(
    `SELECT ci.id, ci.workspace_id, ci.created_by, ci.creative_id, ci.creative_version_id,
            ci.source_kind, ci.status, ci.original_filename, ci.mime_type, ci.size_bytes,
            ci.storage_key, ci.public_url, ci.checksum, ci.metadata, ci.validation_report,
            ci.error_code, ci.error_detail, ci.created_at, ci.updated_at
     FROM creative_ingestions ci
     WHERE ci.workspace_id = $1 AND ci.id = $2`,
    [workspaceId, ingestionId],
  );
  return rows[0] ?? null;
}

export async function createCreativeIngestion(pool, input = {}) {
  const {
    id,
    workspaceId,
    createdBy,
    sourceKind,
    status = 'pending_upload',
    originalFilename,
    mimeType = null,
    sizeBytes = null,
    storageKey = null,
    publicUrl = null,
    checksum = null,
    metadata = {},
    validationReport = {},
    creativeId = null,
    creativeVersionId = null,
    errorCode = null,
    errorDetail = null,
  } = input;

  const params = [
    id || null,
    workspaceId,
    createdBy || null,
    creativeId,
    creativeVersionId,
    normalizeSourceKind(sourceKind),
    String(status || 'pending_upload').trim().toLowerCase(),
    originalFilename,
    mimeType,
    sizeBytes,
    storageKey,
    publicUrl,
    checksum,
    JSON.stringify(metadata || {}),
    JSON.stringify(validationReport || {}),
    errorCode,
    errorDetail,
  ];

  const { rows } = await pool.query(
    `INSERT INTO creative_ingestions (
       id, workspace_id, created_by, creative_id, creative_version_id, source_kind, status,
       original_filename, mime_type, size_bytes, storage_key, public_url, checksum,
       metadata, validation_report, error_code, error_detail
     )
     VALUES (
       COALESCE($1, gen_random_uuid()::text), $2, $3, $4, $5, $6, $7,
       $8, $9, $10, $11, $12, $13,
       $14::jsonb, $15::jsonb, $16, $17
     )
     RETURNING id, workspace_id, created_by, creative_id, creative_version_id,
               source_kind, status, original_filename, mime_type, size_bytes,
               storage_key, public_url, checksum, metadata, validation_report,
               error_code, error_detail, created_at, updated_at`,
    params,
  );
  return rows[0] ?? null;
}

export async function updateCreativeIngestion(pool, workspaceId, ingestionId, input = {}) {
  const fields = [];
  const params = [workspaceId, ingestionId];

  for (const [key, value] of Object.entries({
    creative_id: input.creative_id,
    creative_version_id: input.creative_version_id,
    source_kind: input.source_kind ? normalizeSourceKind(input.source_kind, input.source_kind) : undefined,
    status: input.status ? String(input.status).trim().toLowerCase() : undefined,
    original_filename: input.original_filename,
    mime_type: input.mime_type,
    size_bytes: input.size_bytes,
    storage_key: input.storage_key,
    public_url: input.public_url,
    checksum: input.checksum,
    error_code: input.error_code,
    error_detail: input.error_detail,
  })) {
    if (value === undefined) continue;
    params.push(value);
    fields.push(`${key} = $${params.length}`);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'metadata')) {
    params.push(JSON.stringify(input.metadata || {}));
    fields.push(`metadata = $${params.length}::jsonb`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'validation_report')) {
    params.push(JSON.stringify(input.validation_report || {}));
    fields.push(`validation_report = $${params.length}::jsonb`);
  }

  if (!fields.length) {
    return getCreativeIngestion(pool, workspaceId, ingestionId);
  }

  fields.push('updated_at = NOW()');
  const { rows } = await pool.query(
    `UPDATE creative_ingestions
     SET ${fields.join(', ')}
     WHERE workspace_id = $1 AND id = $2
     RETURNING id, workspace_id, created_by, creative_id, creative_version_id,
               source_kind, status, original_filename, mime_type, size_bytes,
               storage_key, public_url, checksum, metadata, validation_report,
               error_code, error_detail, created_at, updated_at`,
    params,
  );
  return rows[0] ?? null;
}

export async function markCreativeIngestionPublishedState(pool, workspaceId, ingestionId, metadataPatch = {}, validationReportPatch = {}) {
  await pool.query(
    `UPDATE creative_ingestions
     SET status            = 'published',
         metadata          = metadata || $3::jsonb,
         validation_report = validation_report || $4::jsonb,
         error_code        = NULL,
         error_detail      = NULL,
         updated_at        = NOW()
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, ingestionId, JSON.stringify(metadataPatch || {}), JSON.stringify(validationReportPatch || {})],
  );
}

export async function markCreativeIngestionStatus(pool, workspaceId, ingestionId, {
  status,
  metadata = undefined,
  errorCode = null,
  errorDetail = null,
} = {}) {
  if (metadata !== undefined) {
    await pool.query(
      `UPDATE creative_ingestions
       SET status = $3,
           metadata = $4::jsonb,
           error_code = $5,
           error_detail = $6,
           updated_at = NOW()
       WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, ingestionId, status, JSON.stringify(metadata || {}), errorCode, errorDetail],
    );
    return;
  }

  await pool.query(
    `UPDATE creative_ingestions
     SET status = $3,
         error_code = $4,
         error_detail = $5,
         updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, ingestionId, status, errorCode, errorDetail],
  );
}
