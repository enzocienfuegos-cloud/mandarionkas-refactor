import crypto from 'node:crypto';
import {
  createCreativeIngestion,
  getCreativeIngestion,
  listCreativeIngestions,
  updateCreativeIngestion,
} from '@smx/db';
import { buildPublicAssetUrl, hasUploadStorageConfig, prepareObjectUpload, sanitizeStorageFilename } from '../storage/object-storage.mjs';

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

export function handleCreativeIngestionRoutes(app, { requireWorkspace, pool }, deps = {
  createCreativeIngestion,
  getCreativeIngestion,
  listCreativeIngestions,
  updateCreativeIngestion,
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
}
