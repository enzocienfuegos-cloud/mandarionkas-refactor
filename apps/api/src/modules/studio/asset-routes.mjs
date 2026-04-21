import crypto from 'node:crypto';
import {
  createStudioAssetFolder,
  deleteStudioAsset,
  deleteStudioAssetFolder,
  getStudioAsset,
  listStudioAssetFolders,
  listStudioAssets,
  mapStudioAssetFolderRowToDto,
  mapStudioAssetRowToDto,
  patchStudioAsset,
  renameStudioAssetFolder,
  saveStudioAsset,
} from '@smx/db';
import { hasStudioPermission } from './shared.mjs';

async function createSignedUpload({ key, contentType }) {
  const endpoint = process.env.R2_ENDPOINT ?? process.env.S3_ENDPOINT;
  const bucket = process.env.R2_BUCKET ?? process.env.S3_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;

  const [{ S3Client, PutObjectCommand }, { getSignedUrl }] = await Promise.all([
    import('@aws-sdk/client-s3'),
    import('@aws-sdk/s3-request-presigner'),
  ]);

  const client = new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: false,
    credentials: { accessKeyId, secretAccessKey },
  });

  return getSignedUrl(client, new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType ?? 'application/octet-stream',
  }), { expiresIn: 900 });
}

function buildPublicAssetUrl(storageKey) {
  const base = (process.env.ASSETS_PUBLIC_BASE_URL ?? process.env.S3_CDN_URL ?? '').replace(/\/$/, '');
  return base ? `${base}/${storageKey}` : undefined;
}

export function handleStudioAssetRoutes(app, { requireWorkspace, pool }, deps = {
  createStudioAssetFolder,
  deleteStudioAsset,
  deleteStudioAssetFolder,
  getStudioAsset,
  listStudioAssetFolders,
  listStudioAssets,
  mapStudioAssetFolderRowToDto,
  mapStudioAssetRowToDto,
  patchStudioAsset,
  renameStudioAssetFolder,
  saveStudioAsset,
}) {
  app.get('/v1/assets', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'assets:view-client')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const rows = await deps.listStudioAssets(pool, req.authSession.workspaceId);
    return reply.send({ assets: rows.map(deps.mapStudioAssetRowToDto) });
  });

  app.post('/v1/assets', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'assets:create')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const row = await deps.saveStudioAsset(pool, {
      workspaceId: req.authSession.workspaceId,
      ownerUserId: req.authSession.userId,
      asset: req.body?.asset ?? {},
    });
    return reply.send({ asset: deps.mapStudioAssetRowToDto(row) });
  });

  app.post('/v1/assets/upload-url', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'assets:create')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const filename = String(req.body?.filename ?? 'upload.bin');
    const assetId = crypto.randomUUID();
    const storageKey = `${req.authSession.workspaceId}/${assetId}/${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const uploadUrl = await createSignedUpload({ key: storageKey, contentType: req.body?.mimeType });
    const publicUrl = buildPublicAssetUrl(storageKey);

    return reply.send({
      upload: {
        assetId,
        name: req.body?.requestedName ?? filename,
        kind: req.body?.kind ?? 'other',
        mimeType: req.body?.mimeType,
        sizeBytes: req.body?.sizeBytes,
        accessScope: req.body?.accessScope ?? 'client',
        tags: Array.isArray(req.body?.tags) ? req.body.tags : [],
        folderId: req.body?.folderId,
        fontFamily: req.body?.fontFamily,
        storageKey,
        uploadUrl,
        publicUrl,
        optimizedUrl: publicUrl,
      },
    });
  });

  app.post('/v1/assets/complete-upload', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'assets:create')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const body = req.body ?? {};
    const row = await deps.saveStudioAsset(pool, {
      workspaceId: req.authSession.workspaceId,
      ownerUserId: req.authSession.userId,
      assetId: body.assetId,
      asset: {
        name: body.name,
        kind: body.kind,
        src: body.publicUrl ?? body.optimizedUrl,
        mimeType: body.mimeType,
        sourceType: body.sourceType,
        storageMode: body.storageMode,
        storageKey: body.storageKey,
        publicUrl: body.publicUrl,
        optimizedUrl: body.optimizedUrl,
        qualityPreference: body.qualityPreference,
        derivatives: body.derivatives,
        fingerprint: body.fingerprint,
        sizeBytes: body.sizeBytes,
        width: body.width,
        height: body.height,
        durationMs: body.durationMs,
        fontFamily: body.fontFamily,
        tags: body.tags,
        folderId: body.folderId,
        accessScope: body.accessScope,
        processingStatus: 'completed',
      },
    });
    return reply.send({ asset: deps.mapStudioAssetRowToDto(row) });
  });

  app.get('/v1/assets/:assetId', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'assets:view-client')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const row = await deps.getStudioAsset(pool, req.authSession.workspaceId, req.params.assetId);
    return reply.send({ asset: row ? deps.mapStudioAssetRowToDto(row) : undefined });
  });

  app.delete('/v1/assets/:assetId', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'assets:delete')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    await deps.deleteStudioAsset(pool, req.authSession.workspaceId, req.params.assetId);
    return reply.status(204).send();
  });

  app.post('/v1/assets/:assetId/rename', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'assets:update')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const row = await deps.patchStudioAsset(pool, req.authSession.workspaceId, req.params.assetId, { name: req.body?.name });
    return reply.send({ asset: row ? deps.mapStudioAssetRowToDto(row) : undefined });
  });

  app.post('/v1/assets/:assetId/move', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'assets:update')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const row = await deps.patchStudioAsset(pool, req.authSession.workspaceId, req.params.assetId, { folderId: req.body?.folderId });
    return reply.send({ asset: row ? deps.mapStudioAssetRowToDto(row) : undefined });
  });

  app.post('/v1/assets/:assetId/quality', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'assets:update')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const row = await deps.patchStudioAsset(pool, req.authSession.workspaceId, req.params.assetId, { qualityPreference: req.body?.qualityPreference });
    return reply.send({ asset: row ? deps.mapStudioAssetRowToDto(row) : undefined });
  });

  app.post('/v1/assets/:assetId/reprocess', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'assets:update')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const row = await deps.patchStudioAsset(pool, req.authSession.workspaceId, req.params.assetId, {
      processingStatus: 'completed',
      processingMessage: null,
    });
    return reply.send({ asset: row ? deps.mapStudioAssetRowToDto(row) : undefined });
  });

  app.get('/v1/assets/folders', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'assets:view-client')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const rows = await deps.listStudioAssetFolders(pool, req.authSession.workspaceId);
    return reply.send({ folders: rows.map(deps.mapStudioAssetFolderRowToDto) });
  });

  app.post('/v1/assets/folders', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'assets:create')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const row = await deps.createStudioAssetFolder(pool, {
      workspaceId: req.authSession.workspaceId,
      ownerUserId: req.authSession.userId,
      name: req.body?.name ?? 'Untitled folder',
      parentId: req.body?.parentId,
    });
    return reply.send({ folder: deps.mapStudioAssetFolderRowToDto(row) });
  });

  app.post('/v1/assets/folders/:folderId/rename', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'assets:update')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const row = await deps.renameStudioAssetFolder(pool, req.authSession.workspaceId, req.params.folderId, req.body?.name ?? 'Untitled folder');
    return reply.send({ folder: row ? deps.mapStudioAssetFolderRowToDto(row) : undefined });
  });

  app.delete('/v1/assets/folders/:folderId', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'assets:delete')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    await deps.deleteStudioAssetFolder(pool, req.authSession.workspaceId, req.params.folderId);
    return reply.status(204).send();
  });
}
