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
import { listCreativeArtifacts } from './artifacts-repo.mjs';
import { getCreativeVersion, updateCreativeVersion } from './versions-repo.mjs';

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
