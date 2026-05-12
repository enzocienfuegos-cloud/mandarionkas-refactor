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
import { getCreative } from './creatives-repo.mjs';
import { getCreativeVersion, updateCreativeVersion } from './versions-repo.mjs';
import { updateCreativeIngestion } from './ingestions-repo.mjs';
import { queueVideoTranscodeForCreativeVersion, regenerateVideoRenditions, updateCreativeVersionVideoProcessingState } from './renditions-repo.mjs';

export async function createPublishedCreative(pool, input = {}) {
  const {
    workspaceId,
    createdBy,
    ingestionId,
    sourceKind,
    name,
    clickUrl = null,
    publicUrl = null,
    storageKey = null,
    originalFilename = null,
    mimeType = null,
    sizeBytes = null,
    width = null,
    height = null,
    durationMs = null,
    metadata = {},
    deferHtml5ArchivePublish = false,
    ingestionStatus = null,
    ingestionMetadata = null,
    ingestionValidationReport = null,
  } = input;

  const normalizedSourceKind = normalizeSourceKind(sourceKind);
  const creativeType = inferCreativeType(normalizedSourceKind);
  const servingFormat = inferServingFormat(normalizedSourceKind);
  const artifactKind = inferArtifactKind(normalizedSourceKind);
  const creativeName = String(name || '').trim() || originalFilename || 'Untitled creative';
  const resolvedWidth = width ?? normalizePositiveInteger(metadata?.width);
  const resolvedHeight = height ?? normalizePositiveInteger(metadata?.height);
  const resolvedDurationMs = durationMs ?? normalizePositiveInteger(metadata?.durationMs);
  const resolvedEntryPath = normalizedSourceKind === 'html5_zip'
    ? normalizeHtmlEntryPath(metadata?.entryPath || 'index.html')
    : null;
  const shouldDeferHtml5ArchivePublish = normalizedSourceKind === 'html5_zip' && deferHtml5ArchivePublish === true;
  const resolvedPreviewUrl = normalizedSourceKind === 'html5_zip'
    ? resolvePublishedHtml5PreviewUrl(publicUrl, mimeType, metadata)
    : publicUrl;
  const normalizedClickUrl = normalizeRawClickUrl(clickUrl);
  const initialCreativePublicUrl = shouldDeferHtml5ArchivePublish ? null : resolvedPreviewUrl;
  const creativeMetadata = {
    ...(metadata || {}),
    ingestionId,
    sourceKind: normalizedSourceKind,
    ...(resolvedEntryPath ? { entryPath: resolvedEntryPath } : {}),
    ...(shouldDeferHtml5ArchivePublish
      ? {
          html5Publish: {
            status: 'publishing',
            queuedAt: new Date().toISOString(),
          },
        }
      : {}),
  };

  const creativeResult = await pool.query(
    `INSERT INTO creatives (
       workspace_id, name, type, file_url, thumbnail_url, file_size, mime_type,
       width, height, duration_ms, click_url, metadata, approval_status, transcode_status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14)
     RETURNING id, workspace_id, name, type, file_url, thumbnail_url, file_size,
               mime_type, width, height, duration_ms, click_url, metadata,
               approval_status, reviewed_by, reviewed_at, review_notes,
               transcode_status, created_at, updated_at`,
    [
      workspaceId,
      creativeName,
      creativeType,
      initialCreativePublicUrl,
      initialCreativePublicUrl,
      sizeBytes,
      mimeType,
      resolvedWidth,
      resolvedHeight,
      resolvedDurationMs,
      normalizedClickUrl,
      JSON.stringify(creativeMetadata),
      'draft',
      normalizedSourceKind === 'video_mp4' ? 'queued' : 'ready',
    ],
  );
  const creative = creativeResult.rows[0];

  const versionResult = await pool.query(
    `INSERT INTO creative_versions (
       workspace_id, creative_id, version_number, source_kind, serving_format,
       status, public_url, entry_path, mime_type, width, height, duration_ms,
       file_size, metadata, created_by
     )
     VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14)
     RETURNING id, workspace_id, creative_id, version_number, source_kind, serving_format,
               status, public_url, entry_path, mime_type, width, height, duration_ms,
               file_size, metadata, created_by, reviewed_by, reviewed_at, review_notes,
               created_at, updated_at`,
    [
      workspaceId,
      creative.id,
      normalizedSourceKind,
      servingFormat,
      normalizeCreativeStatus(shouldDeferHtml5ArchivePublish ? 'processing' : 'draft'),
      initialCreativePublicUrl,
      resolvedEntryPath,
      mimeType,
      resolvedWidth,
      resolvedHeight,
      resolvedDurationMs,
      sizeBytes,
      JSON.stringify(creativeMetadata),
      createdBy || null,
    ],
  );
  const creativeVersion = versionResult.rows[0];

  await pool.query(
    `INSERT INTO creative_artifacts (
       workspace_id, creative_version_id, kind, storage_key, public_url, mime_type,
       size_bytes, checksum, metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8::jsonb)`,
    [
      workspaceId,
      creativeVersion.id,
      artifactKind,
      storageKey,
      publicUrl,
      mimeType,
      sizeBytes,
      JSON.stringify({ ingestionId, originalFilename, entryPath: resolvedEntryPath }),
    ],
  );

  let transcode = null;

  if (normalizedSourceKind === 'video_mp4') {
    await pool.query(
      `INSERT INTO video_renditions (
         workspace_id, creative_version_id, artifact_id, label, width, height,
         bitrate_kbps, codec, mime_type, status, is_source, sort_order,
         public_url, storage_key, size_bytes, metadata
       )
       SELECT
         $1,
         $2,
         ca.id,
         'Source',
         $3,
         $4,
         NULL,
         NULL,
         $5,
         'active',
         TRUE,
         0,
         $6,
         $7,
         $8,
         $9::jsonb
       FROM creative_artifacts ca
       WHERE ca.workspace_id = $1
         AND ca.creative_version_id = $2
         AND ca.kind = 'video_mp4'
       ON CONFLICT DO NOTHING`,
      [
        workspaceId,
        creativeVersion.id,
        resolvedWidth,
        resolvedHeight,
        mimeType,
        publicUrl,
        storageKey,
        sizeBytes,
        JSON.stringify({ generatedBy: 'publish', profile: 'source' }),
      ],
    );

    await regenerateVideoRenditions(pool, workspaceId, creativeVersion.id);

    const resolvedStorageKey = storageKey || null;
    const resolvedPublicUrl = publicUrl || creativeVersion.public_url || null;
    if (resolvedStorageKey && resolvedPublicUrl && createdBy) {
      transcode = await queueVideoTranscodeForCreativeVersion(pool, {
        workspaceId,
        creativeId: creative.id,
        creativeVersionId: creativeVersion.id,
        createdBy,
        creativeName,
        ingestionId,
        sourceKind: normalizedSourceKind,
        mimeType: mimeType || 'video/mp4',
        storageKey: resolvedStorageKey,
        publicUrl: resolvedPublicUrl,
        sizeBytes,
        width: resolvedWidth || null,
        height: resolvedHeight || null,
        durationMs: resolvedDurationMs || null,
      });
    } else {
      transcode = { queued: false, reason: 'missing_queue_prerequisites' };
    }

    if (!transcode?.queued) {
      const blockedReason = transcode?.reason || 'transcode_not_queued';
      await updateCreativeVersionVideoProcessingState(pool, {
        workspaceId,
        creativeVersionId: creativeVersion.id,
        status: 'blocked',
        reason: blockedReason,
      });
      await pool.query(
        `UPDATE creatives
         SET transcode_status = 'blocked',
             updated_at = NOW()
         WHERE workspace_id = $1 AND id = $2`,
        [workspaceId, creative.id],
      );
    }
  }

  const ingestion = await updateCreativeIngestion(pool, workspaceId, ingestionId, {
    creative_id: creative.id,
    creative_version_id: creativeVersion.id,
    status: ingestionStatus || (shouldDeferHtml5ArchivePublish ? 'processing' : 'published'),
    metadata: ingestionMetadata || creativeMetadata,
    validation_report: ingestionValidationReport || { published: true },
  });

  const latestCreative = await getCreative(pool, workspaceId, creative.id);
  const latestCreativeVersion = await getCreativeVersion(pool, workspaceId, creativeVersion.id);

  return {
    creative: latestCreative ?? creative,
    creativeVersion: latestCreativeVersion ?? creativeVersion,
    ingestion,
    transcode,
  };
}

export async function finalizePublishedHtml5Version(pool, workspaceId, creativeVersionId, {
  publicUrl,
  publishedPath,
  mimeType,
  width = null,
  height = null,
  metadata = {},
} = {}) {
  await pool.query(
    `UPDATE creative_versions
     SET public_url = $3,
         entry_path = $4,
         mime_type  = $5,
         width      = COALESCE($6, width),
         height     = COALESCE($7, height),
         metadata   = $8::jsonb,
         status     = 'draft',
         updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, creativeVersionId, publicUrl, publishedPath, mimeType, width, height, JSON.stringify(metadata || {})],
  );
}

export async function finalizePublishedHtml5Creative(pool, workspaceId, creativeVersionId, {
  publicUrl,
  detectedClickUrl = null,
  width = null,
  height = null,
} = {}) {
  await pool.query(
    `UPDATE creatives
     SET file_url      = $3,
         thumbnail_url = $3,
         click_url     = CASE
           WHEN $4::text IS NOT NULL THEN $4::text
           ELSE click_url
         END,
         width         = COALESCE($5, width),
         height        = COALESCE($6, height),
         updated_at    = NOW()
     WHERE workspace_id = $1
       AND id = (SELECT creative_id FROM creative_versions WHERE workspace_id = $1 AND id = $2)`,
    [workspaceId, creativeVersionId, publicUrl, normalizeRawClickUrl(detectedClickUrl), width, height],
  );
}

export async function markHtml5CreativePublishFailed(pool, workspaceId, creativeVersionId, {
  reason = null,
  detail = null,
} = {}) {
  const version = await getCreativeVersion(pool, workspaceId, creativeVersionId);
  if (!version) return null;

  const previousMetadata = (version.metadata && typeof version.metadata === 'object') ? version.metadata : {};
  const previousHtml5Publish = (previousMetadata.html5Publish && typeof previousMetadata.html5Publish === 'object')
    ? previousMetadata.html5Publish
    : {};
  const failedAt = new Date().toISOString();

  await pool.query(
    `UPDATE creative_versions
     SET status = 'draft',
         metadata = $3::jsonb,
         updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2`,
    [
      workspaceId,
      creativeVersionId,
      JSON.stringify({
        ...previousMetadata,
        html5Publish: {
          ...previousHtml5Publish,
          status: 'failed',
          reason: reason || null,
          detail: detail || null,
          failedAt,
          updatedAt: failedAt,
        },
      }),
    ],
  );

  await pool.query(
    `UPDATE creatives
     SET updated_at = NOW()
     WHERE workspace_id = $1
       AND id = (SELECT creative_id FROM creative_versions WHERE workspace_id = $1 AND id = $2)`,
    [workspaceId, creativeVersionId],
  );

  return getCreativeVersion(pool, workspaceId, creativeVersionId);
}
