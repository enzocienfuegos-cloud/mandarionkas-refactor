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

export async function listCreativeArtifacts(pool, workspaceId, creativeVersionId) {
  const { rows } = await pool.query(
    `SELECT id, workspace_id, creative_version_id, kind, storage_key, public_url, mime_type,
            size_bytes, checksum, metadata, created_at, updated_at
     FROM creative_artifacts
     WHERE workspace_id = $1 AND creative_version_id = $2
     ORDER BY created_at DESC`,
    [workspaceId, creativeVersionId],
  );
  return rows;
}

export async function upsertPublishedHtmlArtifact(pool, workspaceId, creativeVersionId, {
  storageKey,
  publicUrl,
  mimeType,
  sizeBytes,
  metadata = {},
} = {}) {
  const artifactMeta = JSON.stringify(metadata || {});
  const artifactUpdate = await pool.query(
    `UPDATE creative_artifacts
     SET storage_key = $3,
         public_url  = $4,
         mime_type   = $5,
         size_bytes  = $6,
         metadata    = $7::jsonb,
         updated_at  = NOW()
     WHERE workspace_id = $1 AND creative_version_id = $2 AND kind = 'published_html'
     RETURNING id`,
    [workspaceId, creativeVersionId, storageKey, publicUrl, mimeType, sizeBytes, artifactMeta],
  );
  if (!artifactUpdate.rowCount) {
    await pool.query(
      `INSERT INTO creative_artifacts
         (workspace_id, creative_version_id, kind, storage_key, public_url, mime_type, size_bytes, checksum, metadata)
       VALUES ($1, $2, 'published_html', $3, $4, $5, $6, NULL, $7::jsonb)`,
      [workspaceId, creativeVersionId, storageKey, publicUrl, mimeType, sizeBytes, artifactMeta],
    );
  }
}
