import { randomUUID } from 'node:crypto';
import { enqueueVideoTranscodeJob } from './video-transcode-jobs.mjs';

function trimText(value) {
  return String(value ?? '').trim();
}

function normalizeLimit(limit, fallback = 100) {
  return Math.min(Math.max(Number(limit) || fallback, 1), 500);
}

function normalizeOffset(offset) {
  return Math.max(Number(offset) || 0, 0);
}

function normalizeSearch(search) {
  const value = trimText(search).toLowerCase();
  return value.length >= 2 ? value : '';
}

function extractJsonObject(value, fallback = {}) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function normalizeRawClickUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.pathname.includes('/v1/tags/tracker/') && parsed.searchParams.has('url')) {
      const dest = parsed.searchParams.get('url');
      if (dest) {
        try {
          const validated = new URL(dest);
          if (validated.protocol === 'http:' || validated.protocol === 'https:') return dest;
        } catch (_) {
          // Fall through to store the original raw URL if the extracted destination is invalid.
        }
      }
    }
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return raw;
    return null;
  } catch (_) {
    return null;
  }
}

function hasPublishedRenditionAsset(rendition) {
  return (
    trimText(rendition?.public_url).length > 0
    && Number(rendition?.size_bytes || 0) > 0
    && extractJsonObject(rendition?.metadata, {}).available === true
  );
}

function latestVersionSelect() {
  return `
    SELECT DISTINCT ON (cv.creative_id)
      cv.id,
      cv.workspace_id,
      cv.creative_id,
      cv.version_number,
      cv.source_kind,
      cv.serving_format,
      cv.status,
      cv.public_url,
      cv.entry_path,
      cv.mime_type,
      cv.width,
      cv.height,
      cv.duration_ms,
      cv.file_size,
      cv.metadata,
      cv.created_by,
      cv.reviewed_by,
      cv.reviewed_at,
      cv.review_notes,
      cv.created_at,
      cv.updated_at
    FROM creative_versions cv
    WHERE cv.creative_id = c.id
    ORDER BY cv.creative_id, cv.version_number DESC, cv.created_at DESC
    LIMIT 1
  `;
}

export async function listCreatives(pool, workspaceId, opts = {}) {
  const { approval_status, type, limit = 100, offset = 0, search, includeLatestVersion = false } = opts;
  const params = [workspaceId];
  const conditions = ['c.workspace_id = $1'];
  const normalizedSearch = normalizeSearch(search);

  if (approval_status) {
    params.push(approval_status);
    conditions.push(`c.approval_status = $${params.length}`);
  }
  if (type) {
    params.push(type);
    conditions.push(`c.type = $${params.length}`);
  }
  if (normalizedSearch) {
    params.push(`%${normalizedSearch}%`);
    conditions.push(`LOWER(c.name) LIKE $${params.length}`);
  }

  params.push(normalizeLimit(limit));
  params.push(normalizeOffset(offset));

  const latestJoin = includeLatestVersion
    ? `LEFT JOIN LATERAL (${latestVersionSelect()}) latest_version ON TRUE`
    : '';
  const latestSelect = includeLatestVersion
    ? `,
       row_to_json(latest_version) AS latest_version`
    : '';

  const { rows } = await pool.query(
    `SELECT c.id, c.workspace_id, c.name, c.type, c.file_url, c.thumbnail_url, c.file_size,
            c.mime_type, c.width, c.height, c.duration_ms, c.click_url, c.metadata,
            c.approval_status, c.reviewed_by, c.reviewed_at, c.review_notes,
            c.transcode_status, c.created_at, c.updated_at
            ${latestSelect}
     FROM creatives c
     ${latestJoin}
     WHERE ${conditions.join(' AND ')}
     ORDER BY c.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function listCreativesForUser(pool, userId, opts = {}) {
  const { approval_status, type, workspaceId, limit = 100, offset = 0, search, includeLatestVersion = false } = opts;
  const params = [userId];
  const conditions = ['wm.user_id = $1'];
  const normalizedSearch = normalizeSearch(search);

  if (workspaceId) {
    params.push(workspaceId);
    conditions.push(`c.workspace_id = $${params.length}`);
  }
  if (approval_status) {
    params.push(approval_status);
    conditions.push(`c.approval_status = $${params.length}`);
  }
  if (type) {
    params.push(type);
    conditions.push(`c.type = $${params.length}`);
  }
  if (normalizedSearch) {
    params.push(`%${normalizedSearch}%`);
    conditions.push(`LOWER(c.name) LIKE $${params.length}`);
  }

  params.push(normalizeLimit(limit));
  params.push(normalizeOffset(offset));

  const latestJoin = includeLatestVersion
    ? `LEFT JOIN LATERAL (${latestVersionSelect()}) latest_version ON TRUE`
    : '';
  const latestSelect = includeLatestVersion
    ? `,
       row_to_json(latest_version) AS latest_version`
    : '';

  const { rows } = await pool.query(
    `SELECT c.id, c.workspace_id, w.name AS workspace_name, c.name, c.type, c.file_url, c.thumbnail_url, c.file_size,
            c.mime_type, c.width, c.height, c.duration_ms, c.click_url, c.metadata,
            c.approval_status, c.reviewed_by, c.reviewed_at, c.review_notes,
            c.transcode_status, c.created_at, c.updated_at
            ${latestSelect}
     FROM creatives c
     JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
     JOIN workspaces w ON w.id = c.workspace_id
     ${latestJoin}
     WHERE ${conditions.join(' AND ')}
     ORDER BY c.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function getCreative(pool, workspaceId, id) {
  const { rows } = await pool.query(
    `SELECT c.id, c.workspace_id, c.name, c.type, c.file_url, c.thumbnail_url, c.file_size,
            c.mime_type, c.width, c.height, c.duration_ms, c.click_url, c.metadata,
            c.approval_status, c.reviewed_by, c.reviewed_at, c.review_notes,
            c.transcode_status, c.created_at, c.updated_at
     FROM creatives c
     WHERE c.workspace_id = $1 AND c.id = $2`,
    [workspaceId, id],
  );
  return rows[0] ?? null;
}

export async function updateCreative(pool, workspaceId, id, input = {}) {
  const fields = [];
  const params = [workspaceId, id];

  if (Object.prototype.hasOwnProperty.call(input, 'name')) {
    params.push(String(input.name || '').trim());
    fields.push(`name = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'click_url')) {
    params.push(normalizeRawClickUrl(input.click_url));
    fields.push(`click_url = $${params.length}`);
  }
  if (!fields.length) {
    return getCreative(pool, workspaceId, id);
  }

  fields.push('updated_at = NOW()');
  const { rows } = await pool.query(
    `UPDATE creatives
     SET ${fields.join(', ')}
     WHERE workspace_id = $1 AND id = $2
     RETURNING id, workspace_id, name, type, file_url, thumbnail_url, file_size,
               mime_type, width, height, duration_ms, click_url, metadata,
               approval_status, reviewed_by, reviewed_at, review_notes,
               transcode_status, created_at, updated_at`,
    params,
  );
  return rows[0] ?? null;
}

export async function deleteCreative(pool, workspaceId, id) {
  const result = await pool.query(
    `DELETE FROM creatives WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, id],
  );
  return result.rowCount > 0;
}

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

function normalizeCreativeStatus(status, fallback = 'draft') {
  const normalized = String(status || '').trim().toLowerCase();
  return ['draft', 'processing', 'pending_review', 'approved', 'rejected', 'archived'].includes(normalized)
    ? normalized
    : fallback;
}

function normalizeBindingStatus(status, fallback = 'active') {
  const normalized = String(status || '').trim().toLowerCase();
  return ['draft', 'active', 'paused', 'archived'].includes(normalized)
    ? normalized
    : fallback;
}

function normalizeSourceKind(sourceKind, fallback = 'html5_zip') {
  const normalized = String(sourceKind || '').trim().toLowerCase();
  return ['legacy', 'studio_export', 'html5_zip', 'video_mp4', 'image_upload', 'native_upload', 'vast_wrapper'].includes(normalized)
    ? normalized
    : fallback;
}

function inferCreativeType(sourceKind) {
  if (sourceKind === 'video_mp4' || sourceKind === 'vast_wrapper') return 'vast_video';
  if (sourceKind === 'native_upload') return 'native';
  if (sourceKind === 'image_upload') return 'image';
  return 'display';
}

function inferServingFormat(sourceKind) {
  if (sourceKind === 'video_mp4' || sourceKind === 'vast_wrapper') return 'vast_video';
  if (sourceKind === 'native_upload') return 'native';
  if (sourceKind === 'image_upload') return 'display_image';
  return 'display_html';
}

function inferArtifactKind(sourceKind) {
  if (sourceKind === 'video_mp4') return 'video_mp4';
  return 'source_zip';
}

function normalizeHtmlEntryPath(value) {
  const normalized = trimText(value).replace(/^\/+/, '');
  if (!normalized || normalized.toLowerCase().endsWith('.zip')) return 'index.html';
  return normalized;
}

function resolvePublishedHtml5PreviewUrl(publicUrl, mimeType, metadata = {}) {
  const sourceUrl = trimText(publicUrl);
  if (!sourceUrl) return null;
  const publishedPublicUrl = trimText(metadata?.html5Publish?.publicUrl || metadata?.publishJob?.publicUrl);
  if (publishedPublicUrl) return publishedPublicUrl;
  const normalizedMimeType = trimText(mimeType).toLowerCase();
  const normalizedUrl = sourceUrl.toLowerCase();
  if (normalizedMimeType === 'text/html' && normalizedUrl.endsWith('.html')) return sourceUrl;
  if (normalizedUrl.includes('/creative-versions/') && normalizedUrl.endsWith('.html')) return sourceUrl;
  return null;
}

function buildAutoVideoOutputPlan({ storageKey, publicUrl }) {
  const safeStorageKey = String(storageKey || '').trim();
  const safePublicUrl = String(publicUrl || '').trim();
  const baseStorageKey = safeStorageKey.replace(/\.[^.]+$/, '');
  const basePublicUrl = safePublicUrl.replace(/\.[^.]+$/, '');
  const low = {
    storageKey: `${baseStorageKey}-low.mp4`,
    publicUrl: `${basePublicUrl}-low.mp4`,
    maxHeight: 480,
    videoBitrateKbps: 900,
  };
  const mid = {
    storageKey: `${baseStorageKey}-mid.mp4`,
    publicUrl: `${basePublicUrl}-mid.mp4`,
    maxHeight: 720,
    videoBitrateKbps: 1500,
  };
  const high = {
    storageKey: `${baseStorageKey}-high.mp4`,
    publicUrl: `${basePublicUrl}-high.mp4`,
    maxHeight: 1080,
    videoBitrateKbps: 2400,
  };
  const poster = {
    storageKey: `${baseStorageKey}-poster.jpg`,
    publicUrl: `${basePublicUrl}-poster.jpg`,
  };
  return {
    low,
    mid,
    high,
    '480p': low,
    '720p': mid,
    '1080p': high,
    poster,
  };
}

function getVideoProfileOutputKey(label = '') {
  const normalized = String(label || '').trim().toLowerCase();
  if (normalized === '1080p' || normalized === 'high') return 'high';
  if (normalized === '720p' || normalized === 'mid') return 'mid';
  if (normalized === '480p' || normalized === 'low') return 'low';
  return normalized;
}

function buildQueuedVideoProcessingMetadata(version = {}, ladderProfiles = [], outputPlan = {}) {
  const queuedAt = new Date().toISOString();
  const feasibleProfiles = ladderProfiles.filter((profile) => profile.transcodePossible);
  const renditionProcessing = ladderProfiles.map((profile) => {
    const key = String(profile.label || '').trim().toLowerCase();
    return {
      label: profile.label,
      status: profile.transcodePossible ? 'queued' : 'unavailable',
      available: false,
      queuedAt: profile.transcodePossible ? queuedAt : null,
      publicUrl: outputPlan[key]?.publicUrl ?? null,
      storageKey: outputPlan[key]?.storageKey ?? null,
      width: profile.width ?? null,
      height: profile.height ?? null,
      bitrateKbps: profile.bitrateKbps ?? null,
      reason: profile.transcodePossible ? null : (profile.reason ?? 'source_below_target_height'),
    };
  });
  return {
    ...(version.metadata || {}),
    videoProcessing: {
      source: {
        width: version.width ?? null,
        height: version.height ?? null,
        mimeType: version.mime_type ?? null,
        durationMs: version.duration_ms ?? null,
      },
      ffprobeAvailable: true,
      ffmpegAvailable: true,
      targetPlan: ladderProfiles,
      renditionProcessing,
      generatedCount: 1,
      noTargetsReason: feasibleProfiles.length === 0 ? 'source_below_minimum_ladder_size' : null,
      status: feasibleProfiles.length > 0 ? 'queued' : 'blocked',
      queuedAt: feasibleProfiles.length > 0 ? queuedAt : null,
      reason: feasibleProfiles.length > 0 ? null : 'source_below_minimum_ladder_size',
      mode: 'auto-on-publish',
    },
  };
}

export async function queueVideoTranscodeForCreativeVersion(pool, input = {}) {
  const {
    workspaceId,
    creativeId,
    creativeVersionId,
    createdBy,
    creativeName,
    ingestionId = null,
    sourceKind = 'video_mp4',
    mimeType = 'video/mp4',
    storageKey = null,
    publicUrl = null,
    sizeBytes = null,
    width = null,
    height = null,
    durationMs = null,
  } = input;

  if (!workspaceId || !creativeId || !creativeVersionId || !createdBy || !storageKey || !publicUrl) {
    return { queued: false, reason: 'missing_queue_prerequisites' };
  }

  const creativeVersion = await getCreativeVersion(pool, workspaceId, creativeVersionId);
  if (!creativeVersion) return { queued: false, reason: 'creative_version_not_found' };

  const assetId = randomUUID();
  const outputPlan = buildAutoVideoOutputPlan({ storageKey, publicUrl });
  const assetResult = await pool.query(
    `INSERT INTO assets (
       id, workspace_id, owner_user_id, upload_session_id, name, kind, mime_type,
       source_type, storage_mode, storage_key, public_url, origin_url,
       poster_src, thumbnail_url, access_scope, tags, size_bytes, width,
       height, duration_ms, fingerprint, font_family, metadata
     )
     VALUES (
       $1, $2, $3, NULL, $4, 'video', $5, 'upload', 'object-storage', $6, $7, $7,
       NULL, NULL, 'client', '{}'::text[], $8, $9, $10, $11, NULL, NULL, $12::jsonb
     )
     ON CONFLICT (workspace_id, storage_key) DO UPDATE
     SET owner_user_id = EXCLUDED.owner_user_id,
         name = EXCLUDED.name,
         mime_type = EXCLUDED.mime_type,
         public_url = EXCLUDED.public_url,
         origin_url = EXCLUDED.origin_url,
         size_bytes = EXCLUDED.size_bytes,
         width = EXCLUDED.width,
         height = EXCLUDED.height,
         duration_ms = EXCLUDED.duration_ms,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()
     RETURNING id`,
    [
      assetId,
      workspaceId,
      createdBy,
      creativeName,
      mimeType || 'video/mp4',
      storageKey,
      publicUrl,
      sizeBytes,
      width,
      height,
      durationMs,
      JSON.stringify({
        creativeId,
        creativeVersionId,
        ingestionId,
        sourceKind,
        optimization: {
          video: {
            status: 'queued',
            outputs: outputPlan,
            queuedAt: new Date().toISOString(),
          },
        },
      }),
    ],
  );

  const queuedAssetId = assetResult.rows[0]?.id ?? assetId;
  const ladderProfiles = buildVideoLadderProfiles(creativeVersion);
  const targetProfiles = ladderProfiles.filter((profile) => profile.transcodePossible);
  for (const profile of ladderProfiles) {
    const profileLabel = String(profile.label || '').trim();
    const profileKey = getVideoProfileOutputKey(profileLabel);
    await pool.query(
      `UPDATE video_renditions
       SET status = $6,
           public_url = $4,
           storage_key = $5,
           metadata = coalesce(metadata, '{}'::jsonb) || $7::jsonb,
           updated_at = NOW()
       WHERE workspace_id = $1
         AND creative_version_id = $2
         AND lower(label) = $3
         AND is_source = FALSE`,
      [
        workspaceId,
        creativeVersionId,
        profileLabel.toLowerCase(),
        outputPlan[profileKey]?.publicUrl ?? null,
        outputPlan[profileKey]?.storageKey ?? null,
        profile.transcodePossible ? 'queued' : 'unavailable',
        JSON.stringify({
          queuedBy: 'publish',
          profile: profileLabel,
          available: false,
          reason: profile.transcodePossible ? null : (profile.reason ?? 'source_below_target_height'),
        }),
      ],
    );
  }

  await updateCreativeVersion(pool, workspaceId, creativeVersionId, {
    metadata: buildQueuedVideoProcessingMetadata(creativeVersion, ladderProfiles, outputPlan),
  });

  await pool.query(
    `UPDATE creatives
     SET transcode_status = $3,
         updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, creativeId, targetProfiles.length > 0 ? 'queued' : 'blocked'],
  );

  if (!targetProfiles.length) {
    return { queued: false, reason: 'source_below_minimum_ladder_size', targetProfiles: ladderProfiles };
  }

  const queuedJob = await enqueueVideoTranscodeJob(pool, {
    workspaceId,
    creativeVersionId,
    assetId: queuedAssetId,
    sourceUrl: publicUrl,
    sourceStorageKey: storageKey,
    targetPlan: targetProfiles,
    createdBy,
  });

  if (!queuedJob) {
    return { queued: false, reason: 'job_already_active', outputPlan, assetId: queuedAssetId, targetProfiles: ladderProfiles };
  }

  return { queued: true, outputPlan, assetId: queuedAssetId, targetProfiles: ladderProfiles, jobId: queuedJob.id };
}

export async function createCreativeIngestion(pool, input = {}) {
  const {
    id,
    workspaceId,
    createdBy,
    sourceKind,
    status = 'uploaded',
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
    String(status || 'uploaded').trim().toLowerCase(),
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
           WHEN $4 IS NOT NULL THEN $4
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
     SET storage_key = $4,
         public_url  = $5,
         mime_type   = $6,
         size_bytes  = $7,
         metadata    = $8::jsonb,
         updated_at  = NOW()
     WHERE workspace_id = $1 AND creative_version_id = $2 AND kind = 'published_html'
     RETURNING id`,
    [workspaceId, creativeVersionId, 'published_html', storageKey, publicUrl, mimeType, sizeBytes, artifactMeta],
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

export async function syncCreativeVideoTranscodeOutputs(pool, {
  workspaceId,
  creativeVersionId,
  outputPlan = {},
  derivatives = {},
}) {
  const version = await getCreativeVersion(pool, workspaceId, creativeVersionId);
  if (!version) return null;

  const ladderProfiles = buildVideoLadderProfiles(version);
  for (const profile of ladderProfiles.filter((entry) => entry.transcodePossible)) {
    const profileLabel = String(profile.label || '').trim();
    const canonicalKey = getVideoProfileOutputKey(profileLabel);
    const derivative = derivatives[profileLabel.toLowerCase()]
      ?? derivatives[canonicalKey]
      ?? null;
    const outputEntry = outputPlan[profileLabel.toLowerCase()]
      ?? outputPlan[canonicalKey]
      ?? null;
    if (!derivative) continue;
    await pool.query(
      `UPDATE video_renditions
       SET status = 'active',
           public_url = $4,
           storage_key = $5,
           size_bytes = $6,
           mime_type = $7,
           codec = $8,
           bitrate_kbps = $9,
           width = COALESCE($10, width),
           height = COALESCE($11, height),
           artifact_id = NULL,
           sort_order = $12,
           metadata = coalesce(metadata, '{}'::jsonb) || $13::jsonb,
           updated_at = NOW()
       WHERE workspace_id = $1
         AND creative_version_id = $2
         AND lower(label) = $3
         AND is_source = FALSE`,
      [
        workspaceId,
        creativeVersionId,
        profileLabel.toLowerCase(),
        derivative.src ?? outputEntry?.publicUrl ?? null,
        outputEntry?.storageKey ?? null,
        derivative.sizeBytes ?? null,
        derivative.mimeType ?? 'video/mp4',
        derivative.codec ?? 'h264',
        derivative.bitrateKbps ?? null,
        profile.width ?? derivative.width ?? null,
        profile.height ?? derivative.height ?? null,
        profile.sortOrder ?? 0,
        JSON.stringify({
          processedAt: new Date().toISOString(),
          available: true,
          profile: profileLabel,
        }),
      ],
    );
  }

  const mergedMetadata = {
    ...(version.metadata || {}),
    videoProcessing: {
      ...((version.metadata || {}).videoProcessing || {}),
      status: 'completed',
      reason: null,
      nextRetryAt: null,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mode: 'auto-on-publish',
      poster: derivatives.poster?.src ?? null,
      generatedCount: 1 + ladderProfiles.filter((profile) => {
        const canonicalKey = getVideoProfileOutputKey(profile.label);
        return derivatives[String(profile.label || '').trim().toLowerCase()]
          ?? derivatives[canonicalKey]
          ?? null;
      }).length,
      targetPlan: ladderProfiles,
      renditionProcessing: ladderProfiles.map((profile) => {
        const canonicalKey = getVideoProfileOutputKey(profile.label);
        const normalizedLabel = String(profile.label || '').trim().toLowerCase();
        const derivative = derivatives[normalizedLabel]
          ?? derivatives[canonicalKey]
          ?? null;
        const outputEntry = outputPlan[normalizedLabel]
          ?? outputPlan[canonicalKey]
          ?? null;
        const status = derivative
          ? 'active'
          : profile.transcodePossible
            ? 'failed'
            : 'unavailable';
        return {
          label: profile.label,
          status,
          available: Boolean(derivative),
          publicUrl: derivative?.src ?? outputEntry?.publicUrl ?? null,
          storageKey: outputEntry?.storageKey ?? null,
          width: profile.width ?? null,
          height: profile.height ?? null,
          bitrateKbps: profile.bitrateKbps ?? null,
          reason: derivative
            ? null
            : profile.transcodePossible
              ? 'transcode_output_missing'
              : (profile.reason ?? 'source_below_target_height'),
          updatedAt: new Date().toISOString(),
        };
      }),
    },
  };

  await updateCreativeVersion(pool, workspaceId, creativeVersionId, {
    metadata: mergedMetadata,
  });

  await pool.query(
    `UPDATE creatives
     SET thumbnail_url = COALESCE($3, thumbnail_url),
         transcode_status = 'ready',
         updated_at = NOW()
     WHERE workspace_id = $1
       AND id = (SELECT creative_id FROM creative_versions WHERE workspace_id = $1 AND id = $2)`,
    [workspaceId, creativeVersionId, derivatives.poster?.src ?? null],
  );

  return listVideoRenditions(pool, workspaceId, creativeVersionId);
}

export async function updateCreativeVersionVideoProcessingState(pool, {
  workspaceId,
  creativeVersionId,
  status,
  reason = null,
  nextRetryAt = null,
  retryCount = null,
}) {
  const version = await getCreativeVersion(pool, workspaceId, creativeVersionId);
  if (!version) return null;

  const previousMetadata = (version.metadata && typeof version.metadata === 'object') ? version.metadata : {};
  const previousVideoProcessing = (previousMetadata.videoProcessing && typeof previousMetadata.videoProcessing === 'object')
    ? previousMetadata.videoProcessing
    : {};
  const renditionProcessing = Array.isArray(previousVideoProcessing.renditionProcessing)
    ? previousVideoProcessing.renditionProcessing
    : [];

  const normalizedStatus = String(status || '').trim().toLowerCase() || 'queued';
  const statusTimestamp = new Date().toISOString();
  const updatedVideoProcessing = {
    ...previousVideoProcessing,
    status: normalizedStatus,
    reason: reason || null,
    retryCount: retryCount ?? previousVideoProcessing.retryCount ?? null,
    nextRetryAt: nextRetryAt ?? null,
    queuedAt: normalizedStatus === 'queued'
      ? (previousVideoProcessing.queuedAt ?? statusTimestamp)
      : (previousVideoProcessing.queuedAt ?? null),
    startedAt: normalizedStatus === 'processing'
      ? (previousVideoProcessing.startedAt ?? statusTimestamp)
      : (previousVideoProcessing.startedAt ?? null),
    failedAt: normalizedStatus === 'failed' ? new Date().toISOString() : (previousVideoProcessing.failedAt ?? null),
    blockedAt: normalizedStatus === 'blocked' ? new Date().toISOString() : (previousVideoProcessing.blockedAt ?? null),
    updatedAt: statusTimestamp,
    ffmpegAvailable: reason === 'ffmpeg_missing'
      ? false
      : (previousVideoProcessing.ffmpegAvailable ?? true),
    ffmpegReason: reason === 'ffmpeg_missing'
      ? 'ffmpeg_missing'
      : (previousVideoProcessing.ffmpegReason ?? null),
    renditionProcessing: renditionProcessing.map((entry) => (
      entry?.available
        ? entry
        : {
            ...entry,
            status: normalizedStatus,
            reason: reason || null,
            nextRetryAt: nextRetryAt ?? null,
            queuedAt: normalizedStatus === 'queued'
              ? (entry?.queuedAt ?? statusTimestamp)
              : (entry?.queuedAt ?? null),
            startedAt: normalizedStatus === 'processing'
              ? (entry?.startedAt ?? statusTimestamp)
              : (entry?.startedAt ?? null),
            updatedAt: statusTimestamp,
          }
    )),
  };

  await updateCreativeVersion(pool, workspaceId, creativeVersionId, {
    metadata: {
      ...previousMetadata,
      videoProcessing: updatedVideoProcessing,
    },
  });

  return getCreativeVersion(pool, workspaceId, creativeVersionId);
}

export async function listTagBindings(pool, workspaceId, tagId) {
  const { rows } = await pool.query(
    `SELECT b.id, b.workspace_id, b.tag_id, b.creative_version_id, b.creative_size_variant_id,
            b.status, b.weight, b.start_at, b.end_at, b.created_at, b.updated_at,
            cv.creative_id, cv.status AS creative_version_status, cv.source_kind, cv.serving_format,
            cv.public_url, cv.entry_path,
            c.name AS creative_name,
            c.click_url AS creative_click_url,
            v.label AS variant_label,
            v.width AS variant_width,
            v.height AS variant_height,
            v.status AS variant_status
     FROM creative_tag_bindings b
     JOIN creative_versions cv ON cv.id = b.creative_version_id
     JOIN creatives c ON c.id = cv.creative_id
     LEFT JOIN creative_size_variants v ON v.id = b.creative_size_variant_id
     WHERE b.workspace_id = $1 AND b.tag_id = $2
     ORDER BY b.created_at DESC`,
    [workspaceId, tagId],
  );
  return rows;
}

export async function createTagBinding(pool, input = {}) {
  const {
    workspaceId,
    tagId,
    creativeVersionId,
    creativeSizeVariantId = null,
    status = 'active',
    weight = 1,
    startAt = null,
    endAt = null,
    createdBy = null,
  } = input;

  const existingResult = await pool.query(
    `SELECT id FROM creative_tag_bindings
     WHERE workspace_id = $1
       AND tag_id = $2
       AND creative_version_id = $3
       AND COALESCE(creative_size_variant_id, '') = COALESCE($4, '')`,
    [workspaceId, tagId, creativeVersionId, creativeSizeVariantId],
  );

  if (existingResult.rows[0]?.id) {
    return updateTagBinding(pool, workspaceId, tagId, existingResult.rows[0].id, {
      status,
      weight,
      start_at: startAt,
      end_at: endAt,
    });
  }

  await pool.query(
    `INSERT INTO creative_tag_bindings (
       workspace_id, tag_id, creative_version_id, creative_size_variant_id,
       status, weight, start_at, end_at, created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      workspaceId,
      tagId,
      creativeVersionId,
      creativeSizeVariantId,
      normalizeBindingStatus(status),
      Math.max(1, Number(weight) || 1),
      startAt,
      endAt,
      createdBy,
    ],
  );

  const bindings = await listTagBindings(pool, workspaceId, tagId);
  return bindings[0] ?? null;
}

export async function updateTagBinding(pool, workspaceId, tagId, bindingId, input = {}) {
  const fields = [];
  const params = [workspaceId, tagId, bindingId];

  if (Object.prototype.hasOwnProperty.call(input, 'status')) {
    params.push(normalizeBindingStatus(input.status));
    fields.push(`status = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'weight')) {
    params.push(Math.max(1, Number(input.weight) || 1));
    fields.push(`weight = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'start_at')) {
    params.push(input.start_at || null);
    fields.push(`start_at = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'end_at')) {
    params.push(input.end_at || null);
    fields.push(`end_at = $${params.length}`);
  }

  if (!fields.length) {
    const bindings = await listTagBindings(pool, workspaceId, tagId);
    return bindings.find((binding) => binding.id === bindingId) ?? null;
  }

  fields.push('updated_at = NOW()');
  await pool.query(
    `UPDATE creative_tag_bindings
     SET ${fields.join(', ')}
     WHERE workspace_id = $1 AND tag_id = $2 AND id = $3`,
    params,
  );

  const bindings = await listTagBindings(pool, workspaceId, tagId);
  return bindings.find((binding) => binding.id === bindingId) ?? null;
}

function normalizeVariantStatus(status, fallback = 'draft') {
  const normalized = String(status || '').trim().toLowerCase();
  return ['draft', 'active', 'paused', 'archived'].includes(normalized)
    ? normalized
    : fallback;
}

function normalizeRenditionStatus(status, fallback = 'processing') {
  const normalized = String(status || '').trim().toLowerCase();
  return ['draft', 'queued', 'processing', 'active', 'paused', 'archived', 'failed', 'unavailable'].includes(normalized)
    ? normalized
    : fallback;
}

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
}

function buildVariantLabel(input = {}) {
  const explicit = String(input.label || '').trim();
  if (explicit) return explicit;
  return `${input.width}x${input.height}`;
}

function estimateBitrateKbps(width, height) {
  const w = normalizePositiveInteger(width);
  const h = normalizePositiveInteger(height);
  if (!w || !h) return null;
  const pixels = w * h;
  if (pixels >= 1920 * 1080) return 5000;
  if (pixels >= 1280 * 720) return 2800;
  if (pixels >= 854 * 480) return 1400;
  return 800;
}

function buildVideoLadderProfiles(version = {}) {
  const sourceWidth = normalizePositiveInteger(version.width) || 1280;
  const sourceHeight = normalizePositiveInteger(version.height) || 720;
  const aspectRatio = sourceWidth > 0 && sourceHeight > 0 ? sourceWidth / sourceHeight : 16 / 9;
  const candidates = [
    { label: '1080p', height: 1080, sortOrder: 10 },
    { label: '720p', height: 720, sortOrder: 20 },
    { label: '480p', height: 480, sortOrder: 30 },
  ];
  return candidates.map((candidate) => {
    const width = Math.max(2, Math.round((candidate.height * aspectRatio) / 2) * 2);
    const transcodePossible = candidate.height <= sourceHeight;
    return {
      label: candidate.label,
      width,
      height: candidate.height,
      bitrateKbps: estimateBitrateKbps(width, candidate.height),
      sortOrder: candidate.sortOrder,
      transcodePossible,
      reason: transcodePossible ? null : 'source_below_target_height',
    };
  });
}

function buildVideoTargetProfiles(version = {}) {
  return buildVideoLadderProfiles(version).filter((profile) => profile.transcodePossible);
}

export async function listCreativeSizeVariants(pool, workspaceId, creativeVersionId) {
  const { rows } = await pool.query(
    `SELECT v.id, v.workspace_id, v.creative_version_id, v.label, v.width, v.height,
            v.status, v.public_url, v.artifact_id, v.metadata, v.created_by,
            v.created_at, v.updated_at,
            COALESCE(COUNT(b.id), 0)::int AS binding_count,
            COALESCE(COUNT(*) FILTER (WHERE b.status = 'active'), 0)::int AS active_binding_count,
            COALESCE(
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), NULL),
              ARRAY[]::TEXT[]
            ) AS tag_names
     FROM creative_size_variants v
     LEFT JOIN creative_tag_bindings b ON b.creative_size_variant_id = v.id
     LEFT JOIN ad_tags t ON t.id = b.tag_id
     WHERE v.workspace_id = $1 AND v.creative_version_id = $2
     GROUP BY v.id
     ORDER BY v.created_at DESC`,
    [workspaceId, creativeVersionId],
  );
  return rows;
}

export async function getCreativeSizeVariant(pool, workspaceId, variantId) {
  const { rows } = await pool.query(
    `SELECT id, workspace_id, creative_version_id, label, width, height, status,
            public_url, artifact_id, metadata, created_by, created_at, updated_at
     FROM creative_size_variants
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, variantId],
  );
  return rows[0] ?? null;
}

export async function createCreativeSizeVariant(pool, input = {}) {
  const width = normalizePositiveInteger(input.width);
  const height = normalizePositiveInteger(input.height);
  if (!width || !height) {
    throw new Error('Width and height must be positive integers.');
  }

  const params = [
    input.workspaceId,
    input.creativeVersionId,
    buildVariantLabel({ ...input, width, height }),
    width,
    height,
    normalizeVariantStatus(input.status),
    input.publicUrl || null,
    input.artifactId || null,
    JSON.stringify(input.metadata || {}),
    input.createdBy || null,
  ];

  const { rows } = await pool.query(
    `INSERT INTO creative_size_variants (
       workspace_id, creative_version_id, label, width, height,
       status, public_url, artifact_id, metadata, created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
     ON CONFLICT (creative_version_id, width, height)
     DO UPDATE SET
       label = EXCLUDED.label,
       status = EXCLUDED.status,
       public_url = COALESCE(EXCLUDED.public_url, creative_size_variants.public_url),
       artifact_id = COALESCE(EXCLUDED.artifact_id, creative_size_variants.artifact_id),
       metadata = CASE
         WHEN EXCLUDED.metadata = '{}'::jsonb THEN creative_size_variants.metadata
         ELSE creative_size_variants.metadata || EXCLUDED.metadata
       END,
       updated_at = NOW()
     RETURNING id, workspace_id, creative_version_id, label, width, height, status,
               public_url, artifact_id, metadata, created_by, created_at, updated_at`,
    params,
  );
  return rows[0] ?? null;
}

export async function createCreativeSizeVariantsBulk(pool, input = {}) {
  const variants = Array.isArray(input.variants) ? input.variants : [];
  const created = [];
  let skippedCount = 0;

  for (const variant of variants) {
    const width = normalizePositiveInteger(variant.width);
    const height = normalizePositiveInteger(variant.height);
    if (!width || !height) {
      skippedCount += 1;
      continue;
    }
    const existing = await pool.query(
      `SELECT id
       FROM creative_size_variants
       WHERE workspace_id = $1 AND creative_version_id = $2 AND width = $3 AND height = $4`,
      [input.workspaceId, input.creativeVersionId, width, height],
    );
    if (existing.rowCount) {
      skippedCount += 1;
      continue;
    }
    const createdVariant = await createCreativeSizeVariant(pool, {
      workspaceId: input.workspaceId,
      creativeVersionId: input.creativeVersionId,
      label: variant.label,
      width,
      height,
      status: variant.status ?? input.status,
      publicUrl: variant.publicUrl ?? input.publicUrl,
      artifactId: variant.artifactId ?? null,
      metadata: variant.metadata ?? {},
      createdBy: input.createdBy,
    });
    if (createdVariant) created.push(createdVariant);
  }

  const allVariants = await listCreativeSizeVariants(pool, input.workspaceId, input.creativeVersionId);
  return { created, variants: allVariants, skippedCount };
}

export async function updateCreativeSizeVariant(pool, workspaceId, variantId, input = {}) {
  const fields = [];
  const params = [workspaceId, variantId];

  if (Object.prototype.hasOwnProperty.call(input, 'label')) {
    params.push(String(input.label || '').trim());
    fields.push(`label = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'width')) {
    const width = normalizePositiveInteger(input.width);
    if (!width) throw new Error('Width must be a positive integer.');
    params.push(width);
    fields.push(`width = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'height')) {
    const height = normalizePositiveInteger(input.height);
    if (!height) throw new Error('Height must be a positive integer.');
    params.push(height);
    fields.push(`height = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'status')) {
    params.push(normalizeVariantStatus(input.status));
    fields.push(`status = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'public_url')) {
    params.push(input.public_url || null);
    fields.push(`public_url = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'artifact_id')) {
    params.push(input.artifact_id || null);
    fields.push(`artifact_id = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'metadata')) {
    params.push(JSON.stringify(input.metadata || {}));
    fields.push(`metadata = $${params.length}::jsonb`);
  }

  if (!fields.length) {
    return getCreativeSizeVariant(pool, workspaceId, variantId);
  }

  fields.push('updated_at = NOW()');
  const { rows } = await pool.query(
    `UPDATE creative_size_variants
     SET ${fields.join(', ')}
     WHERE workspace_id = $1 AND id = $2
     RETURNING id, workspace_id, creative_version_id, label, width, height, status,
               public_url, artifact_id, metadata, created_by, created_at, updated_at`,
    params,
  );
  return rows[0] ?? null;
}

export async function updateCreativeSizeVariantsBulkStatus(pool, workspaceId, creativeVersionId, variantIds = [], status) {
  const normalizedIds = variantIds.map((value) => String(value || '').trim()).filter(Boolean);
  if (!normalizedIds.length) {
    return listCreativeSizeVariants(pool, workspaceId, creativeVersionId);
  }
  await pool.query(
    `UPDATE creative_size_variants
     SET status = $4, updated_at = NOW()
     WHERE workspace_id = $1 AND creative_version_id = $2 AND id = ANY($3::text[])`,
    [workspaceId, creativeVersionId, normalizedIds, normalizeVariantStatus(status, 'active')],
  );
  return listCreativeSizeVariants(pool, workspaceId, creativeVersionId);
}

export async function listVideoRenditions(pool, workspaceId, creativeVersionId) {
  const { rows } = await pool.query(
    `SELECT id, workspace_id, creative_version_id, artifact_id, label, width, height,
            bitrate_kbps, codec, mime_type, status, is_source, sort_order,
            public_url, storage_key, size_bytes, metadata, created_at, updated_at
     FROM video_renditions
     WHERE workspace_id = $1 AND creative_version_id = $2
     ORDER BY sort_order ASC, created_at ASC`,
    [workspaceId, creativeVersionId],
  );
  return rows;
}

export async function updateVideoRendition(pool, workspaceId, renditionId, input = {}) {
  const existingResult = await pool.query(
    `SELECT id, workspace_id, creative_version_id, artifact_id, label, width, height,
            bitrate_kbps, codec, mime_type, status, is_source, sort_order,
            public_url, storage_key, size_bytes, metadata, created_at, updated_at
     FROM video_renditions
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, renditionId],
  );
  const existing = existingResult.rows[0] ?? null;
  if (!existing) return null;

  const fields = [];
  const params = [workspaceId, renditionId];

  if (Object.prototype.hasOwnProperty.call(input, 'label')) {
    params.push(trimText(input.label));
    fields.push(`label = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'status')) {
    const nextStatus = normalizeRenditionStatus(input.status, 'active');
    if (
      nextStatus === 'active'
      && !existing.is_source
      && !hasPublishedRenditionAsset(existing)
    ) {
      throw new Error('This rendition is not ready yet. Wait for transcoding to finish before activating it.');
    }
    params.push(nextStatus);
    fields.push(`status = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'sort_order')) {
    params.push(Math.max(0, Number(input.sort_order) || 0));
    fields.push(`sort_order = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'metadata')) {
    params.push(JSON.stringify(input.metadata || {}));
    fields.push(`metadata = $${params.length}::jsonb`);
  }

  if (!fields.length) {
    return existing;
  }

  fields.push('updated_at = NOW()');
  const { rows } = await pool.query(
    `UPDATE video_renditions
     SET ${fields.join(', ')}
     WHERE workspace_id = $1 AND id = $2
     RETURNING id, workspace_id, creative_version_id, artifact_id, label, width, height,
               bitrate_kbps, codec, mime_type, status, is_source, sort_order,
               public_url, storage_key, size_bytes, metadata, created_at, updated_at`,
    params,
  );
  return rows[0] ?? null;
}

export async function regenerateVideoRenditions(pool, workspaceId, creativeVersionId) {
  const version = await getCreativeVersion(pool, workspaceId, creativeVersionId);
  if (!version) return [];

  const artifactRows = await listCreativeArtifacts(pool, workspaceId, creativeVersionId);
  const sourceArtifact = artifactRows.find((artifact) => artifact.kind === 'video_mp4')
    || artifactRows.find((artifact) => artifact.kind === 'source_zip')
    || artifactRows[0]
    || null;

  await pool.query(
    `DELETE FROM video_renditions
     WHERE workspace_id = $1 AND creative_version_id = $2`,
    [workspaceId, creativeVersionId],
  );

  const sourceMetadata = {
    ...(version.metadata || {}),
    renditionProfile: 'source',
    generatedAt: new Date().toISOString(),
  };
  await pool.query(
    `INSERT INTO video_renditions (
       workspace_id, creative_version_id, artifact_id, label, width, height,
       bitrate_kbps, codec, mime_type, status, is_source, sort_order,
       public_url, storage_key, size_bytes, metadata
     )
     VALUES (
       $1, $2, $3, 'Source', $4, $5, $6, $7, $8, 'active', TRUE, 0,
       $9, $10, $11, $12::jsonb
     )`,
    [
      workspaceId,
      creativeVersionId,
      sourceArtifact?.id ?? null,
      version.width,
      version.height,
      estimateBitrateKbps(version.width, version.height),
      'h264',
      version.mime_type || 'video/mp4',
      version.public_url ?? null,
      sourceArtifact?.storage_key ?? null,
      version.file_size ?? null,
      JSON.stringify(sourceMetadata),
    ],
  );

  const ladderProfiles = buildVideoLadderProfiles(version);
  const regeneratedAt = new Date().toISOString();
  const queuedAt = new Date().toISOString();
  const sourceArtifactStorageKey = sourceArtifact?.storage_key ?? null;
  const sourcePublicUrl = version.public_url ?? null;
  const outputPlan = buildAutoVideoOutputPlan({
    storageKey: sourceArtifactStorageKey,
    publicUrl: sourcePublicUrl,
  });
  const feasibleProfiles = ladderProfiles.filter((profile) => profile.transcodePossible);
  for (const profile of ladderProfiles) {
    const profileKey = getVideoProfileOutputKey(profile.label);
    await pool.query(
      `INSERT INTO video_renditions (
         workspace_id, creative_version_id, artifact_id, label, width, height,
         bitrate_kbps, codec, mime_type, status, is_source, sort_order,
         public_url, storage_key, size_bytes, metadata
       )
       VALUES (
         $1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, FALSE, $10,
         $11, $12, NULL, $13::jsonb
       )`,
      [
        workspaceId,
        creativeVersionId,
        profile.label,
        profile.width,
        profile.height,
        profile.bitrateKbps,
        'h264',
        'video/mp4',
        profile.transcodePossible ? 'queued' : 'unavailable',
        profile.sortOrder,
        outputPlan[profileKey]?.publicUrl ?? null,
        outputPlan[profileKey]?.storageKey ?? null,
        JSON.stringify({
          ...version.metadata,
          renditionProfile: profile.label,
          generatedAt: regeneratedAt,
          targetWidth: profile.width,
          targetHeight: profile.height,
          available: false,
          reason: profile.transcodePossible ? null : (profile.reason ?? 'source_below_target_height'),
        }),
      ],
    );
  }

  const mergedMetadata = {
    ...(version.metadata || {}),
    videoProcessing: {
      source: {
        width: version.width ?? null,
        height: version.height ?? null,
        mimeType: version.mime_type ?? null,
        durationMs: version.duration_ms ?? null,
      },
      ffprobeAvailable: true,
      ffmpegAvailable: true,
      targetPlan: ladderProfiles,
      renditionProcessing: ladderProfiles.map((profile) => ({
        label: profile.label,
        status: profile.transcodePossible ? 'queued' : 'unavailable',
        available: false,
        queuedAt: profile.transcodePossible ? queuedAt : null,
        publicUrl: outputPlan[getVideoProfileOutputKey(profile.label)]?.publicUrl ?? null,
        storageKey: outputPlan[getVideoProfileOutputKey(profile.label)]?.storageKey ?? null,
        width: profile.width ?? null,
        height: profile.height ?? null,
        bitrateKbps: profile.bitrateKbps ?? null,
        reason: profile.transcodePossible ? null : (profile.reason ?? 'source_below_target_height'),
      })),
      generatedCount: 1,
      noTargetsReason: feasibleProfiles.length === 0 ? 'source_below_minimum_ladder_size' : null,
      status: feasibleProfiles.length > 0 ? 'queued' : 'blocked',
      queuedAt: feasibleProfiles.length > 0 ? queuedAt : null,
      reason: feasibleProfiles.length > 0 ? null : 'source_below_minimum_ladder_size',
      regeneratedAt,
    },
  };
  await updateCreativeVersion(pool, workspaceId, creativeVersionId, {
    metadata: mergedMetadata,
  });

  return listVideoRenditions(pool, workspaceId, creativeVersionId);
}
