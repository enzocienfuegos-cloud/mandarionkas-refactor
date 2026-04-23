import crypto from 'node:crypto';
import {
  createCreative,
  createCreativeArtifact,
  createCreativeIngestion,
  createCreativeVersion,
  ensureCreativeVersionDefaultVariant,
  getCreative,
  getCreativeIngestion,
  getCreativeVersion,
  listCreativeArtifacts,
  listCreativeIngestions,
  updateCreative,
  updateCreativeIngestion,
  updateCreativeVersion,
} from '@smx/db';
import { buildPublicAssetUrl, hasUploadStorageConfig, prepareObjectUpload, sanitizeStorageFilename } from '../storage/object-storage.mjs';
import { expandAndPublishHtml5Archive } from './html5-publisher.mjs';
import { enrichVideoPublication } from './video-processor.mjs';

const SOURCE_KINDS = new Set(['html5_zip', 'video_mp4']);

function validateIngestionPayload({ sourceKind, originalFilename, mimeType }) {
  const extension = String(originalFilename ?? '').toLowerCase();
  const normalizedMime = String(mimeType ?? '').toLowerCase();

  if (sourceKind === 'html5_zip') {
    const valid =
      extension.endsWith('.zip')
      && (
        !normalizedMime
        || normalizedMime === 'application/zip'
        || normalizedMime === 'application/x-zip-compressed'
        || normalizedMime === 'multipart/x-zip'
      );
    return {
      ok: valid,
      report: {
        sourceKind,
        expectedExtension: '.zip',
        detectedFilename: originalFilename,
        detectedMimeType: mimeType ?? null,
      },
      errorCode: valid ? null : 'invalid_html5_zip',
      errorDetail: valid ? null : 'HTML5 uploads must be provided as a .zip archive.',
    };
  }

  if (sourceKind === 'video_mp4') {
    const valid = extension.endsWith('.mp4') && (!normalizedMime || normalizedMime === 'video/mp4');
    return {
      ok: valid,
      report: {
        sourceKind,
        expectedExtension: '.mp4',
        detectedFilename: originalFilename,
        detectedMimeType: mimeType ?? null,
      },
      errorCode: valid ? null : 'invalid_video_mp4',
      errorDetail: valid ? null : 'Video uploads must be provided as an .mp4 file.',
    };
  }

  return {
    ok: false,
    report: { sourceKind },
    errorCode: 'unsupported_source_kind',
    errorDetail: 'Unsupported ingestion source kind.',
  };
}

function toApiIngestion(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    createdBy: row.created_by ?? null,
    creativeId: row.creative_id ?? null,
    creativeVersionId: row.creative_version_id ?? null,
    sourceKind: row.source_kind,
    status: row.status,
    originalFilename: row.original_filename,
    mimeType: row.mime_type ?? undefined,
    sizeBytes: row.size_bytes ?? undefined,
    storageKey: row.storage_key ?? undefined,
    publicUrl: row.public_url ?? undefined,
    checksum: row.checksum ?? undefined,
    metadata: row.metadata ?? {},
    validationReport: row.validation_report ?? {},
    errorCode: row.error_code ?? undefined,
    errorDetail: row.error_detail ?? undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString(),
  };
}

function deriveCreativeName(row, requestedName) {
  if (requestedName && String(requestedName).trim()) {
    return String(requestedName).trim();
  }
  if (row.metadata?.requestedName && String(row.metadata.requestedName).trim()) {
    return String(row.metadata.requestedName).trim();
  }
  const filename = String(row.original_filename ?? 'Untitled creative');
  return filename.replace(/\.[^.]+$/, '') || 'Untitled creative';
}

function getCatalogDraftForIngestion(row) {
  if (row.source_kind === 'video_mp4') {
    return {
      creativeType: 'video',
      servingFormat: 'vast_video',
      artifactKind: 'video_mp4',
      publicUrl: row.public_url ?? null,
      entryPath: null,
      mimeType: row.mime_type ?? 'video/mp4',
      transcodeStatus: 'done',
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

function shouldRequireManualReview(body = {}) {
  return body?.requireReview === true;
}

export function handleCreativeIngestionRoutes(app, { requireWorkspace, pool }, deps = {
  createCreative,
  createCreativeArtifact,
  createCreativeIngestion,
  createCreativeVersion,
  ensureCreativeVersionDefaultVariant,
  getCreative,
  getCreativeIngestion,
  getCreativeVersion,
  listCreativeArtifacts,
  listCreativeIngestions,
  updateCreative,
  updateCreativeIngestion,
  updateCreativeVersion,
}) {
  app.get('/v1/creative-ingestions', { preHandler: requireWorkspace }, async (req, reply) => {
    const rows = await deps.listCreativeIngestions(pool, req.authSession.workspaceId, {
      status: req.query?.status,
      sourceKind: req.query?.sourceKind,
    });
    return reply.send({ ingestions: rows.map(toApiIngestion) });
  });

  app.post('/v1/creative-ingestions/upload-url', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasUploadStorageConfig()) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Creative ingestions are not configured on this environment',
      });
    }

    const sourceKind = String(req.body?.sourceKind ?? '').trim();
    if (!SOURCE_KINDS.has(sourceKind)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'sourceKind must be html5_zip or video_mp4' });
    }

    const originalFilename = String(req.body?.filename ?? 'upload.bin').trim();
    const mimeType = req.body?.mimeType ?? null;
    const sizeBytes = req.body?.sizeBytes ?? null;
    const ingestionId = crypto.randomUUID();
    const storageKey = `${req.authSession.workspaceId}/creative-ingestions/${ingestionId}/${sanitizeStorageFilename(originalFilename)}`;
    const upload = await prepareObjectUpload({ storageKey, contentType: mimeType });

    const row = await deps.createCreativeIngestion(pool, {
      workspaceId: req.authSession.workspaceId,
      createdBy: req.authSession.userId,
      sourceKind,
      originalFilename,
      mimeType,
      sizeBytes,
      storageKey,
      publicUrl: upload.publicUrl ?? buildPublicAssetUrl(storageKey) ?? null,
      metadata: {
        requestedName: req.body?.name ?? null,
      },
    });

    return reply.send({
      ingestion: toApiIngestion(row),
      upload: {
        ingestionId: row.id,
        storageKey,
        uploadUrl: upload.uploadUrl,
        publicUrl: upload.publicUrl,
      },
    });
  });

  app.post('/v1/creative-ingestions/:ingestionId/complete', { preHandler: requireWorkspace }, async (req, reply) => {
    const row = await deps.getCreativeIngestion(pool, req.authSession.workspaceId, req.params.ingestionId);
    if (!row) {
      return reply.status(404).send({ error: 'Not Found', message: 'Ingestion not found' });
    }

    const validation = validateIngestionPayload({
      sourceKind: row.source_kind,
      originalFilename: req.body?.filename ?? row.original_filename,
      mimeType: req.body?.mimeType ?? row.mime_type,
    });

    const next = await deps.updateCreativeIngestion(pool, req.authSession.workspaceId, row.id, {
      status: validation.ok ? 'validated' : 'failed',
      mimeType: req.body?.mimeType ?? row.mime_type,
      sizeBytes: req.body?.sizeBytes ?? row.size_bytes,
      checksum: req.body?.checksum ?? row.checksum,
      metadata: {
        ...(row.metadata ?? {}),
        originalUploadCompleted: true,
        requestedName: req.body?.name ?? row.metadata?.requestedName ?? null,
      },
      validationReport: validation.report,
      errorCode: validation.errorCode,
      errorDetail: validation.errorDetail,
      publicUrl: req.body?.publicUrl ?? row.public_url,
      storageKey: req.body?.storageKey ?? row.storage_key,
    });

    return reply.send({ ingestion: toApiIngestion(next) });
  });

  app.get('/v1/creative-ingestions/:ingestionId', { preHandler: requireWorkspace }, async (req, reply) => {
    const row = await deps.getCreativeIngestion(pool, req.authSession.workspaceId, req.params.ingestionId);
    if (!row) {
      return reply.status(404).send({ error: 'Not Found', message: 'Ingestion not found' });
    }
    return reply.send({ ingestion: toApiIngestion(row) });
  });

  app.post('/v1/creative-ingestions/:ingestionId/publish', { preHandler: requireWorkspace }, async (req, reply) => {
    const row = await deps.getCreativeIngestion(pool, req.authSession.workspaceId, req.params.ingestionId);
    if (!row) {
      return reply.status(404).send({ error: 'Not Found', message: 'Ingestion not found' });
    }

    if (row.status !== 'validated' && row.status !== 'published') {
      return reply.status(409).send({
        error: 'Conflict',
        message: 'Only validated ingestions can be published to the creative catalog',
      });
    }

    if (row.status === 'published' && row.creative_id && row.creative_version_id) {
      const creative = await deps.getCreative(pool, req.authSession.workspaceId, row.creative_id);
      const version = await deps.getCreativeVersion(pool, req.authSession.workspaceId, row.creative_version_id);
      const artifacts = version
        ? await deps.listCreativeArtifacts(pool, req.authSession.workspaceId, version.id)
        : [];
      return reply.send({
        ingestion: toApiIngestion(row),
        creative,
        creativeVersion: version,
        artifacts,
      });
    }

    const creativeName = deriveCreativeName(row, req.body?.name);
    const catalogDraft = getCatalogDraftForIngestion(row);
    const requireManualReview = shouldRequireManualReview(req.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let creative = await deps.createCreative(client, req.authSession.workspaceId, {
        name: creativeName,
        type: catalogDraft.creativeType,
        file_url: row.source_kind === 'video_mp4' ? row.public_url ?? null : null,
        file_size: row.size_bytes ?? null,
        mime_type: catalogDraft.mimeType,
        duration_ms: req.body?.durationMs ?? null,
        width: req.body?.width ?? null,
        height: req.body?.height ?? null,
        metadata: {
          ingestionId: row.id,
          sourceKind: row.source_kind,
          originalFilename: row.original_filename,
          validationReport: row.validation_report ?? {},
          ...(row.metadata ?? {}),
          ...(req.body?.metadata ?? {}),
        },
        approval_status: requireManualReview ? 'pending_review' : 'approved',
        transcode_status: catalogDraft.transcodeStatus,
      }, { ensureLegacyVersion: false });

      const creativeVersion = await deps.createCreativeVersion(client, req.authSession.workspaceId, {
        creativeId: creative.id,
        source_kind: row.source_kind,
        serving_format: catalogDraft.servingFormat,
        status: requireManualReview ? 'pending_review' : 'approved',
        public_url: catalogDraft.publicUrl,
        entry_path: catalogDraft.entryPath,
        mime_type: catalogDraft.mimeType,
        width: req.body?.width ?? null,
        height: req.body?.height ?? null,
        duration_ms: req.body?.durationMs ?? null,
        file_size: row.size_bytes ?? null,
        metadata: {
          ...(catalogDraft.metadata ?? {}),
          originalFilename: row.original_filename,
          validationReport: row.validation_report ?? {},
          checksum: row.checksum ?? null,
        },
        created_by: req.authSession.userId,
      });

      const sourceArtifact = await deps.createCreativeArtifact(client, req.authSession.workspaceId, {
        creative_version_id: creativeVersion.id,
        kind: catalogDraft.artifactKind,
        storage_key: row.storage_key ?? null,
        public_url: row.public_url ?? null,
        mime_type: row.mime_type ?? catalogDraft.mimeType,
        size_bytes: row.size_bytes ?? null,
        checksum: row.checksum ?? null,
        metadata: {
          originalFilename: row.original_filename,
          ingestionId: row.id,
          validationReport: row.validation_report ?? {},
        },
      });

      const publishedArtifacts = [sourceArtifact];
      let publishedVersion = creativeVersion;
      if (row.source_kind === 'html5_zip') {
        const htmlPublication = await expandAndPublishHtml5Archive({
          sourceStorageKey: row.storage_key,
          workspaceId: req.authSession.workspaceId,
          creativeVersionId: creativeVersion.id,
        });

        for (const artifact of htmlPublication.artifacts) {
          publishedArtifacts.push(await deps.createCreativeArtifact(client, req.authSession.workspaceId, {
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

        publishedVersion = await deps.updateCreativeVersion(client, req.authSession.workspaceId, creativeVersion.id, {
          publicUrl: htmlPublication.entryPublicUrl,
          entryPath: htmlPublication.entryPath,
          mimeType: 'text/html; charset=utf-8',
          width: htmlPublication.width ?? creativeVersion.width ?? req.body?.width ?? null,
          height: htmlPublication.height ?? creativeVersion.height ?? req.body?.height ?? null,
          metadata: {
            ...(creativeVersion.metadata ?? {}),
            publishedFrom: 'external_ingestion',
            html5Published: true,
            filesPublished: htmlPublication.filesPublished,
            publishedBytes: htmlPublication.totalBytes,
            dimensionSource: htmlPublication.dimensionSource ?? null,
            hasInternalClickTag: htmlPublication.hasInternalClickTag,
            internalClickSignals: htmlPublication.internalClickSignals ?? [],
            clickDestinationUrl: htmlPublication.clickDestinationUrl ?? null,
          },
        });
        await deps.ensureCreativeVersionDefaultVariant(client, req.authSession.workspaceId, publishedVersion, {
          forceStatusSync: true,
        });

        creative = await deps.updateCreative(client, req.authSession.workspaceId, creative.id, {
          file_url: htmlPublication.entryPublicUrl,
          mime_type: 'text/html; charset=utf-8',
          width: htmlPublication.width ?? req.body?.width ?? null,
          height: htmlPublication.height ?? req.body?.height ?? null,
          click_url: htmlPublication.clickDestinationUrl ?? creative.click_url ?? null,
          transcode_status: 'done',
          metadata: {
            ...(creative.metadata ?? {}),
            sourceKind: row.source_kind,
            entryPath: htmlPublication.entryPath,
            publishedFrom: 'external_ingestion',
            filesPublished: htmlPublication.filesPublished,
            dimensionSource: htmlPublication.dimensionSource ?? null,
            hasInternalClickTag: htmlPublication.hasInternalClickTag,
            internalClickSignals: htmlPublication.internalClickSignals ?? [],
            clickDestinationUrl: htmlPublication.clickDestinationUrl ?? null,
          },
        });
      } else if (row.source_kind === 'video_mp4') {
        const videoPublication = await enrichVideoPublication({
          workspaceId: req.authSession.workspaceId,
          creativeVersionId: creativeVersion.id,
          sourceStorageKey: row.storage_key,
        });

        for (const artifact of videoPublication.posterArtifacts) {
          publishedArtifacts.push(await deps.createCreativeArtifact(client, req.authSession.workspaceId, {
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

        publishedVersion = await deps.updateCreativeVersion(client, req.authSession.workspaceId, creativeVersion.id, {
          width: videoPublication.metadata?.width ?? creativeVersion.width ?? req.body?.width ?? null,
          height: videoPublication.metadata?.height ?? creativeVersion.height ?? req.body?.height ?? null,
          durationMs: videoPublication.metadata?.durationMs ?? creativeVersion.duration_ms ?? req.body?.durationMs ?? null,
          metadata: {
            ...(creativeVersion.metadata ?? {}),
            publishedFrom: 'external_ingestion',
            videoProcessing: videoPublication.processing,
            codec: videoPublication.metadata?.codec ?? null,
            bitRate: videoPublication.metadata?.bitRate ?? null,
            posterGenerated: videoPublication.posterArtifacts.length > 0,
          },
        });
        await deps.ensureCreativeVersionDefaultVariant(client, req.authSession.workspaceId, publishedVersion, {
          forceStatusSync: true,
        });

        const posterArtifact = videoPublication.posterArtifacts[0] ?? null;
        creative = await deps.updateCreative(client, req.authSession.workspaceId, creative.id, {
          width: videoPublication.metadata?.width ?? req.body?.width ?? null,
          height: videoPublication.metadata?.height ?? req.body?.height ?? null,
          duration_ms: videoPublication.metadata?.durationMs ?? req.body?.durationMs ?? null,
          metadata: {
            ...(creative.metadata ?? {}),
            sourceKind: row.source_kind,
            publishedFrom: 'external_ingestion',
            videoProcessing: videoPublication.processing,
            posterUrl: posterArtifact?.publicUrl ?? null,
            codec: videoPublication.metadata?.codec ?? null,
            bitRate: videoPublication.metadata?.bitRate ?? null,
          },
        });
      }

      const updatedIngestion = await deps.updateCreativeIngestion(client, req.authSession.workspaceId, row.id, {
        creativeId: creative.id,
        creativeVersionId: creativeVersion.id,
        status: 'published',
        metadata: {
          ...(row.metadata ?? {}),
          catalogPublished: true,
          creativeId: creative.id,
          creativeVersionId: creativeVersion.id,
          html5Published: row.source_kind === 'html5_zip',
        },
      });

      await client.query('COMMIT');

      return reply.status(201).send({
        ingestion: toApiIngestion(updatedIngestion),
        creative,
        creativeVersion: publishedVersion,
        artifacts: publishedArtifacts,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
}
