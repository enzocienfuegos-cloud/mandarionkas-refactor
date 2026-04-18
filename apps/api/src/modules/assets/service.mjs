import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { enqueueImageDerivativeJob, enqueueVideoTranscodeJob, patchAssetMetadata } from '../../../../../packages/db/src/asset-jobs.mjs';

const R2_REGION = 'auto';
const PREPARE_UPLOAD_TTL_SECONDS = 60 * 15;

function normalizeString(value) {
  const normalized = String(value ?? '').trim();
  return normalized || '';
}

function normalizeKind(value) {
  return ['image', 'video', 'font', 'other'].includes(value) ? value : 'other';
}

function normalizeAccessScope(value) {
  return value === 'private' ? 'private' : 'client';
}

function normalizeSourceType(value) {
  return value === 'url' ? 'url' : 'upload';
}

function normalizeStorageMode(value, sourceType) {
  if (value === 'remote-url') return 'remote-url';
  if (value === 'object-storage') return 'object-storage';
  return sourceType === 'url' ? 'remote-url' : 'object-storage';
}

function normalizeArray(value) {
  return Array.isArray(value)
    ? value.map((entry) => String(entry ?? '').trim()).filter(Boolean)
    : [];
}

function normalizeDerivativeEntry(value) {
  if (!value || typeof value !== 'object') return undefined;
  const src = normalizeOptionalText(value.src);
  if (!src) return undefined;
  return {
    src,
    mimeType: normalizeOptionalText(value.mimeType) || undefined,
    sizeBytes: toBigIntNumber(value.sizeBytes) ?? undefined,
    width: toInt(value.width) ?? undefined,
    height: toInt(value.height) ?? undefined,
    bitrateKbps: toInt(value.bitrateKbps) ?? undefined,
    codec: normalizeOptionalText(value.codec) || undefined,
  };
}

function normalizeDerivativeSet(value) {
  if (!value || typeof value !== 'object') return undefined;
  const mapped = {
    original: normalizeDerivativeEntry(value.original),
    low: normalizeDerivativeEntry(value.low),
    mid: normalizeDerivativeEntry(value.mid),
    high: normalizeDerivativeEntry(value.high),
    thumbnail: normalizeDerivativeEntry(value.thumbnail),
    poster: normalizeDerivativeEntry(value.poster),
  };
  return Object.values(mapped).some(Boolean) ? mapped : undefined;
}

function isOptimizableRasterImage(kind, mimeType) {
  if (kind !== 'image') return false;
  return ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(String(mimeType || '').trim().toLowerCase());
}

function buildAssetMetadataPayload(payload = {}, existingMetadata = {}) {
  const derivatives = normalizeDerivativeSet(payload.derivatives) ?? normalizeDerivativeSet(existingMetadata.derivatives);
  const qualityPreference = normalizeOptionalText(payload.qualityPreference) || normalizeOptionalText(existingMetadata.qualityPreference);
  const optimizedUrl = normalizeOptionalText(payload.optimizedUrl) || normalizeOptionalText(existingMetadata.optimizedUrl);
  const optimization = existingMetadata.optimization && typeof existingMetadata.optimization === 'object'
    ? existingMetadata.optimization
    : undefined;
  const metadata = {
    ...(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
    ...(existingMetadata && typeof existingMetadata === 'object' ? existingMetadata : {}),
    ...(derivatives ? { derivatives } : {}),
    ...(qualityPreference ? { qualityPreference } : {}),
    ...(optimizedUrl ? { optimizedUrl } : {}),
    ...(optimization ? { optimization } : {}),
  };
  return metadata;
}

function normalizeOptionalText(value) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function toInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBigIntNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function createStorageKey({ workspaceId, assetId, filename, kind }) {
  const cleanedFile = normalizeString(filename).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-120) || 'upload.bin';
  const extension = cleanedFile.includes('.') ? '' : guessExtension(kind);
  return `workspaces/${workspaceId}/assets/${assetId}/${cleanedFile}${extension}`;
}

function guessExtension(kind) {
  if (kind === 'image') return '.png';
  if (kind === 'video') return '.mp4';
  if (kind === 'font') return '.woff2';
  return '.bin';
}

function trimBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function buildPublicUrl(env, storageKey) {
  const base = trimBaseUrl(env.assetsPublicBaseUrl);
  if (!base || !storageKey) return null;
  return `${base}/${storageKey}`;
}

function isR2SigningReady(env) {
  return Boolean(env.r2Endpoint && env.r2Bucket && env.r2AccessKeyId && env.r2SecretAccessKey);
}

let cachedR2Client = null;
let cachedR2Key = '';

function getR2Client(env) {
  const cacheKey = `${env.r2Endpoint}|${env.r2AccessKeyId}|${env.r2Bucket}`;
  if (cachedR2Client && cachedR2Key === cacheKey) return cachedR2Client;
  cachedR2Client = new S3Client({
    region: R2_REGION,
    endpoint: env.r2Endpoint,
    credentials: {
      accessKeyId: env.r2AccessKeyId,
      secretAccessKey: env.r2SecretAccessKey,
    },
  });
  cachedR2Key = cacheKey;
  return cachedR2Client;
}

async function signUploadUrl(env, { storageKey, mimeType }) {
  if (!isR2SigningReady(env)) return null;
  const client = getR2Client(env);
  const command = new PutObjectCommand({
    Bucket: env.r2Bucket,
    Key: storageKey,
    ContentType: normalizeOptionalText(mimeType) || undefined,
  });
  return getSignedUrl(client, command, { expiresIn: PREPARE_UPLOAD_TTL_SECONDS });
}

function mapFolderRow(row) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at.toISOString(),
    clientId: row.workspace_id,
    ownerUserId: row.owner_user_id,
    parentId: row.parent_id || undefined,
  };
}

function mapAssetRow(row) {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const derivatives = normalizeDerivativeSet(metadata.derivatives);
  const optimizedUrl = normalizeOptionalText(metadata.optimizedUrl) || undefined;
  const qualityPreference = normalizeOptionalText(metadata.qualityPreference) || undefined;
  const optimizationState = metadata.optimization?.image && typeof metadata.optimization.image === 'object'
    ? metadata.optimization.image
    : metadata.optimization?.video && typeof metadata.optimization.video === 'object'
      ? metadata.optimization.video
      : {};
  const processingStatus = normalizeOptionalText(optimizationState?.status)
    || undefined;
  const processingMessage = normalizeOptionalText(optimizationState?.reason)
    || normalizeOptionalText(row.error_message)
    || undefined;
  const processingAttempts = toInt(optimizationState?.retryCount) ?? undefined;
  const processingLastRetryAt = normalizeOptionalText(optimizationState?.lastRetryAt) || undefined;
  const processingNextRetryAt = normalizeOptionalText(optimizationState?.nextRetryAt) || undefined;
  const src = row.public_url || row.origin_url || '';
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    src: optimizedUrl || derivatives?.mid?.src || derivatives?.high?.src || derivatives?.low?.src || src,
    createdAt: row.created_at.toISOString(),
    mimeType: row.mime_type || undefined,
    sourceType: row.source_type || undefined,
    storageMode: row.storage_mode || undefined,
    storageKey: row.storage_key || undefined,
    publicUrl: row.public_url || undefined,
    optimizedUrl,
    qualityPreference,
    processingStatus,
    processingMessage,
    processingAttempts,
    processingLastRetryAt,
    processingNextRetryAt,
    derivatives,
    originUrl: row.origin_url || undefined,
    posterSrc: row.poster_src || derivatives?.poster?.src || undefined,
    thumbnailUrl: row.thumbnail_url || derivatives?.thumbnail?.src || undefined,
    accessScope: row.access_scope || undefined,
    tags: Array.isArray(row.tags) ? row.tags : [],
    folderId: row.folder_id || undefined,
    sizeBytes: row.size_bytes === null || row.size_bytes === undefined ? undefined : Number(row.size_bytes),
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    fingerprint: row.fingerprint || undefined,
    fontFamily: row.font_family || undefined,
    clientId: row.workspace_id,
    ownerUserId: row.owner_user_id,
  };
}

export async function listAssetFolders(client, workspaceId) {
  const result = await client.query(
    `
      select id, workspace_id, owner_user_id, parent_id, name, created_at
      from asset_folders
      where workspace_id = $1
      order by created_at desc, name asc
    `,
    [workspaceId],
  );
  return result.rows.map(mapFolderRow);
}

async function ensureFolderBelongsToWorkspace(client, { folderId, workspaceId }) {
  if (!folderId) return null;
  const result = await client.query(
    `
      select id, workspace_id, owner_user_id, parent_id, name, created_at
      from asset_folders
      where id = $1 and workspace_id = $2
      limit 1
    `,
    [folderId, workspaceId],
  );
  return result.rows[0] || null;
}

export async function createAssetFolder(client, { workspaceId, ownerUserId, name, parentId }) {
  const trimmedName = normalizeString(name);
  if (!trimmedName) {
    throw new Error('Folder name is required.');
  }

  if (parentId) {
    const parent = await ensureFolderBelongsToWorkspace(client, { folderId: parentId, workspaceId });
    if (!parent) {
      throw new Error('Parent folder not found.');
    }
  }

  const id = randomUUID();
  const result = await client.query(
    `
      insert into asset_folders (id, workspace_id, owner_user_id, parent_id, name)
      values ($1, $2, $3, $4, $5)
      returning id, workspace_id, owner_user_id, parent_id, name, created_at
    `,
    [id, workspaceId, ownerUserId, parentId || null, trimmedName],
  );
  return mapFolderRow(result.rows[0]);
}

export async function listAssets(client, workspaceId) {
  const result = await client.query(
    `
      select id,
             workspace_id,
             owner_user_id,
             folder_id,
             name,
             kind,
             mime_type,
             source_type,
             storage_mode,
             storage_key,
             public_url,
             origin_url,
             poster_src,
             thumbnail_url,
             access_scope,
             tags,
             size_bytes,
             width,
             height,
             duration_ms,
             fingerprint,
             font_family,
             created_at
      from assets
      where workspace_id = $1
      order by created_at desc, updated_at desc
    `,
    [workspaceId],
  );
  return result.rows.map(mapAssetRow);
}

export async function getAsset(client, { assetId, workspaceId }) {
  const result = await client.query(
    `
      select id,
             workspace_id,
             owner_user_id,
             folder_id,
             name,
             kind,
             mime_type,
             source_type,
             storage_mode,
             storage_key,
             public_url,
             origin_url,
             poster_src,
             thumbnail_url,
             access_scope,
             tags,
             size_bytes,
             width,
             height,
             duration_ms,
             fingerprint,
             font_family,
             created_at
      from assets
      where id = $1 and workspace_id = $2
      limit 1
    `,
    [assetId, workspaceId],
  );
  return result.rows[0] ? mapAssetRow(result.rows[0]) : null;
}

export async function reprocessAsset(client, { workspaceId, ownerUserId, assetId }) {
  const asset = await getAsset(client, { assetId, workspaceId });
  if (!asset) return null;

  if (asset.storageMode !== 'object-storage') {
    throw new Error('Only object storage assets can be reprocessed.');
  }

  if (asset.kind === 'video') {
    if (!asset.storageKey || !asset.publicUrl) {
      throw new Error('Video asset is missing storage metadata required for reprocessing.');
    }
    const outputPlan = {
      low: {
        storageKey: `${asset.storageKey.replace(/\.[^.]+$/, '')}-low.mp4`,
        publicUrl: `${asset.publicUrl.replace(/\.[^.]+$/, '')}-low.mp4`,
      },
      mid: {
        storageKey: `${asset.storageKey.replace(/\.[^.]+$/, '')}-mid.mp4`,
        publicUrl: `${asset.publicUrl.replace(/\.[^.]+$/, '')}-mid.mp4`,
      },
      high: {
        storageKey: `${asset.storageKey.replace(/\.[^.]+$/, '')}-high.mp4`,
        publicUrl: `${asset.publicUrl.replace(/\.[^.]+$/, '')}-high.mp4`,
      },
      poster: {
        storageKey: `${asset.storageKey.replace(/\.[^.]+$/, '')}-poster.jpg`,
        publicUrl: `${asset.publicUrl.replace(/\.[^.]+$/, '')}-poster.jpg`,
      },
    };
    const nextRetryCount = (asset.processingAttempts ?? 0) + 1;
    const lastRetryAt = new Date().toISOString();
    await enqueueVideoTranscodeJob(client, {
      workspaceId,
      ownerUserId,
      assetId,
      input: {
        assetId,
        workspaceId,
        storageKey: asset.storageKey,
        publicUrl: asset.publicUrl,
        mimeType: asset.mimeType,
        width: asset.width || null,
        height: asset.height || null,
        durationMs: asset.durationMs || null,
        outputPlan,
      },
    });
    await patchAssetMetadata(client, {
      assetId,
      workspaceId,
      metadataPatch: {
        optimization: {
          video: {
            status: 'queued',
            outputs: outputPlan,
            reason: null,
            retryCount: nextRetryCount,
            lastRetryAt,
            nextRetryAt: null,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    });
    return getAsset(client, { assetId, workspaceId });
  }

  if (isOptimizableRasterImage(asset.kind, asset.mimeType)) {
    if (!asset.storageKey || !asset.publicUrl) {
      throw new Error('Image asset is missing storage metadata required for reprocessing.');
    }
    const extension = asset.mimeType === 'image/png' ? 'png' : asset.mimeType === 'image/webp' ? 'webp' : 'jpg';
    const baseStorageKey = asset.storageKey.replace(/\.[^.]+$/, '');
    const basePublicUrl = asset.publicUrl.replace(/\.[^.]+$/, '');
    const outputPlan = {
      low: {
        storageKey: `${baseStorageKey}-low.${extension}`,
        publicUrl: `${basePublicUrl}-low.${extension}`,
        maxWidth: 640,
      },
      mid: {
        storageKey: `${baseStorageKey}-mid.${extension}`,
        publicUrl: `${basePublicUrl}-mid.${extension}`,
        maxWidth: 1280,
      },
      high: {
        storageKey: `${baseStorageKey}-high.${extension}`,
        publicUrl: `${basePublicUrl}-high.${extension}`,
        maxWidth: 1920,
      },
      thumbnail: {
        storageKey: `${baseStorageKey}-thumb.${extension}`,
        publicUrl: `${basePublicUrl}-thumb.${extension}`,
        maxWidth: 320,
      },
    };
    const nextRetryCount = (asset.processingAttempts ?? 0) + 1;
    const lastRetryAt = new Date().toISOString();
    await enqueueImageDerivativeJob(client, {
      workspaceId,
      ownerUserId,
      assetId,
      input: {
        assetId,
        workspaceId,
        storageKey: asset.storageKey,
        publicUrl: asset.publicUrl,
        mimeType: asset.mimeType,
        width: asset.width || null,
        height: asset.height || null,
        outputPlan,
      },
    });
    await patchAssetMetadata(client, {
      assetId,
      workspaceId,
      metadataPatch: {
        optimization: {
          image: {
            status: 'queued',
            outputs: outputPlan,
            reason: null,
            retryCount: nextRetryCount,
            lastRetryAt,
            nextRetryAt: null,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    });
    return getAsset(client, { assetId, workspaceId });
  }

  throw new Error('This asset type does not support reprocessing.');
}

export async function renameAsset(client, { assetId, workspaceId, name }) {
  const trimmedName = normalizeString(name);
  if (!trimmedName) {
    throw new Error('Asset name is required.');
  }

  const result = await client.query(
    `
      update assets
      set name = $3,
          updated_at = now()
      where id = $1 and workspace_id = $2
      returning id,
                workspace_id,
                owner_user_id,
                folder_id,
                name,
                kind,
                mime_type,
                source_type,
                storage_mode,
                storage_key,
                public_url,
                origin_url,
                poster_src,
                thumbnail_url,
                access_scope,
                tags,
                size_bytes,
                width,
                height,
            duration_ms,
            fingerprint,
            font_family,
            metadata,
            created_at
    `,
    [assetId, workspaceId, trimmedName],
  );

  return result.rows[0] ? mapAssetRow(result.rows[0]) : null;
}

export async function deleteAsset(client, { assetId, workspaceId }) {
  const result = await client.query('delete from assets where id = $1 and workspace_id = $2', [assetId, workspaceId]);
  return result.rowCount > 0;
}

export async function saveRemoteAsset(client, { workspaceId, ownerUserId, payload }) {
  const sourceType = normalizeSourceType(payload?.sourceType);
  const storageMode = normalizeStorageMode(payload?.storageMode, sourceType);
  const name = normalizeString(payload?.name);
  const kind = normalizeKind(payload?.kind);
  const accessScope = normalizeAccessScope(payload?.accessScope);
  const folderId = normalizeOptionalText(payload?.folderId);
  const publicUrl = normalizeOptionalText(payload?.publicUrl) || normalizeOptionalText(payload?.src);
  const originUrl = normalizeOptionalText(payload?.originUrl) || (sourceType === 'url' ? publicUrl : null);

  if (!name) throw new Error('Asset name is required.');
  if (!publicUrl) throw new Error('Asset URL is required.');
  if (folderId) {
    const folder = await ensureFolderBelongsToWorkspace(client, { folderId, workspaceId });
    if (!folder) throw new Error('Folder not found.');
  }

  const result = await client.query(
    `
      insert into assets (
        id,
        workspace_id,
        owner_user_id,
        folder_id,
        name,
        kind,
        mime_type,
        source_type,
        storage_mode,
        storage_key,
        public_url,
        origin_url,
        poster_src,
        access_scope,
        tags,
        size_bytes,
        width,
        height,
        duration_ms,
        fingerprint,
        font_family,
        metadata
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15::text[], $16, $17, $18,
        $19, $20, $21, $22::jsonb
      )
      returning id,
                workspace_id,
                owner_user_id,
                folder_id,
                name,
                kind,
                mime_type,
                source_type,
                storage_mode,
                storage_key,
                public_url,
                origin_url,
                poster_src,
                thumbnail_url,
                access_scope,
                tags,
                size_bytes,
                width,
                height,
                duration_ms,
                fingerprint,
                font_family,
                metadata,
                created_at
    `,
    [
      randomUUID(),
      workspaceId,
      ownerUserId,
      folderId,
      name,
      kind,
      normalizeOptionalText(payload?.mimeType),
      sourceType,
      storageMode,
      normalizeOptionalText(payload?.storageKey),
      publicUrl,
      originUrl,
      normalizeOptionalText(payload?.posterSrc),
      accessScope,
      normalizeArray(payload?.tags),
      toBigIntNumber(payload?.sizeBytes),
      toInt(payload?.width),
      toInt(payload?.height),
      toInt(payload?.durationMs),
      normalizeOptionalText(payload?.fingerprint),
      normalizeOptionalText(payload?.fontFamily),
      JSON.stringify(buildAssetMetadataPayload(payload)),
    ],
  );

  return mapAssetRow(result.rows[0]);
}

export async function prepareAssetUpload(client, { workspaceId, ownerUserId, payload, env }) {
  const filename = normalizeString(payload?.filename);
  if (!filename) {
    throw new Error('Filename is required.');
  }
  if (!isR2SigningReady(env)) {
    throw new Error('R2 upload signing is not configured yet.');
  }
  if (!trimBaseUrl(env.assetsPublicBaseUrl)) {
    throw new Error('ASSETS_PUBLIC_BASE_URL is required to prepare uploads.');
  }

  const folderId = normalizeOptionalText(payload?.folderId);
  if (folderId) {
    const folder = await ensureFolderBelongsToWorkspace(client, { folderId, workspaceId });
    if (!folder) throw new Error('Folder not found.');
  }

  const assetId = randomUUID();
  const kind = normalizeKind(payload?.kind);
  const storageKey = createStorageKey({ workspaceId, assetId, filename, kind });
  const publicUrl = buildPublicUrl(env, storageKey);
  const uploadUrl = await signUploadUrl(env, { storageKey, mimeType: payload?.mimeType });
  const expiresAt = new Date(Date.now() + PREPARE_UPLOAD_TTL_SECONDS * 1000);

  await client.query(
    `
      insert into asset_upload_sessions (
        id,
        workspace_id,
        owner_user_id,
        storage_key,
        filename,
        mime_type,
        kind,
        status,
        requested_name,
        folder_id,
        size_bytes,
        expires_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10, $11)
    `,
    [
      assetId,
      workspaceId,
      ownerUserId,
      storageKey,
      filename,
      normalizeOptionalText(payload?.mimeType),
      kind,
      normalizeOptionalText(payload?.requestedName),
      folderId,
      toBigIntNumber(payload?.sizeBytes),
      expiresAt,
    ],
  );

  return {
    assetId,
    name: normalizeString(payload?.requestedName) || filename,
    kind,
    mimeType: normalizeOptionalText(payload?.mimeType) || undefined,
    sizeBytes: toBigIntNumber(payload?.sizeBytes) ?? undefined,
    width: undefined,
    height: undefined,
    durationMs: undefined,
    fingerprint: undefined,
    fontFamily: normalizeOptionalText(payload?.fontFamily) || undefined,
    accessScope: normalizeAccessScope(payload?.accessScope),
    tags: normalizeArray(payload?.tags),
    folderId: folderId || undefined,
    storageMode: 'object-storage',
    storageKey,
    uploadUrl: uploadUrl || undefined,
    publicUrl: publicUrl || undefined,
  };
}

export async function completeAssetUpload(client, { workspaceId, ownerUserId, payload, env }) {
  const assetId = normalizeString(payload?.assetId);
  const storageKey = normalizeString(payload?.storageKey);
  if (!assetId || !storageKey) {
    throw new Error('assetId and storageKey are required.');
  }

  const sessionResult = await client.query(
    `
      select id,
             workspace_id,
             owner_user_id,
             folder_id,
             filename,
             mime_type,
             kind,
             status,
             requested_name,
             size_bytes,
             expires_at,
             storage_key
      from asset_upload_sessions
      where id = $1 and workspace_id = $2
      limit 1
    `,
    [assetId, workspaceId],
  );
  const upload = sessionResult.rows[0];
  if (!upload) {
    throw new Error('Upload session not found.');
  }
  if (upload.owner_user_id !== ownerUserId) {
    throw new Error('Upload session belongs to a different user.');
  }
  if (upload.status === 'expired') {
    throw new Error('Upload session has expired.');
  }
  if (new Date(upload.expires_at).getTime() <= Date.now()) {
    await client.query('update asset_upload_sessions set status = $2 where id = $1', [assetId, 'expired']);
    throw new Error('Upload session has expired.');
  }
  if (upload.storage_key !== storageKey) {
    throw new Error('Upload storage key mismatch.');
  }

  const folderId = normalizeOptionalText(payload?.folderId) || upload.folder_id || null;
  if (folderId) {
    const folder = await ensureFolderBelongsToWorkspace(client, { folderId, workspaceId });
    if (!folder) throw new Error('Folder not found.');
  }

  const kind = normalizeKind(payload?.kind || upload.kind);
  const mimeType = normalizeOptionalText(payload?.mimeType) || upload.mime_type || null;
  const publicUrl = normalizeOptionalText(payload?.publicUrl) || buildPublicUrl(env, storageKey);
  const metadataPayload = buildAssetMetadataPayload(payload);
  const derivatives = normalizeDerivativeSet(metadataPayload.derivatives);
  const posterSrc = normalizeOptionalText(payload?.posterSrc) || derivatives?.poster?.src || null;
  const thumbnailUrl = normalizeOptionalText(payload?.thumbnailUrl) || derivatives?.thumbnail?.src || null;
  const optimizedUrl = normalizeOptionalText(payload?.optimizedUrl) || derivatives?.high?.src || publicUrl;
  const result = await client.query(
    `
      insert into assets (
        id,
        workspace_id,
        owner_user_id,
        folder_id,
        upload_session_id,
        name,
        kind,
        mime_type,
        source_type,
        storage_mode,
        storage_key,
        public_url,
        origin_url,
        poster_src,
        thumbnail_url,
        access_scope,
        tags,
        size_bytes,
        width,
        height,
        duration_ms,
        fingerprint,
        font_family,
        metadata
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17::text[], $18, $19, $20,
        $21, $22, $23, $24::jsonb
      )
      on conflict (id) do update
      set folder_id = excluded.folder_id,
          name = excluded.name,
          kind = excluded.kind,
          mime_type = excluded.mime_type,
          source_type = excluded.source_type,
          storage_mode = excluded.storage_mode,
          storage_key = excluded.storage_key,
          public_url = excluded.public_url,
          origin_url = excluded.origin_url,
          poster_src = excluded.poster_src,
          thumbnail_url = excluded.thumbnail_url,
          access_scope = excluded.access_scope,
          tags = excluded.tags,
          size_bytes = excluded.size_bytes,
          width = excluded.width,
          height = excluded.height,
          duration_ms = excluded.duration_ms,
          fingerprint = excluded.fingerprint,
          font_family = excluded.font_family,
          metadata = excluded.metadata,
          updated_at = now()
      returning id,
                workspace_id,
                owner_user_id,
                folder_id,
                name,
                kind,
                mime_type,
                source_type,
                storage_mode,
                storage_key,
                public_url,
                origin_url,
                poster_src,
                thumbnail_url,
                access_scope,
                tags,
                size_bytes,
                width,
                height,
                duration_ms,
                fingerprint,
                font_family,
                metadata,
                created_at
    `,
    [
      assetId,
      workspaceId,
      ownerUserId,
      folderId,
      assetId,
      normalizeString(payload?.name) || upload.requested_name || upload.filename,
      kind,
      mimeType,
      normalizeSourceType(payload?.sourceType),
      normalizeStorageMode(payload?.storageMode, normalizeSourceType(payload?.sourceType)),
      storageKey,
      publicUrl,
      null,
      posterSrc,
      thumbnailUrl,
      normalizeAccessScope(payload?.accessScope),
      normalizeArray(payload?.tags),
      toBigIntNumber(payload?.sizeBytes) ?? (upload.size_bytes === null || upload.size_bytes === undefined ? null : Number(upload.size_bytes)),
      toInt(payload?.width),
      toInt(payload?.height),
      toInt(payload?.durationMs),
      normalizeOptionalText(payload?.fingerprint) || normalizeOptionalText(payload?.metadata?.fingerprint),
      normalizeOptionalText(payload?.fontFamily),
      JSON.stringify({
        ...metadataPayload,
        optimizedUrl,
      }),
    ],
  );

  await client.query(
    `
      update asset_upload_sessions
      set status = 'ready',
          completed_at = now(),
          folder_id = $2,
          size_bytes = coalesce($3, size_bytes)
      where id = $1
    `,
    [assetId, folderId, toBigIntNumber(payload?.sizeBytes)],
  );

  if (kind === 'video') {
    const mappedAsset = mapAssetRow(result.rows[0]);
    const outputPlan = {
      low: {
        storageKey: `${storageKey.replace(/\.[^.]+$/, '')}-low.mp4`,
        publicUrl: `${publicUrl.replace(/\.[^.]+$/, '')}-low.mp4`,
      },
      mid: {
        storageKey: `${storageKey.replace(/\.[^.]+$/, '')}-mid.mp4`,
        publicUrl: `${publicUrl.replace(/\.[^.]+$/, '')}-mid.mp4`,
      },
      high: {
        storageKey: `${storageKey.replace(/\.[^.]+$/, '')}-high.mp4`,
        publicUrl: `${publicUrl.replace(/\.[^.]+$/, '')}-high.mp4`,
      },
      poster: {
        storageKey: `${storageKey.replace(/\.[^.]+$/, '')}-poster.jpg`,
        publicUrl: `${publicUrl.replace(/\.[^.]+$/, '')}-poster.jpg`,
      },
    };
    await enqueueVideoTranscodeJob(client, {
      workspaceId,
      ownerUserId,
      assetId,
      input: {
        assetId,
        workspaceId,
        storageKey,
        publicUrl,
        mimeType,
        width: mappedAsset.width || null,
        height: mappedAsset.height || null,
        durationMs: mappedAsset.durationMs || null,
        outputPlan,
      },
    });
    await patchAssetMetadata(client, {
      assetId,
      workspaceId,
      metadataPatch: {
        optimization: {
          video: {
            status: 'queued',
            outputs: outputPlan,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    });
  }

  if (isOptimizableRasterImage(kind, mimeType)) {
    const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const baseStorageKey = storageKey.replace(/\.[^.]+$/, '');
    const basePublicUrl = publicUrl.replace(/\.[^.]+$/, '');
    const outputPlan = {
      low: {
        storageKey: `${baseStorageKey}-low.${extension}`,
        publicUrl: `${basePublicUrl}-low.${extension}`,
        maxWidth: 640,
      },
      mid: {
        storageKey: `${baseStorageKey}-mid.${extension}`,
        publicUrl: `${basePublicUrl}-mid.${extension}`,
        maxWidth: 1280,
      },
      high: {
        storageKey: `${baseStorageKey}-high.${extension}`,
        publicUrl: `${basePublicUrl}-high.${extension}`,
        maxWidth: 1920,
      },
      thumbnail: {
        storageKey: `${baseStorageKey}-thumb.${extension}`,
        publicUrl: `${basePublicUrl}-thumb.${extension}`,
        maxWidth: 320,
      },
    };
    await enqueueImageDerivativeJob(client, {
      workspaceId,
      ownerUserId,
      assetId,
      input: {
        assetId,
        workspaceId,
        storageKey,
        publicUrl,
        mimeType,
        width: toInt(payload?.width),
        height: toInt(payload?.height),
        outputPlan,
      },
    });
    await patchAssetMetadata(client, {
      assetId,
      workspaceId,
      metadataPatch: {
        optimization: {
          image: {
            status: 'queued',
            outputs: outputPlan,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    });
  }

  return mapAssetRow(result.rows[0]);
}
