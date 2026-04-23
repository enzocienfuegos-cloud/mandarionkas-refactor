import crypto from 'node:crypto';
import {
  createCreative,
  createCreativeArtifact,
  createCreativeVersion,
  submitCreativeVersionForReview,
  updateCreative,
  updateCreativeVersion,
} from '@smx/db';
import { hasUploadStorageConfig, putObjectBuffer, sanitizeStorageFilename } from '../storage/object-storage.mjs';

const MAX_STUDIO_PUBLICATION_BYTES = parseInt(process.env.MAX_CREATIVE_PUBLICATION_BYTES, 10) || 25 * 1024 * 1024;

function sanitizeBundlePath(filePath) {
  return String(filePath ?? '')
    .split('/')
    .map((segment) => sanitizeStorageFilename(segment, 'asset.bin'))
    .join('/');
}

function decodeBundleFile(file) {
  if (!file || typeof file !== 'object') {
    throw new Error('Bundle file must be an object');
  }
  const path = String(file.path ?? '').trim();
  if (!path) throw new Error('Bundle file path is required');
  const mimeType = String(file.mime ?? 'application/octet-stream').trim();
  const encoding = String(file.encoding ?? 'text').trim().toLowerCase();

  if (encoding === 'text') {
    return {
      path,
      mimeType,
      buffer: Buffer.from(String(file.content ?? ''), 'utf8'),
      metadata: { encoding: 'text' },
    };
  }

  if (encoding === 'base64') {
    return {
      path,
      mimeType,
      buffer: Buffer.from(String(file.content ?? ''), 'base64'),
      metadata: { encoding: 'base64' },
    };
  }

  throw new Error(`Unsupported bundle file encoding for ${path}`);
}

function normalizePayload(body = {}) {
  const name = String(body.name ?? '').trim();
  const projectId = body.projectId ? String(body.projectId).trim() : null;
  const projectName = body.projectName ? String(body.projectName).trim() : null;
  const channel = String(body.channel ?? body.bundle?.channel ?? 'generic-html5').trim();
  const autoSubmitForReview = body.autoSubmitForReview !== false;
  const files = Array.isArray(body.bundle?.files) ? body.bundle.files : [];
  const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};

  return {
    name,
    projectId,
    projectName,
    channel,
    autoSubmitForReview,
    files,
    metadata,
  };
}

export function handleStudioPublicationRoutes(app, { requireWorkspace, pool }, deps = {
  createCreative,
  createCreativeArtifact,
  createCreativeVersion,
  submitCreativeVersionForReview,
  updateCreative,
  updateCreativeVersion,
}) {
  app.post('/v1/creative-publications/from-studio', {
    preHandler: requireWorkspace,
    bodyLimit: MAX_STUDIO_PUBLICATION_BYTES,
  }, async (req, reply) => {
    if (!hasUploadStorageConfig()) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Creative publication storage is not configured on this environment',
      });
    }

    const payload = normalizePayload(req.body);
    if (!payload.name) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name is required' });
    }
    if (!payload.files.length) {
      return reply.status(400).send({ error: 'Bad Request', message: 'bundle.files must contain at least one file' });
    }

    let decodedFiles;
    try {
      decodedFiles = payload.files.map((file) => decodeBundleFile(file));
    } catch (error) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: error instanceof Error ? error.message : 'Invalid bundle payload',
      });
    }

    const entryFile = decodedFiles.find((file) => file.path === 'index.html');
    if (!entryFile) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Studio publication bundle must contain index.html',
      });
    }

    const totalBytes = decodedFiles.reduce((sum, file) => sum + file.buffer.length, 0);
    const dimensions = payload.metadata?.canvas && typeof payload.metadata.canvas === 'object'
      ? payload.metadata.canvas
      : {};

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let creative = await deps.createCreative(client, req.authSession.workspaceId, {
        name: payload.name,
        type: 'html',
        file_url: null,
        file_size: totalBytes,
        mime_type: 'text/html; charset=utf-8',
        width: typeof dimensions.width === 'number' ? dimensions.width : null,
        height: typeof dimensions.height === 'number' ? dimensions.height : null,
        metadata: {
          sourceKind: 'studio_export',
          publishedFrom: 'studio',
          projectId: payload.projectId,
          projectName: payload.projectName,
          channel: payload.channel,
          ...payload.metadata,
        },
        approval_status: payload.autoSubmitForReview ? 'pending_review' : 'draft',
        transcode_status: 'done',
      }, { ensureLegacyVersion: false });

      let creativeVersion = await deps.createCreativeVersion(client, req.authSession.workspaceId, {
        creativeId: creative.id,
        source_kind: 'studio_export',
        serving_format: 'display_html',
        status: 'draft',
        public_url: null,
        entry_path: 'index.html',
        mime_type: 'text/html; charset=utf-8',
        width: typeof dimensions.width === 'number' ? dimensions.width : null,
        height: typeof dimensions.height === 'number' ? dimensions.height : null,
        file_size: totalBytes,
        metadata: {
          sourceKind: 'studio_export',
          publishedFrom: 'studio',
          projectId: payload.projectId,
          projectName: payload.projectName,
          channel: payload.channel,
          fileCount: decodedFiles.length,
          ...payload.metadata,
        },
        created_by: req.authSession.userId,
      });

      const publishedArtifacts = [];
      let entryPublicUrl = null;
      for (const file of decodedFiles) {
        const safePath = sanitizeBundlePath(file.path);
        const storageKey = `${req.authSession.workspaceId}/creative-published/${creativeVersion.id}/${safePath}`;
        const stored = await putObjectBuffer({
          storageKey,
          buffer: file.buffer,
          contentType: file.mimeType,
        });
        const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');
        if (file.path === 'index.html') {
          entryPublicUrl = stored?.publicUrl ?? null;
        }
        publishedArtifacts.push(await deps.createCreativeArtifact(client, req.authSession.workspaceId, {
          creative_version_id: creativeVersion.id,
          kind: file.path === 'index.html' ? 'published_html' : 'published_asset',
          storage_key: storageKey,
          public_url: stored?.publicUrl ?? null,
          mime_type: file.mimeType,
          size_bytes: file.buffer.length,
          checksum,
          metadata: {
            sourcePath: file.path,
            ...file.metadata,
          },
        }));
      }

      creativeVersion = await deps.updateCreativeVersion(client, req.authSession.workspaceId, creativeVersion.id, {
        publicUrl: entryPublicUrl,
        entryPath: 'index.html',
        metadata: {
          ...(creativeVersion.metadata ?? {}),
          publicEntryUrl: entryPublicUrl,
          totalBytes,
        },
      });

      creative = await deps.updateCreative(client, req.authSession.workspaceId, creative.id, {
        file_url: entryPublicUrl,
        file_size: totalBytes,
        mime_type: 'text/html; charset=utf-8',
        metadata: {
          ...(creative.metadata ?? {}),
          publicEntryUrl: entryPublicUrl,
          totalBytes,
        },
      });

      if (payload.autoSubmitForReview) {
        creativeVersion = await deps.submitCreativeVersionForReview(client, req.authSession.workspaceId, creativeVersion.id);
      }

      await client.query('COMMIT');

      return reply.status(201).send({
        creative,
        creativeVersion,
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
