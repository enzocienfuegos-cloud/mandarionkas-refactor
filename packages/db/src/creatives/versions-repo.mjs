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

export async function listCreativeVersions(pool, workspaceId, creativeId) {
  const { rows } = await pool.query(
    `SELECT id, workspace_id, creative_id, version_number, source_kind, serving_format,
            status, public_url, entry_path, mime_type, width, height, duration_ms,
            file_size, metadata, created_by, reviewed_by, reviewed_at, review_notes,
            created_at, updated_at
     FROM creative_versions
     WHERE workspace_id = $1 AND creative_id = $2
     ORDER BY version_number DESC, created_at DESC`,
    [workspaceId, creativeId],
  );
  return rows;
}

export async function getCreativeVersion(pool, workspaceId, versionId) {
  const { rows } = await pool.query(
    `SELECT id, workspace_id, creative_id, version_number, source_kind, serving_format,
            status, public_url, entry_path, mime_type, width, height, duration_ms,
            file_size, metadata, created_by, reviewed_by, reviewed_at, review_notes,
            created_at, updated_at
     FROM creative_versions
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, versionId],
  );
  return rows[0] ?? null;
}

export async function listPendingReviewCreativeVersions(pool, userId) {
  const { rows } = await pool.query(
    `SELECT cv.id, cv.workspace_id, w.name AS workspace_name, cv.creative_id, c.name AS creative_name,
            cv.version_number, cv.source_kind, cv.serving_format, cv.status, cv.public_url, cv.entry_path,
            cv.mime_type, cv.width, cv.height, cv.duration_ms, cv.file_size, cv.metadata, cv.created_by,
            cv.reviewed_by, cv.reviewed_at, cv.review_notes, cv.created_at, cv.updated_at
     FROM creative_versions cv
     JOIN creatives c ON c.id = cv.creative_id
     JOIN workspace_members wm ON wm.workspace_id = cv.workspace_id
     JOIN workspaces w ON w.id = cv.workspace_id
     WHERE wm.user_id = $1
     AND cv.status = 'pending_review'
     ORDER BY cv.created_at DESC`,
    [userId],
  );
  return rows;
}

export async function updateCreativeVersion(pool, workspaceId, versionId, input = {}) {
  const fields = [];
  const params = [workspaceId, versionId];

  for (const [key, value] of Object.entries({
    status: input.status,
    metadata: input.metadata,
    reviewed_by: input.reviewed_by,
    reviewed_at: input.reviewed_at,
    review_notes: input.review_notes,
  })) {
    if (value === undefined) continue;
    params.push(key === 'metadata' ? JSON.stringify(value ?? {}) : value);
    if (key === 'metadata') {
      fields.push(`metadata = $${params.length}::jsonb`);
    } else {
      fields.push(`${key} = $${params.length}`);
    }
  }

  if (!fields.length) {
    return getCreativeVersion(pool, workspaceId, versionId);
  }

  fields.push('updated_at = NOW()');
  const { rows } = await pool.query(
    `UPDATE creative_versions
     SET ${fields.join(', ')}
     WHERE workspace_id = $1 AND id = $2
     RETURNING id, workspace_id, creative_id, version_number, source_kind, serving_format,
               status, public_url, entry_path, mime_type, width, height, duration_ms,
               file_size, metadata, created_by, reviewed_by, reviewed_at, review_notes,
               created_at, updated_at`,
    params,
  );
  return rows[0] ?? null;
}
