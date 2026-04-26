import {
  createCreative,
  createCreativeArtifact,
  createVideoRendition,
  createCreativeVersion,
  ensureCreativeVersionDefaultVariant,
  listCreativeArtifacts,
  listVideoRenditions,
  updateCreative,
  updateCreativeVersion,
} from '@smx/db';
import { listTagIdsByCreativeVersion } from '@smx/db/tags';
import { expandAndPublishHtml5Archive } from './html5-publisher.mjs';
import { enrichVideoPublication } from './video-processor.mjs';
import { syncVideoRenditionsForVersion } from './video-rendition-sync.mjs';
import { enqueueStaticVastPublish } from '../vast/publish-queue.mjs';

export function deriveCreativeName(row, requestedName) {
  if (requestedName && String(requestedName).trim()) {
    return String(requestedName).trim();
  }
  if (row.metadata?.requestedName && String(row.metadata.requestedName).trim()) {
    return String(row.metadata.requestedName).trim();
  }
  const filename = String(row.original_filename ?? 'Untitled creative');
  return filename.replace(/\.[^.]+$/, '') || 'Untitled creative';
}

export function getCatalogDraftForIngestion(row) {
  if (row.source_kind === 'video_mp4') {
    return {
      creativeType: 'video',
      servingFormat: 'vast_video',
      artifactKind: 'video_mp4',
      publicUrl: row.public_url ?? null,
      entryPath: null,
      mimeType: row.mime_type ?? 'video/mp4',
      transcodeStatus: 'processing',
      metadata: {
        publishedFrom: 'external_ingestion',
        ingestionId: row.id,
        sourceKind: row.source_kind,
      },
    };
  }

  return {
    creativeType: 'html',
    servingFormat: 'display_html',
    artifactKind: 'source_zip',
    publicUrl: null,
    entryPath: null,
    mimeType: row.mime_type ?? 'application/zip',
    transcodeStatus: 'pending',
    metadata: {
      publishedFrom: 'external_ingestion',
      ingestionId: row.id,
      sourceKind: row.source_kind,
      awaitingArtifactExpansion: true,
    },
  };
}

export function shouldRequireManualReview(body = {}) {
  return body?.requireReview === true;
}

function normalizeHttpUrl(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch (_) {
    return null;
  }
}

export async function publishCreativeIngestionToCatalog({
  pool,
  workspaceId,
  ingestion,
  requestedName,
  requestedClickUrl = null,
  userId,
  requireManualReview = false,
  onStage = null,
}) {
  const creativeName = deriveCreativeName(ingestion, requestedName);
  const catalogDraft = getCatalogDraftForIngestion(ingestion);
  const fallbackClickUrl = normalizeHttpUrl(
    requestedClickUrl
    ?? ingestion.metadata?.requestedClickUrl
    ?? ingestion.metadata?.clickUrl
    ?? null,
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await onStage?.({
      stage: 'creating_catalog_record',
      progressPercent: 15,
      message: 'Creating creative and version records',
    });

    let creative = await createCreative(client, workspaceId, {
      name: creativeName,
      type: catalogDraft.creativeType,
      file_url: ingestion.source_kind === 'video_mp4' ? ingestion.public_url ?? null : null,
      file_size: ingestion.size_bytes ?? null,
      mime_type: catalogDraft.mimeType,
      duration_ms: null,
      width: null,
      height: null,
      click_url: fallbackClickUrl,
      metadata: {
        ingestionId: ingestion.id,
        sourceKind: ingestion.source_kind,
        originalFilename: ingestion.original_filename,
        validationReport: ingestion.validation_report ?? {},
        ...(ingestion.metadata ?? {}),
      },
      approval_status: requireManualReview ? 'pending_review' : 'approved',
      transcode_status: catalogDraft.transcodeStatus,
    }, { ensureLegacyVersion: false });

    const creativeVersion = await createCreativeVersion(client, workspaceId, {
      creativeId: creative.id,
      source_kind: ingestion.source_kind,
      serving_format: catalogDraft.servingFormat,
      status: requireManualReview ? 'pending_review' : 'approved',
      public_url: catalogDraft.publicUrl,
      entry_path: catalogDraft.entryPath,
      mime_type: catalogDraft.mimeType,
      width: null,
      height: null,
      duration_ms: null,
      file_size: ingestion.size_bytes ?? null,
      metadata: {
        ...(catalogDraft.metadata ?? {}),
        originalFilename: ingestion.original_filename,
        validationReport: ingestion.validation_report ?? {},
        checksum: ingestion.checksum ?? null,
      },
      created_by: userId,
    });

    const sourceArtifact = await createCreativeArtifact(client, workspaceId, {
      creative_version_id: creativeVersion.id,
      kind: catalogDraft.artifactKind,
      storage_key: ingestion.storage_key ?? null,
      public_url: ingestion.public_url ?? null,
      mime_type: ingestion.mime_type ?? catalogDraft.mimeType,
      size_bytes: ingestion.size_bytes ?? null,
      checksum: ingestion.checksum ?? null,
      metadata: {
        originalFilename: ingestion.original_filename,
        ingestionId: ingestion.id,
        validationReport: ingestion.validation_report ?? {},
      },
    });

    const publishedArtifacts = [sourceArtifact];
    let publishedVersion = creativeVersion;

    if (ingestion.source_kind === 'html5_zip') {
      await onStage?.({
        stage: 'publishing_html5_archive',
        progressPercent: 45,
        message: 'Extracting and publishing HTML5 assets',
      });

      const htmlPublication = await expandAndPublishHtml5Archive({
        sourceStorageKey: ingestion.storage_key,
        workspaceId,
        creativeVersionId: creativeVersion.id,
      });
      const resolvedClickUrl = normalizeHttpUrl(htmlPublication.clickDestinationUrl ?? null) ?? fallbackClickUrl;
      if (!resolvedClickUrl) {
        throw new Error('HTML5 creatives require a click URL. Use a banner with an embedded clickTag or provide a fallback destination URL before publishing.');
      }

      for (const artifact of htmlPublication.artifacts) {
        publishedArtifacts.push(await createCreativeArtifact(client, workspaceId, {
          creative_version_id: creativeVersion.id,
          kind: artifact.kind,
          storage_key: artifact.storageKey,
          public_url: artifact.publicUrl,
          mime_type: artifact.mimeType,
          size_bytes: artifact.sizeBytes,
          checksum: artifact.checksum,
          metadata: artifact.metadata,
        }));
      }

      await onStage?.({
        stage: 'finalizing_publication',
        progressPercent: 85,
        message: 'Finalizing published creative version',
      });

      publishedVersion = await updateCreativeVersion(client, workspaceId, creativeVersion.id, {
        publicUrl: htmlPublication.entryPublicUrl,
        entryPath: htmlPublication.entryPath,
        mimeType: 'text/html; charset=utf-8',
        width: htmlPublication.width ?? creativeVersion.width ?? null,
        height: htmlPublication.height ?? creativeVersion.height ?? null,
        metadata: {
          ...(creativeVersion.metadata ?? {}),
          publishedFrom: 'external_ingestion',
          html5Published: true,
          filesPublished: htmlPublication.filesPublished,
          publishedBytes: htmlPublication.totalBytes,
          dimensionSource: htmlPublication.dimensionSource ?? null,
          hasInternalClickTag: htmlPublication.hasInternalClickTag,
          internalClickSignals: htmlPublication.internalClickSignals ?? [],
          clickDestinationUrl: resolvedClickUrl,
        },
      });
      await ensureCreativeVersionDefaultVariant(client, workspaceId, publishedVersion, {
        forceStatusSync: true,
      });

      creative = await updateCreative(client, workspaceId, creative.id, {
        file_url: htmlPublication.entryPublicUrl,
        mime_type: 'text/html; charset=utf-8',
        width: htmlPublication.width ?? null,
        height: htmlPublication.height ?? null,
        click_url: htmlPublication.clickDestinationUrl ?? creative.click_url ?? null,
        transcode_status: 'done',
        metadata: {
          ...(creative.metadata ?? {}),
          sourceKind: ingestion.source_kind,
          entryPath: htmlPublication.entryPath,
          publishedFrom: 'external_ingestion',
          filesPublished: htmlPublication.filesPublished,
          dimensionSource: htmlPublication.dimensionSource ?? null,
          hasInternalClickTag: htmlPublication.hasInternalClickTag,
          internalClickSignals: htmlPublication.internalClickSignals ?? [],
          clickDestinationUrl: resolvedClickUrl,
        },
      });
    } else if (ingestion.source_kind === 'video_mp4') {
      if (!fallbackClickUrl) {
        throw new Error('Video creatives require a destination URL before they can be published.');
      }
      await onStage?.({
        stage: 'transcoding_video',
        progressPercent: 45,
        message: 'Generating poster and video renditions',
      });

      const videoPublication = await enrichVideoPublication({
        workspaceId,
        creativeVersionId: creativeVersion.id,
        sourceStorageKey: ingestion.storage_key,
      });

      for (const artifact of videoPublication.posterArtifacts) {
        publishedArtifacts.push(await createCreativeArtifact(client, workspaceId, {
          creative_version_id: creativeVersion.id,
          kind: artifact.kind,
          storage_key: artifact.storageKey,
          public_url: artifact.publicUrl,
          mime_type: artifact.mimeType,
          size_bytes: artifact.sizeBytes,
          checksum: artifact.checksum,
          metadata: artifact.metadata,
        }));
      }

      const renditionArtifacts = [];
      for (const rendition of videoPublication.renditions ?? []) {
        const renditionArtifact = await createCreativeArtifact(client, workspaceId, {
          creative_version_id: creativeVersion.id,
          kind: rendition.artifact.kind,
          storage_key: rendition.artifact.storageKey,
          public_url: rendition.artifact.publicUrl,
          mime_type: rendition.artifact.mimeType,
          size_bytes: rendition.artifact.sizeBytes,
          checksum: rendition.artifact.checksum,
          metadata: rendition.artifact.metadata,
        });
        publishedArtifacts.push(renditionArtifact);
        renditionArtifacts.push({ rendition, artifact: renditionArtifact });
      }

      for (const entry of renditionArtifacts) {
        await createVideoRendition(client, workspaceId, {
          creative_version_id: creativeVersion.id,
          artifact_id: entry.artifact.id,
          label: entry.rendition.label,
          width: entry.rendition.width,
          height: entry.rendition.height,
          bitrate_kbps: entry.rendition.bitrateKbps,
          codec: entry.rendition.codec,
          mime_type: entry.rendition.mimeType,
          status: entry.rendition.status,
          is_source: entry.rendition.isSource,
          sort_order: entry.rendition.sortOrder,
          metadata: entry.rendition.artifact.metadata ?? {},
        });
      }

      const activeTranscodedRenditions = (videoPublication.renditions ?? []).filter((rendition) => !rendition.isSource);
      const preferredRendition = activeTranscodedRenditions[0] ?? (videoPublication.renditions ?? [])[0] ?? null;
      const posterArtifact = videoPublication.posterArtifacts[0] ?? null;

      await onStage?.({
        stage: 'finalizing_publication',
        progressPercent: 85,
        message: 'Saving rendition metadata and activating assets',
      });

      publishedVersion = await updateCreativeVersion(client, workspaceId, creativeVersion.id, {
        publicUrl: preferredRendition?.artifact.publicUrl ?? creativeVersion.public_url ?? ingestion.public_url ?? null,
        mimeType: preferredRendition?.mimeType ?? creativeVersion.mime_type ?? ingestion.mime_type ?? 'video/mp4',
        width: preferredRendition?.width ?? videoPublication.metadata?.width ?? creativeVersion.width ?? null,
        height: preferredRendition?.height ?? videoPublication.metadata?.height ?? creativeVersion.height ?? null,
        durationMs: videoPublication.metadata?.durationMs ?? creativeVersion.duration_ms ?? null,
        metadata: {
          ...(creativeVersion.metadata ?? {}),
          publishedFrom: 'external_ingestion',
          videoProcessing: videoPublication.processing,
          codec: videoPublication.metadata?.codec ?? null,
          bitRate: videoPublication.metadata?.bitRate ?? null,
          posterGenerated: videoPublication.posterArtifacts.length > 0,
          renditionsGenerated: activeTranscodedRenditions.length,
        },
      });
      await ensureCreativeVersionDefaultVariant(client, workspaceId, publishedVersion, {
        forceStatusSync: true,
      });

      creative = await updateCreative(client, workspaceId, creative.id, {
        file_url: preferredRendition?.artifact.publicUrl ?? ingestion.public_url ?? null,
        mime_type: preferredRendition?.mimeType ?? ingestion.mime_type ?? 'video/mp4',
        width: preferredRendition?.width ?? videoPublication.metadata?.width ?? null,
        height: preferredRendition?.height ?? videoPublication.metadata?.height ?? null,
        duration_ms: videoPublication.metadata?.durationMs ?? null,
        transcode_status: activeTranscodedRenditions.length > 0 ? 'done' : 'failed',
        metadata: {
          ...(creative.metadata ?? {}),
          sourceKind: ingestion.source_kind,
          publishedFrom: 'external_ingestion',
          videoProcessing: videoPublication.processing,
          posterUrl: posterArtifact?.publicUrl ?? null,
          codec: videoPublication.metadata?.codec ?? null,
          bitRate: videoPublication.metadata?.bitRate ?? null,
          renditionsGenerated: activeTranscodedRenditions.length,
        },
      });

      const persistedRenditions = await listVideoRenditions(client, workspaceId, creativeVersion.id);
      const versionHasVideoProcessing = Boolean(publishedVersion?.metadata?.videoProcessing);
      if (!versionHasVideoProcessing || persistedRenditions.length === 0) {
        const repaired = await syncVideoRenditionsForVersion(client, workspaceId, publishedVersion, creative);
        publishedVersion = repaired.updatedVersion ?? publishedVersion;
        creative = repaired.updatedCreative ?? creative;
        for (const artifact of repaired.posterArtifacts ?? []) {
          publishedArtifacts.push(artifact);
        }
        if ((repaired.persistedRenditions ?? []).some((rendition) => !publishedArtifacts.some((artifact) => artifact.id === rendition.artifact_id))) {
          const renditionArtifactsFromDb = await listCreativeArtifacts(client, workspaceId, creativeVersion.id);
          for (const artifact of renditionArtifactsFromDb) {
            if (!publishedArtifacts.some((publishedArtifact) => publishedArtifact.id === artifact.id)) {
              publishedArtifacts.push(artifact);
            }
          }
        }
      }
    }

    await client.query('COMMIT');

    const result = {
      creative,
      creativeVersion: publishedVersion,
      artifacts: publishedArtifacts,
    };

    try {
      const tagIds = await listTagIdsByCreativeVersion(pool, workspaceId, publishedVersion.id);
      for (const tagId of tagIds) {
        await enqueueStaticVastPublish(pool, {
          workspaceId,
          tagId,
          trigger: 'creative_ingestion_publish',
        });
      }
    } catch (error) {
      // Keep catalog publication authoritative; static delivery refresh is best-effort.
      console.warn('[vast-delivery] failed to republish static VAST artifacts after ingestion publish', {
        workspaceId,
        creativeVersionId: publishedVersion.id,
        error: error?.message ?? String(error),
      });
    }

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
