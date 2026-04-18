import { badRequest, forbidden, sendJson, sendNoContent, serviceUnavailable, unauthorized } from '../../lib/http.mjs';
import { requireAuthenticatedSession } from '../auth/service.mjs';
import {
  completeAssetUpload,
  createAssetFolder,
  deleteAsset,
  deleteAssetFolder,
  getAsset,
  listAssetFolders,
  listAssets,
  moveAsset,
  prepareAssetUpload,
  reprocessAsset,
  renameAsset,
  renameAssetFolder,
  saveRemoteAsset,
  updateAssetQuality,
} from './service.mjs';
import { recordAuditEvent } from '../../../../../packages/db/src/audit.mjs';
import { checkRateLimit } from '../../lib/rate-limit.mjs';

function hasPermission(session, permission) {
  return session.permissions.includes(permission);
}

async function withSession(ctx, callback) {
  const session = await requireAuthenticatedSession({ env: ctx.env, headers: ctx.req.headers });
  if (!session.ok) {
    if (session.statusCode === 503) {
      return serviceUnavailable(ctx.res, ctx.requestId, session.message);
    }
    if (session.statusCode === 401) {
      return unauthorized(ctx.res, ctx.requestId, session.message);
    }
    return false;
  }

  try {
    return await callback(session);
  } finally {
    await session.finish();
  }
}

function getActiveWorkspace(session) {
  return session.workspaces.find((workspace) => workspace.id === session.session.activeWorkspaceId) || session.workspaces[0] || null;
}

function enforceRateLimit(res, requestId, headers, key, limit, windowMs) {
  const result = checkRateLimit({ headers, key, limit, windowMs });
  if (result.ok) return false;
  sendJson(res, 429, {
    ok: false,
    requestId,
    code: 'rate_limited',
    message: 'Too many asset operations. Please retry shortly.',
    retryAfterSeconds: result.retryAfterSeconds,
  }, { 'Retry-After': String(result.retryAfterSeconds) });
  return true;
}

export async function handleAssetRoutes(ctx) {
  const { method, pathname, res, requestId, env, body, req } = ctx;

  if (method === 'GET' && pathname === '/v1/assets') {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'assets:view-client')) {
        return forbidden(res, requestId, 'You do not have permission to view assets.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) return sendJson(res, 200, { assets: [] });
      const assets = await listAssets(session.client, workspace.id);
      return sendJson(res, 200, { assets });
    });
  }

  if (method === 'GET' && pathname === '/v1/assets/folders') {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'assets:view-client')) {
        return forbidden(res, requestId, 'You do not have permission to view asset folders.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) return sendJson(res, 200, { folders: [] });
      const folders = await listAssetFolders(session.client, workspace.id);
      return sendJson(res, 200, { folders });
    });
  }

  if (method === 'POST' && pathname === '/v1/assets/folders') {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'assets:create')) {
        return forbidden(res, requestId, 'You do not have permission to create folders.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) return badRequest(res, requestId, 'An active workspace is required to create a folder.');
      try {
        await session.client.query('begin');
        const folder = await createAssetFolder(session.client, {
          workspaceId: workspace.id,
          ownerUserId: session.user.id,
          name: body?.name,
          parentId: body?.parentId,
        });
        await recordAuditEvent(session.client, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          action: 'asset.folder.created',
          targetType: 'asset_folder',
          targetId: folder.id,
          payload: { name: folder.name, parentId: folder.parentId || null },
        });
        await session.client.query('commit');
        return sendJson(res, 200, { folder, requestId });
      } catch (error) {
        await session.client.query('rollback');
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'POST' && /^\/v1\/assets\/folders\/[^/]+\/rename$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'assets:update')) {
        return forbidden(res, requestId, 'You do not have permission to rename folders.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) return badRequest(res, requestId, 'An active workspace is required to rename a folder.');
      try {
        const folderId = pathname.split('/')[4];
        const folder = await renameAssetFolder(session.client, {
          folderId,
          workspaceId: workspace.id,
          name: body?.name,
        });
        if (!folder) {
          return sendJson(res, 404, { ok: false, requestId, code: 'folder_not_found', message: 'Folder not found.' });
        }
        await recordAuditEvent(session.client, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          action: 'asset.folder.renamed',
          targetType: 'asset_folder',
          targetId: folder.id,
          payload: { name: folder.name },
        });
        return sendJson(res, 200, { folder, requestId });
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'DELETE' && /^\/v1\/assets\/folders\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'assets:delete')) {
        return forbidden(res, requestId, 'You do not have permission to delete folders.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) return badRequest(res, requestId, 'An active workspace is required to delete a folder.');
      const folderId = pathname.split('/')[4];
      const deleted = await deleteAssetFolder(session.client, { folderId, workspaceId: workspace.id });
      if (!deleted) {
        return sendJson(res, 404, { ok: false, requestId, code: 'folder_not_found', message: 'Folder not found.' });
      }
      await recordAuditEvent(session.client, {
        workspaceId: workspace.id,
        actorUserId: session.user.id,
        action: 'asset.folder.deleted',
        targetType: 'asset_folder',
        targetId: folderId,
      });
      return sendNoContent(res);
    });
  }

  if (method === 'POST' && (pathname === '/v1/assets/upload-url' || pathname === '/v1/assets/uploads')) {
    if (enforceRateLimit(res, requestId, req.headers, 'asset-prepare-upload', 30, 60_000)) return true;
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'assets:create')) {
        return forbidden(res, requestId, 'You do not have permission to upload assets.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) return badRequest(res, requestId, 'An active workspace is required to upload assets.');
      try {
        await session.client.query('begin');
        const upload = await prepareAssetUpload(session.client, {
          workspaceId: workspace.id,
          ownerUserId: session.user.id,
          payload: body,
          env,
        });
        await recordAuditEvent(session.client, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          action: 'asset.upload.prepared',
          targetType: 'asset_upload_session',
          targetId: upload.id,
          payload: { storageKey: upload.storageKey, filename: upload.filename, kind: upload.kind },
        });
        await session.client.query('commit');
        return sendJson(res, 200, { upload, requestId });
      } catch (error) {
        await session.client.query('rollback');
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'POST' && (pathname === '/v1/assets/complete-upload' || /^\/v1\/assets\/uploads\/[^/]+\/complete$/.test(pathname))) {
    if (enforceRateLimit(res, requestId, req.headers, 'asset-complete-upload', 60, 60_000)) return true;
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'assets:create')) {
        return forbidden(res, requestId, 'You do not have permission to complete uploads.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) return badRequest(res, requestId, 'An active workspace is required to complete uploads.');
      try {
        await session.client.query('begin');
        const payload = pathname.startsWith('/v1/assets/uploads/')
          ? { ...body, assetId: pathname.split('/')[4] }
          : body;
        const asset = await completeAssetUpload(session.client, {
          workspaceId: workspace.id,
          ownerUserId: session.user.id,
          payload,
          env,
        });
        await recordAuditEvent(session.client, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          action: 'asset.upload.completed',
          targetType: 'asset',
          targetId: asset.id,
          payload: { storageKey: asset.storageKey || null, kind: asset.kind, folderId: asset.folderId || null },
        });
        await session.client.query('commit');
        return sendJson(res, 200, { asset, requestId });
      } catch (error) {
        await session.client.query('rollback');
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if ((method === 'POST' || method === 'GET') && pathname === '/v1/assets/health') {
    return sendJson(res, 200, {
      ok: true,
      requestId,
      module: 'assets',
      assetsPublicBaseUrl: env.assetsPublicBaseUrl || null,
      r2Configured: Boolean(env.r2Endpoint && env.r2Bucket && env.r2AccessKeyId && env.r2SecretAccessKey),
    });
  }

  if (method === 'POST' && pathname === '/v1/assets') {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'assets:create')) {
        return forbidden(res, requestId, 'You do not have permission to create assets.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) return badRequest(res, requestId, 'An active workspace is required to create an asset.');
      try {
        await session.client.query('begin');
        const asset = await saveRemoteAsset(session.client, {
          workspaceId: workspace.id,
          ownerUserId: session.user.id,
          payload: body?.asset || body,
        });
        await recordAuditEvent(session.client, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          action: 'asset.remote.created',
          targetType: 'asset',
          targetId: asset.id,
          payload: { originUrl: asset.originUrl || asset.publicUrl || null, kind: asset.kind },
        });
        await session.client.query('commit');
        return sendJson(res, 200, { asset, requestId });
      } catch (error) {
        await session.client.query('rollback');
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'GET' && /^\/v1\/assets\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'assets:view-client')) {
        return forbidden(res, requestId, 'You do not have permission to view this asset.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) {
        return sendJson(res, 404, { ok: false, requestId, code: 'asset_not_found', message: 'Asset not found.' });
      }
      const assetId = pathname.split('/')[3];
      const asset = await getAsset(session.client, { assetId, workspaceId: workspace.id });
      if (!asset) {
        return sendJson(res, 404, { ok: false, requestId, code: 'asset_not_found', message: 'Asset not found.' });
      }
      return sendJson(res, 200, { asset });
    });
  }

  if (method === 'DELETE' && /^\/v1\/assets\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'assets:delete')) {
        return forbidden(res, requestId, 'You do not have permission to delete assets.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) return badRequest(res, requestId, 'An active workspace is required to delete an asset.');
      const assetId = pathname.split('/')[3];
      const deleted = await deleteAsset(session.client, { assetId, workspaceId: workspace.id });
      if (!deleted) {
        return sendJson(res, 404, { ok: false, requestId, code: 'asset_not_found', message: 'Asset not found.' });
      }
      await recordAuditEvent(session.client, {
        workspaceId: workspace.id,
        actorUserId: session.user.id,
        action: 'asset.deleted',
        targetType: 'asset',
        targetId: assetId,
      });
      return sendNoContent(res);
    });
  }

  if (method === 'POST' && /^\/v1\/assets\/[^/]+\/rename$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'assets:update')) {
        return forbidden(res, requestId, 'You do not have permission to rename assets.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) return badRequest(res, requestId, 'An active workspace is required to rename an asset.');
      try {
        const assetId = pathname.split('/')[3];
        const asset = await renameAsset(session.client, { assetId, workspaceId: workspace.id, name: body?.name });
        if (!asset) {
          return sendJson(res, 404, { ok: false, requestId, code: 'asset_not_found', message: 'Asset not found.' });
        }
        await recordAuditEvent(session.client, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          action: 'asset.renamed',
          targetType: 'asset',
          targetId: asset.id,
          payload: { name: asset.name },
        });
        return sendJson(res, 200, { asset, requestId });
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'POST' && /^\/v1\/assets\/[^/]+\/move$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'assets:update')) {
        return forbidden(res, requestId, 'You do not have permission to move assets.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) return badRequest(res, requestId, 'An active workspace is required to move an asset.');
      try {
        const assetId = pathname.split('/')[3];
        const asset = await moveAsset(session.client, {
          assetId,
          workspaceId: workspace.id,
          folderId: body?.folderId,
        });
        if (!asset) {
          return sendJson(res, 404, { ok: false, requestId, code: 'asset_not_found', message: 'Asset not found.' });
        }
        await recordAuditEvent(session.client, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          action: 'asset.moved',
          targetType: 'asset',
          targetId: asset.id,
          payload: { folderId: asset.folderId || null },
        });
        return sendJson(res, 200, { asset, requestId });
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'POST' && /^\/v1\/assets\/[^/]+\/quality$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'assets:update')) {
        return forbidden(res, requestId, 'You do not have permission to update asset quality.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) return badRequest(res, requestId, 'An active workspace is required to update an asset.');
      try {
        const assetId = pathname.split('/')[3];
        const asset = await updateAssetQuality(session.client, {
          assetId,
          workspaceId: workspace.id,
          qualityPreference: body?.qualityPreference,
        });
        if (!asset) {
          return sendJson(res, 404, { ok: false, requestId, code: 'asset_not_found', message: 'Asset not found.' });
        }
        await recordAuditEvent(session.client, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          action: 'asset.quality.updated',
          targetType: 'asset',
          targetId: asset.id,
          payload: { qualityPreference: asset.qualityPreference || null },
        });
        return sendJson(res, 200, { asset, requestId });
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'POST' && /^\/v1\/assets\/[^/]+\/reprocess$/.test(pathname)) {
    if (enforceRateLimit(res, requestId, req.headers, 'asset-reprocess', 30, 60_000)) return true;
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'assets:update')) {
        return forbidden(res, requestId, 'You do not have permission to reprocess assets.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) return badRequest(res, requestId, 'An active workspace is required to reprocess an asset.');
      try {
        await session.client.query('begin');
        const assetId = pathname.split('/')[3];
        const asset = await reprocessAsset(session.client, {
          assetId,
          workspaceId: workspace.id,
          ownerUserId: session.user.id,
        });
        if (!asset) {
          await session.client.query('rollback');
          return sendJson(res, 404, { ok: false, requestId, code: 'asset_not_found', message: 'Asset not found.' });
        }
        await recordAuditEvent(session.client, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          action: 'asset.reprocessed',
          targetType: 'asset',
          targetId: asset.id,
          payload: { kind: asset.kind, storageKey: asset.storageKey || null },
        });
        await session.client.query('commit');
        return sendJson(res, 200, { asset, requestId });
      } catch (error) {
        await session.client.query('rollback');
        return badRequest(res, requestId, error.message);
      }
    });
  }

  return false;
}
