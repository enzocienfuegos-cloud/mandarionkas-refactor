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

function safeLog(req, level, payload, message) {
  req.log?.[level]?.(payload, message);
}

function hasUploadStorageConfig() {
  return Boolean(
    (process.env.R2_ENDPOINT ?? process.env.S3_ENDPOINT)
    && (process.env.R2_BUCKET ?? process.env.S3_BUCKET)
    && (process.env.R2_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID)
    && (process.env.R2_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY),
  );
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
    req._auditMeta = {
      action: 'studio.asset.created',
      resource_type: 'studio_asset',
      resource_id: row.id,
      metadata: { name: row.name, kind: row.kind, accessScope: row.access_scope },
    };
    return reply.send({ asset: deps.mapStudioAssetRowToDto(row) });
  });

  app.post('/v1/assets/upload-url', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'assets:create')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    if (!hasUploadStorageConfig()) {
      safeLog(req, 'error', {
        requestId: req.id,
        route: '/v1/assets/upload-url',
        userId: req.authSession.userId,
        workspaceId: req.authSession.workspaceId,
      }, 'asset upload requested without object storage configuration');
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Asset uploads are not configured on this environment',
      });
    }
    const filename = String(req.body?.filename ?? 'upload.bin');
    const assetId = crypto.randomUUID();
    const storageKey = `${req.authSession.workspaceId}/${assetId}/${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const uploadUrl = await createSignedUpload({ key: storageKey, contentType: req.body?.mimeType });
    const publicUrl = buildPublicAssetUrl(storageKey);

    safeLog(req, 'info', {
      requestId: req.id,
      route: '/v1/assets/upload-url',
      userId: req.authSession.userId,
      workspaceId: req.authSession.workspaceId,
      assetId,
      storageKey,
      mimeType: req.body?.mimeType ?? null,
      sizeBytes: req.body?.sizeBytes ?? null,
    }, 'asset upload prepared');

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
    req._auditMeta = {
      action: 'studio.asset.created',
      resource_type: 'studio_asset',
      resource_id: row.id,
      metadata: { name: row.name, kind: row.kind, storageKey: row.storage_key ?? null },
    };
    safeLog(req, 'info', {
      requestId: req.id,
      route: '/v1/assets/complete-upload',
      userId: req.authSession.userId,
      workspaceId: req.authSession.workspaceId,
      assetId: row.id,
      storageKey: row.storage_key ?? null,
      kind: row.kind,
    }, 'asset upload completed');
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
    req._auditMeta = {
      action: 'studio.asset.deleted',
      resource_type: 'studio_asset',
      resource_id: req.params.assetId,
    };
    return reply.status(204).send();
  });

  app.post('/v1/assets/:assetId/rename', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'assets:update')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const row = await deps.patchStudioAsset(pool, req.authSession.workspaceId, req.params.assetId, { name: req.body?.name });
    req._auditMeta = {
      action: 'studio.asset.updated',
      resource_type: 'studio_asset',
      resource_id: req.params.assetId,
      metadata: { field: 'name', value: req.body?.name ?? null },
    };
    return reply.send({ asset: row ? deps.mapStudioAssetRowToDto(row) : undefined });
  });

  app.post('/v1/assets/:assetId/move', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'assets:update')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const row = await deps.patchStudioAsset(pool, req.authSession.workspaceId, req.params.assetId, { folderId: req.body?.folderId });
    req._auditMeta = {
      action: 'studio.asset.updated',
      resource_type: 'studio_asset',
      resource_id: req.params.assetId,
      metadata: { field: 'folderId', value: req.body?.folderId ?? null },
    };
    return reply.send({ asset: row ? deps.mapStudioAssetRowToDto(row) : undefined });
  });

  app.post('/v1/assets/:assetId/quality', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'assets:update')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const row = await deps.patchStudioAsset(pool, req.authSession.workspaceId, req.params.assetId, { qualityPreference: req.body?.qualityPreference });
    req._auditMeta = {
      action: 'studio.asset.updated',
      resource_type: 'studio_asset',
      resource_id: req.params.assetId,
      metadata: { field: 'qualityPreference', value: req.body?.qualityPreference ?? null },
    };
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
    req._auditMeta = {
      action: 'studio.asset.updated',
      resource_type: 'studio_asset',
      resource_id: req.params.assetId,
      metadata: { field: 'reprocess', value: 'completed' },
    };
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
    req._auditMeta = {
      action: 'studio.asset.folder_created',
      resource_type: 'studio_asset_folder',
      resource_id: row.id,
      metadata: { name: row.name, parentId: row.parent_id ?? null },
    };
    return reply.send({ folder: deps.mapStudioAssetFolderRowToDto(row) });
  });

  app.post('/v1/assets/folders/:folderId/rename', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'assets:update')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    const row = await deps.renameStudioAssetFolder(pool, req.authSession.workspaceId, req.params.folderId, req.body?.name ?? 'Untitled folder');
    req._auditMeta = {
      action: 'studio.asset.folder_renamed',
      resource_type: 'studio_asset_folder',
      resource_id: req.params.folderId,
      metadata: { name: req.body?.name ?? 'Untitled folder' },
    };
    return reply.send({ folder: row ? deps.mapStudioAssetFolderRowToDto(row) : undefined });
  });

  app.delete('/v1/assets/folders/:folderId', { preHandler: requireWorkspace }, async (req, reply) => {
    if (!hasStudioPermission(req.authSession, 'assets:delete')) {
      return reply.status(403).send({ message: 'Insufficient permissions' });
    }
    await deps.deleteStudioAssetFolder(pool, req.authSession.workspaceId, req.params.folderId);
    req._auditMeta = {
      action: 'studio.asset.folder_deleted',
      resource_type: 'studio_asset_folder',
      resource_id: req.params.folderId,
    };
    return reply.status(204).send();
  });
}
