import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import {
  authenticate,
  addBrandToClientForSession,
  deleteAssetForSession,
  deleteProjectForSession,
  duplicateProjectForSession,
  archiveProjectForSession,
  restoreProjectForSession,
  changeProjectOwnerForSession,
  getStorageDiagnosticsForSession,
  rebuildStorageIndexesForSession,
  clearDocumentForSession,
  createClientForSession,
  createAssetFolderForSession,
  getAssetForSession,
  hasDocumentForSession,
  getSessionContext,
  inviteMemberToClientForSession,
  listClientsForSession,
  listAssetFoldersForSession,
  listAssetsForSession,
  listProjectsForSession,
  listProjectVersionsForSession,
  loadDocumentForSession,
  loadProjectForSession,
  loadProjectVersionForSession,
  renameAssetForSession,
  revokeSession,
  saveDocumentForSession,
  saveAssetForSession,
  saveProjectForSession,
  saveProjectVersionForSession,
  setActiveClientForSession,
} from './store.mjs';
import { buildStorageKey, createUploadUrl, detectAssetKind, objectExists, toPublicAssetUrl } from './r2.mjs';
import { getServerEnv } from './env.mjs';

const env = getServerEnv();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  });
  res.end(JSON.stringify(payload));
}

function notFound(res) {
  sendJson(res, 404, { ok: false, message: 'Not found' });
}

function badRequest(res, message) {
  sendJson(res, 400, { ok: false, message });
}

function unauthorized(res, message = 'Unauthorized') {
  sendJson(res, 401, { ok: false, message });
}

function forbidden(res, message = 'Forbidden') {
  sendJson(res, 403, { ok: false, message });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function getBearerToken(req) {
  const header = req.headers.authorization;
  if (!header) return '';
  const [scheme, token] = header.split(/\s+/, 2);
  if (!scheme || scheme.toLowerCase() !== 'bearer') return '';
  return token?.trim() || '';
}

async function requireSession(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    unauthorized(res, 'Missing session token');
    return null;
  }
  const context = await getSessionContext(token);
  if (!context) {
    unauthorized(res, 'Session expired or invalid');
    return null;
  }
  return context;
}

function hydrateAssetUrls(asset) {
  if (!asset || asset.storageMode !== 'object-storage' || !asset.storageKey) return asset;
  const publicUrl = toPublicAssetUrl(asset.storageKey);
  return {
    ...asset,
    src: publicUrl,
    publicUrl,
    posterSrc: asset.kind === 'video' ? (asset.posterSrc || publicUrl) : publicUrl,
    thumbnailUrl: publicUrl,
  };
}

function normalizeAssetDraft(input = {}) {
  const sourceType = input.sourceType === 'url' || input.sourceType === 'upload' ? input.sourceType : undefined;
  const storageMode = input.storageMode === 'object-storage' || input.storageMode === 'remote-url'
    ? input.storageMode
    : (sourceType === 'url' ? 'remote-url' : 'object-storage');
  return {
    name: String(input.name || 'Untitled asset'),
    kind: input.kind || detectAssetKind(input.mimeType, input.name || input.src || 'asset.bin'),
    src: String(input.publicUrl || input.src || ''),
    mimeType: input.mimeType || undefined,
    sourceType: sourceType || (storageMode === 'remote-url' ? 'url' : 'upload'),
    storageMode,
    storageKey: input.storageKey || undefined,
    publicUrl: input.publicUrl || undefined,
    originUrl: input.originUrl || undefined,
    posterSrc: input.posterSrc || undefined,
    accessScope: input.accessScope === 'private' ? 'private' : 'client',
    tags: Array.isArray(input.tags) ? input.tags : [],
    folderId: typeof input.folderId === 'string' ? input.folderId : undefined,
    sizeBytes: typeof input.sizeBytes === 'number' ? input.sizeBytes : undefined,
    width: typeof input.width === 'number' ? input.width : undefined,
    height: typeof input.height === 'number' ? input.height : undefined,
    durationMs: typeof input.durationMs === 'number' ? input.durationMs : undefined,
    fingerprint: input.fingerprint || undefined,
    fontFamily: input.fontFamily || undefined,
  };
}

function validateLoginBody(body) {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object';
  if (typeof body.email !== 'string' || !body.email.trim()) return 'Email is required';
  if (typeof body.password !== 'string' || !body.password.trim()) return 'Password is required';
  return '';
}

function validateStatePayload(body) {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object';
  if (!('state' in body) || typeof body.state !== 'object' || body.state === null) return 'state is required';
  return '';
}

const server = createServer(async (req, res) => {
  if (!req.url || !req.method) return notFound(res);
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;

  try {
    if (req.method === 'GET' && path === '/health') {
      return sendJson(res, 200, { ok: true, service: 'smx-platform-api', bucket: env.bucket });
    }

    if (req.method === 'POST' && path === '/auth/login') {
      const body = await readBody(req);
      const validationError = validateLoginBody(body);
      if (validationError) return badRequest(res, validationError);
      const result = await authenticate(body.email || '', body.password || '', Boolean(body.remember));
      if (!result) return unauthorized(res, 'Invalid credentials');
      return sendJson(res, 200, result);
    }

    if (req.method === 'POST' && path === '/auth/logout') {
      const sessionToken = getBearerToken(req);
      if (sessionToken) await revokeSession(sessionToken);
      return sendJson(res, 200, { ok: true });
    }

    if (path.startsWith('/clients')) {
      const session = await requireSession(req, res);
      if (!session) return;

      if (req.method === 'GET' && path === '/clients') {
        return sendJson(res, 200, { clients: await listClientsForSession(session), activeClientId: session.activeClientId });
      }

      if (req.method === 'POST' && path === '/clients') {
        const body = await readBody(req);
        if (!body?.name || typeof body.name !== 'string') return badRequest(res, 'name is required');
        const result = await createClientForSession(session, body.name);
        return sendJson(res, 200, { ok: true, ...result });
      }

      if (req.method === 'POST' && path === '/clients/active') {
        const body = await readBody(req);
        if (!body?.clientId || typeof body.clientId !== 'string') return badRequest(res, 'clientId is required');
        const result = await setActiveClientForSession(session, body.clientId);
        return sendJson(res, 200, { ok: true, ...result });
      }

      const clientBrandMatch = path.match(/^\/clients\/([^/]+)\/brands$/);
      if (req.method === 'POST' && clientBrandMatch) {
        const body = await readBody(req);
        if (!body?.name || typeof body.name !== 'string') return badRequest(res, 'name is required');
        const result = await addBrandToClientForSession(session, clientBrandMatch[1], body.name, typeof body.primaryColor === 'string' ? body.primaryColor : '#8b5cf6');
        return sendJson(res, 200, { ok: true, ...result });
      }

      const clientInviteMatch = path.match(/^\/clients\/([^/]+)\/invites$/);
      if (req.method === 'POST' && clientInviteMatch) {
        const body = await readBody(req);
        if (!body?.email || typeof body.email !== 'string') return badRequest(res, 'email is required');
        const result = await inviteMemberToClientForSession(session, clientInviteMatch[1], body.email, body.role);
        return sendJson(res, 200, result);
      }
    }

    if (path.startsWith('/projects') || path.startsWith('/assets') || path.startsWith('/documents')) {
      const session = await requireSession(req, res);
      if (!session) return;

      if (req.method === 'GET' && path === '/projects') {
        return sendJson(res, 200, { projects: await listProjectsForSession(session) });
      }

      if (req.method === 'GET' && path === '/admin/storage/diagnostics') {
        try {
          return sendJson(res, 200, await getStorageDiagnosticsForSession(session));
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Forbidden:')) return forbidden(res, error.message);
          throw error;
        }
      }

      if (req.method === 'POST' && path === '/admin/storage/rebuild') {
        try {
          return sendJson(res, 200, await rebuildStorageIndexesForSession(session));
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Forbidden:')) return forbidden(res, error.message);
          throw error;
        }
      }

      if (req.method === 'POST' && path === '/projects/save') {
        const body = await readBody(req);
        const validationError = validateStatePayload(body);
        if (validationError) return badRequest(res, validationError);
        const project = await saveProjectForSession(session, body.state ?? {}, body.projectId);
        return sendJson(res, 200, { project });
      }

      const projectLoadMatch = path.match(/^\/projects\/([^/]+)$/);
      if (req.method === 'GET' && projectLoadMatch) {
        return sendJson(res, 200, { state: await loadProjectForSession(session, projectLoadMatch[1]) });
      }
      if (req.method === 'DELETE' && projectLoadMatch) {
        try {
          await deleteProjectForSession(session, projectLoadMatch[1]);
          return sendJson(res, 200, { ok: true });
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Forbidden:')) return forbidden(res, error.message);
          throw error;
        }
      }

      const projectDuplicateMatch = path.match(/^\/projects\/([^/]+)\/duplicate$/);
      if (req.method === 'POST' && projectDuplicateMatch) {
        try {
          const project = await duplicateProjectForSession(session, projectDuplicateMatch[1]);
          return sendJson(res, 200, { project });
        } catch (error) {
          if (error instanceof Error && (error.message.startsWith('Forbidden:') || error.message === 'Project not found')) return forbidden(res, error.message);
          throw error;
        }
      }

      const projectArchiveMatch = path.match(/^\/projects\/([^/]+)\/archive$/);
      if (req.method === 'POST' && projectArchiveMatch) {
        try {
          await archiveProjectForSession(session, projectArchiveMatch[1]);
          return sendJson(res, 200, { ok: true });
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Forbidden:')) return forbidden(res, error.message);
          throw error;
        }
      }

      const projectRestoreMatch = path.match(/^\/projects\/([^/]+)\/restore$/);
      if (req.method === 'POST' && projectRestoreMatch) {
        try {
          await restoreProjectForSession(session, projectRestoreMatch[1]);
          return sendJson(res, 200, { ok: true });
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Forbidden:')) return forbidden(res, error.message);
          throw error;
        }
      }

      const projectOwnerMatch = path.match(/^\/projects\/([^/]+)\/owner$/);
      if (req.method === 'POST' && projectOwnerMatch) {
        const body = await readBody(req);
        if (!body.ownerUserId || typeof body.ownerUserId !== 'string') return badRequest(res, 'ownerUserId is required');
        try {
          await changeProjectOwnerForSession(session, projectOwnerMatch[1], body.ownerUserId, typeof body.ownerName === 'string' ? body.ownerName : undefined);
          return sendJson(res, 200, { ok: true });
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Forbidden:')) return forbidden(res, error.message);
          throw error;
        }
      }

      const versionListMatch = path.match(/^\/projects\/([^/]+)\/versions$/);
      if (req.method === 'GET' && versionListMatch) {
        return sendJson(res, 200, { versions: await listProjectVersionsForSession(session, versionListMatch[1]) });
      }
      if (req.method === 'POST' && versionListMatch) {
        const body = await readBody(req);
        const validationError = validateStatePayload(body);
        if (validationError) return badRequest(res, validationError);
        try {
          const version = await saveProjectVersionForSession(session, versionListMatch[1], body.state ?? {}, typeof body.note === 'string' ? body.note : undefined);
          return sendJson(res, 200, { version });
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Forbidden:')) return forbidden(res, error.message);
          throw error;
        }
      }

      const versionLoadMatch = path.match(/^\/projects\/([^/]+)\/versions\/([^/]+)$/);
      if (req.method === 'GET' && versionLoadMatch) {
        return sendJson(res, 200, { state: await loadProjectVersionForSession(session, versionLoadMatch[1], versionLoadMatch[2]) });
      }

      if (req.method === 'GET' && path === '/assets') {
        const assets = await listAssetsForSession(session);
        return sendJson(res, 200, { assets: assets.map(hydrateAssetUrls) });
      }

      if (req.method === 'GET' && path === '/assets/folders') {
        const folders = await listAssetFoldersForSession(session);
        return sendJson(res, 200, { folders });
      }

      if (req.method === 'POST' && path === '/assets/folders') {
        const body = await readBody(req);
        if (typeof body.name !== 'string' || !body.name.trim()) return badRequest(res, 'name is required');
        const folder = await createAssetFolderForSession(session, body.name, typeof body.parentId === 'string' ? body.parentId : undefined);
        return sendJson(res, 200, { folder });
      }

      if (req.method === 'GET' && path === '/documents/autosave/exists') {
        return sendJson(res, 200, { exists: await hasDocumentForSession(session, 'autosave') });
      }

      if (req.method === 'GET' && path === '/documents/manual-save/exists') {
        return sendJson(res, 200, { exists: await hasDocumentForSession(session, 'manual') });
      }

      if (req.method === 'GET' && path === '/documents/autosave') {
        return sendJson(res, 200, { state: await loadDocumentForSession(session, 'autosave') });
      }

      if (req.method === 'GET' && path === '/documents/manual-save') {
        return sendJson(res, 200, { state: await loadDocumentForSession(session, 'manual') });
      }

      if (req.method === 'POST' && path === '/documents/autosave') {
        const body = await readBody(req);
        const validationError = validateStatePayload(body);
        if (validationError) return badRequest(res, validationError);
        await saveDocumentForSession(session, 'autosave', body.state ?? {});
        return sendJson(res, 200, { ok: true });
      }

      if (req.method === 'POST' && path === '/documents/manual-save') {
        const body = await readBody(req);
        const validationError = validateStatePayload(body);
        if (validationError) return badRequest(res, validationError);
        await saveDocumentForSession(session, 'manual', body.state ?? {});
        return sendJson(res, 200, { ok: true });
      }

      if (req.method === 'DELETE' && path === '/documents/autosave') {
        await clearDocumentForSession(session, 'autosave');
        return sendJson(res, 200, { ok: true });
      }

      if (req.method === 'POST' && path === '/assets') {
        const body = await readBody(req);
        const draft = normalizeAssetDraft(body.asset || {});
        const asset = hydrateAssetUrls(await saveAssetForSession(session, {
          ...draft,
          id: randomUUID(),
          createdAt: new Date().toISOString(),
        }));
        return sendJson(res, 200, { asset });
      }

      if (req.method === 'POST' && path === '/assets/upload-url') {
        const body = await readBody(req);
        const assetId = randomUUID();
        const filename = String(body.filename || 'asset.bin');
        if (!filename.trim()) return badRequest(res, 'filename is required');
        const kind = body.kind || detectAssetKind(body.mimeType, filename);
        const storageKey = buildStorageKey({ assetId, clientId: session.activeClientId || 'client_default', filename });
        const uploadUrl = await createUploadUrl({ storageKey, mimeType: body.mimeType });
        return sendJson(res, 200, {
          upload: {
            assetId,
            name: body.requestedName || filename,
            kind,
            mimeType: body.mimeType,
            sizeBytes: body.sizeBytes,
            accessScope: body.accessScope || 'client',
            tags: body.tags || [],
            folderId: body.folderId,
            fontFamily: body.fontFamily,
            storageMode: 'object-storage',
            storageKey,
            uploadUrl,
            publicUrl: toPublicAssetUrl(storageKey),
          },
        });
      }

      if (req.method === 'POST' && path === '/assets/complete-upload') {
        const body = await readBody(req);
        if (!body.storageKey || typeof body.storageKey !== 'string') return badRequest(res, 'storageKey is required');
        const exists = await objectExists(body.storageKey);
        if (!exists) return sendJson(res, 404, { ok: false, message: 'Uploaded object not found in R2.' });
        const asset = hydrateAssetUrls(await saveAssetForSession(session, {
          id: body.assetId || randomUUID(),
          name: body.name || body.storageKey.split('/').pop() || body.assetId,
          kind: body.kind || detectAssetKind(body.mimeType, body.storageKey),
          src: body.publicUrl || toPublicAssetUrl(body.storageKey),
          createdAt: new Date().toISOString(),
          mimeType: body.mimeType,
          sourceType: body.sourceType || 'upload',
          storageMode: body.storageMode || 'object-storage',
          storageKey: body.storageKey,
          publicUrl: body.publicUrl || toPublicAssetUrl(body.storageKey),
          posterSrc: body.publicUrl || toPublicAssetUrl(body.storageKey),
          thumbnailUrl: body.publicUrl || toPublicAssetUrl(body.storageKey),
          accessScope: body.accessScope || 'client',
          tags: body.tags || [],
          folderId: body.folderId,
          sizeBytes: body.sizeBytes,
          width: body.metadata?.width ?? body.width,
          height: body.metadata?.height ?? body.height,
          durationMs: body.metadata?.durationMs ?? body.durationMs,
          fingerprint: body.metadata?.fingerprint ?? body.fingerprint,
          fontFamily: body.fontFamily,
        }));
        return sendJson(res, 200, { asset });
      }

      const assetSingleMatch = path.match(/^\/assets\/([^/]+)$/);
      if (req.method === 'GET' && assetSingleMatch) {
        const asset = await getAssetForSession(session, assetSingleMatch[1]);
        return sendJson(res, 200, { asset: asset ? hydrateAssetUrls(asset) : undefined });
      }
      if (req.method === 'DELETE' && assetSingleMatch) {
        try {
          await deleteAssetForSession(session, assetSingleMatch[1], {
            purgeBinary: ['1', 'true', 'yes'].includes(String(url.searchParams.get('purge') || '').toLowerCase()),
          });
          return sendJson(res, 200, { ok: true });
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Forbidden:')) return forbidden(res, error.message);
          throw error;
        }
      }

      const assetRenameMatch = path.match(/^\/assets\/([^/]+)\/rename$/);
      if (req.method === 'POST' && assetRenameMatch) {
        const body = await readBody(req);
        const name = String(body.name || '').trim();
        try {
          const asset = await renameAssetForSession(session, assetRenameMatch[1], name);
          if (!asset) return sendJson(res, 404, { ok: false, message: 'Asset not found' });
          return sendJson(res, 200, { asset: hydrateAssetUrls(asset) });
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Forbidden:')) return forbidden(res, error.message);
          throw error;
        }
      }
    }

    return notFound(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    if (typeof message === 'string' && message.startsWith('Forbidden:')) return forbidden(res, message);
    return sendJson(res, 500, { ok: false, message });
  }
});

server.listen(env.port, env.host, () => {
  console.log(`[smx-platform-api] listening on http://${env.host}:${env.port}`);
});
