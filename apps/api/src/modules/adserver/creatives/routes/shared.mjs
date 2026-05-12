import { randomUUID } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { detectClickTagInHtml, detectDimensionsInHtml, validateHtml5Bundle } from '@smx/contracts/src/html5-detector.mjs';
import { getPool } from '@smx/db/src/pool.mjs';
import unzipper from 'unzipper';
import { badRequest, forbidden, sendJson, sendNoContent, serviceUnavailable, unauthorized } from '../../../../lib/http.mjs';
import { logWarn } from '../../../../lib/logger.mjs';
import { withReadOnlySession, withSession, hasPermission } from '../../../../lib/session.mjs';
import {
  createCreativeSizeVariant,
  createCreativeSizeVariantsBulk,
  createCreativeIngestion,
  createPublishedCreative,
  createTagBinding,
  deleteCreative,
  finalizePublishedHtml5Creative,
  finalizePublishedHtml5Version,
  getCreative,
  getCreativeIngestion,
  getCreativeSizeVariant,
  getCreativeVersion,
  queueVideoTranscodeForCreativeVersion,
  listCreativeArtifacts,
  listCreativeIngestions,
  listCreativeIngestionsForUser,
  listCreativeSizeVariants,
  listCreatives,
  listCreativesForUser,
  listCreativeVersions,
  listVideoRenditions,
  markHtml5CreativePublishFailed,
  markCreativeIngestionPublishedState,
  markCreativeIngestionStatus,
  normalizeRawClickUrl,
  regenerateVideoRenditions,
  updateCreativeIngestion,
  updateCreative,
  updateCreativeSizeVariant,
  updateCreativeSizeVariantsBulkStatus,
  updateCreativeVersion,
  updateVideoRendition,
  upsertPublishedHtmlArtifact,
} from '@smx/db/src/creatives.mjs';
import { dispatchHtml5ArchivePublishJob } from '@smx/db/src/job-dispatch.mjs';
import {
  deriveTranscodeDisplayStatus,
  getVideoTranscodeJobForVersion,
} from '@smx/db/src/video-transcode-jobs.mjs';

const R2_REGION = 'auto';
const PREPARE_UPLOAD_TTL_SECONDS = 60 * 15;
let cachedR2Client = null;
let cachedR2Key = '';


export async function resolveTargetWorkspaceId(client, userId, fallbackWorkspaceId, requestedWorkspaceId) {
  const candidate = String(requestedWorkspaceId ?? '').trim();
  if (!candidate) return fallbackWorkspaceId;
  const { rowCount } = await client.query(
    `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
    [candidate, userId],
  );
  if (!rowCount) {
    const error = new Error('Not a member of the selected client');
    error.statusCode = 403;
    throw error;
  }
  return candidate;
}

export function trimText(value) {
  return String(value ?? '').trim();
}

export function sanitizeFilename(filename) {
  return trimText(filename).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-160) || 'upload.bin';
}

export function trimBaseUrl(value) {
  return trimText(value).replace(/\/+$/, '');
}

export function normalizeHtmlEntryPath(value) {
  const normalized = trimText(value).replace(/^\/+/, '');
  if (!normalized || normalized.toLowerCase().endsWith('.zip')) return 'index.html';
  return normalized;
}

export function resolveRequestedClickUrl(body, existingValue = null) {
  const sent = body?.clickUrl ?? body?.click_url;
  if (sent === undefined) return existingValue || null;
  return normalizeRawClickUrl(sent);
}

export function resolveCreativeVersionPreviewUrl(row) {
  if (!row) return null;
  const sourceKind = trimText(row.source_kind).toLowerCase();
  const publicUrl = trimText(row.public_url);
  const mimeType = trimText(row.mime_type).toLowerCase();
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const publishedPublicUrl = trimText(metadata?.html5Publish?.publicUrl || metadata?.publishJob?.publicUrl);

  if (sourceKind !== 'html5_zip') return publicUrl;

  const isUnpublishedUrl = (u) => {
    if (!u) return true;
    const lower = u.toLowerCase();
    return lower.endsWith('.zip') || lower.includes('/creative-ingestions/');
  };

  if (!isUnpublishedUrl(publishedPublicUrl)) return publishedPublicUrl;

  if (!isUnpublishedUrl(publicUrl)) {
    if (mimeType.startsWith('text/html') || publicUrl.toLowerCase().endsWith('.html')) {
      return publicUrl;
    }
  }
  return null;
}

export function buildPublishJobState(stage, overrides = {}) {
  return {
    stage,
    progressPercent: 0,
    message: 'Queued for worker pickup…',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function getDbPool(env) {
  const cs = trimText(env.databasePoolUrl || env.databaseUrl);
  return cs ? getPool(cs) : null;
}

export function isValidAbsoluteUrl(value) {
  const normalized = trimText(value);
  if (!normalized) return false;
  try {
    const url = new URL(normalized);
    return Boolean(url.protocol && url.host);
  } catch {
    return false;
  }
}

export function isR2SigningReady(env) {
  return Boolean(
    isValidAbsoluteUrl(env.r2Endpoint)
    && env.r2Bucket
    && env.r2AccessKeyId
    && env.r2SecretAccessKey,
  );
}

export function getR2Client(env) {
  if (!isValidAbsoluteUrl(env.r2Endpoint)) {
    throw new Error('R2_ENDPOINT must be a valid absolute URL.');
  }
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

export function guessHtml5ContentType(filename) {
  const ext = String(filename || '').toLowerCase().split('.').pop();
  const map = {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    mjs: 'application/javascript; charset=utf-8',
    css: 'text/css; charset=utf-8',
    json: 'application/json; charset=utf-8',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
    txt: 'text/plain; charset=utf-8',
  };
  return map[ext] || 'application/octet-stream';
}

export function normalizeHtml5ArchivePath(rawPath) {
  const trimmed = String(rawPath ?? '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!trimmed) return null;
  if (trimmed.startsWith('__MACOSX/') || trimmed.endsWith('.DS_Store')) return null;
  if (trimmed.includes('../') || trimmed.includes('/..')) return null;
  return trimmed;
}

export function stripHtml5ArchiveRoot(paths) {
  const valid = paths.filter(Boolean);
  if (!valid.length) return valid;
  const roots = valid.map((p) => p.split('/')[0]);
  const commonRoot = roots.every((r) => r === roots[0]) ? roots[0] : '';
  if (!commonRoot) return valid;
  const allNested = valid.every((p) => p.startsWith(`${commonRoot}/`));
  if (!allNested) return valid;
  return valid.map((p) => p.slice(commonRoot.length + 1)).filter(Boolean);
}

export function isHtml5TextAsset(filename) {
  const lower = String(filename || '').toLowerCase();
  return (
    lower.endsWith('.html')
    || lower.endsWith('.htm')
    || lower.endsWith('.css')
    || lower.endsWith('.svg')
    || lower.endsWith('.txt')
  );
}

export function buildHtml5BundleAssetSources(entries) {
  return Object.fromEntries(
    entries
      .filter((entry) => isHtml5TextAsset(entry.publishedPath))
      .map((entry) => [entry.publishedPath, entry.body.toString('utf-8')]),
  );
}

export async function publishHtml5ArchiveInProcess(env, pool, {
  ingestionId,
  workspaceId,
  creativeVersionId,
  ingestionStorageKey,
  ingestionPublicUrl,
  creativeVersionEntryPath,
  initialMetadata,
}) {
  let archiveBuffer;
  const r2Client = getR2Client(env);
  if (ingestionStorageKey) {
    try {
      const r2Response = await r2Client.send(new GetObjectCommand({
        Bucket: env.r2Bucket,
        Key: ingestionStorageKey,
      }));
      const chunks = [];
      for await (const chunk of r2Response.Body) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      archiveBuffer = Buffer.concat(chunks);
    } catch (r2Err) {
      logWarn({ event: 'html5_inprocess_r2_download_failed', ingestionId, message: r2Err?.message, fallback: 'cdn_fetch' });
      if (!ingestionPublicUrl) throw new Error('No ZIP URL available for in-process publish.');
      const fetchResponse = await fetch(ingestionPublicUrl);
      if (!fetchResponse.ok) throw new Error(`Failed to download ZIP: ${fetchResponse.status}`);
      archiveBuffer = Buffer.from(await fetchResponse.arrayBuffer());
    }
  } else {
    if (!ingestionPublicUrl) throw new Error('No ZIP URL available for in-process publish.');
    const fetchResponse = await fetch(ingestionPublicUrl);
    if (!fetchResponse.ok) throw new Error(`Failed to download ZIP: ${fetchResponse.status}`);
    archiveBuffer = Buffer.from(await fetchResponse.arrayBuffer());
  }

  const directory = await unzipper.Open.buffer(archiveBuffer);
  const rawEntries = [];
  for (const entry of directory.files || []) {
    if (entry.type !== 'File') continue;
    const archivePath = normalizeHtml5ArchivePath(entry.path);
    if (!archivePath) continue;
    const body = await entry.buffer();
    rawEntries.push({ archivePath, body });
  }
  if (!rawEntries.length) throw new Error('HTML5 archive contains no publishable files.');

  const strippedPaths = stripHtml5ArchiveRoot(rawEntries.map((e) => e.archivePath));
  const entries = rawEntries.map((entry, i) => ({
    ...entry,
    publishedPath: normalizeHtml5ArchivePath(strippedPaths[i]) || entry.archivePath,
  }));

  const desiredEntry = trimText(creativeVersionEntryPath || initialMetadata?.entryPath || 'index.html')
    .replace(/^\//, '') || 'index.html';
  const entryAsset = entries.find((e) => e.publishedPath === desiredEntry)
    || entries.find((e) => e.publishedPath.toLowerCase() === desiredEntry.toLowerCase())
    || entries.find((e) => e.publishedPath.toLowerCase().endsWith('/index.html') || e.publishedPath.toLowerCase() === 'index.html')
    || entries[0];
  if (!entryAsset) throw new Error(`HTML5 archive is missing entry point: ${desiredEntry}`);

  const bundleValidation = validateHtml5Bundle(entryAsset.body.toString('utf-8'), {
    entryPath: entryAsset.publishedPath,
    assetPaths: entries.map((entry) => entry.publishedPath),
    assetSources: buildHtml5BundleAssetSources(entries),
  });
  if (!bundleValidation.ok) {
    throw new Error(`HTML5 archive references missing assets: ${bundleValidation.missingPaths.join(', ')}`);
  }

  const storagePrefix = `workspaces/${workspaceId}/creative-versions/${creativeVersionId}/html5`;
  const publicBase = trimBaseUrl(env.assetsPublicBaseUrl);
  const uploaded = [];

  for (const entry of entries) {
    const storageKey = `${storagePrefix}/${entry.publishedPath}`;
    const contentType = guessHtml5ContentType(entry.publishedPath);
    const isHtml = entry.publishedPath.toLowerCase().endsWith('.html') || entry.publishedPath.toLowerCase().endsWith('.htm');
    await r2Client.send(new PutObjectCommand({
      Bucket: env.r2Bucket,
      Key: storageKey,
      Body: entry.body,
      ContentType: contentType,
      ContentLength: entry.body.length,
      CacheControl: isHtml ? 'no-store, no-cache, must-revalidate' : 'public, max-age=300',
    }));
    uploaded.push({
      ...entry,
      storageKey,
      publicUrl: publicBase ? `${publicBase}/${storageKey}` : null,
      mimeType: contentType,
      sizeBytes: entry.body.length,
    });
  }

  const publishedEntry = uploaded.find((e) => e.publishedPath === entryAsset.publishedPath) || uploaded[0];
  const entryHtmlSource = entryAsset.body ? entryAsset.body.toString('utf-8') : null;
  const detectedClickUrl = detectClickTagInHtml(entryHtmlSource);
  const detectedDimensions = detectDimensionsInHtml(entryHtmlSource);
  const publishMetadata = {
    ...(initialMetadata || {}),
    html5Publish: {
      status: 'completed',
      publishedAt: new Date().toISOString(),
      assetCount: uploaded.length,
      storagePrefix,
      entryPath: publishedEntry.publishedPath,
      publicUrl: publishedEntry.publicUrl,
      ...(detectedClickUrl ? { detectedClickUrl } : {}),
    },
  };

  if (detectedClickUrl) {
    logWarn({ event: 'clicktag_detected_inprocess', ingestionId, detectedClickUrl });
  }

  await finalizePublishedHtml5Version(pool, workspaceId, creativeVersionId, {
    publicUrl: publishedEntry.publicUrl,
    publishedPath: publishedEntry.publishedPath,
    mimeType: publishedEntry.mimeType,
    width: detectedDimensions?.width ?? null,
    height: detectedDimensions?.height ?? null,
    metadata: publishMetadata,
  });

  await finalizePublishedHtml5Creative(pool, workspaceId, creativeVersionId, {
    publicUrl: publishedEntry.publicUrl,
    detectedClickUrl: detectedClickUrl ?? null,
    width: detectedDimensions?.width ?? null,
    height: detectedDimensions?.height ?? null,
  });

  await upsertPublishedHtmlArtifact(pool, workspaceId, creativeVersionId, {
    storageKey: publishedEntry.storageKey,
    publicUrl: publishedEntry.publicUrl,
    mimeType: publishedEntry.mimeType,
    sizeBytes: publishedEntry.sizeBytes,
    metadata: {
      ingestionId,
      assetCount: uploaded.length,
      entryPath: publishedEntry.publishedPath,
      storagePrefix,
    },
  });

  await markCreativeIngestionPublishedState(pool, workspaceId, ingestionId, {
    publishJob: {
      stage: 'completed',
      progressPercent: 100,
      message: 'Published in-process (pgboss unavailable).',
      updatedAt: new Date().toISOString(),
      publicUrl: publishedEntry.publicUrl,
    },
  }, {
    readyToPublish: true,
    published: true,
    publishedPublicUrl: publishedEntry.publicUrl,
  });

  return { publicUrl: publishedEntry.publicUrl, assetCount: uploaded.length };
}

export function buildCreativeStorageKey({ workspaceId, ingestionId, filename }) {
  return `workspaces/${workspaceId}/creative-ingestions/${ingestionId}/${sanitizeFilename(filename)}`;
}

export function buildPublicUrl(env, storageKey) {
  const base = trimBaseUrl(env.assetsPublicBaseUrl);
  return base && storageKey ? `${base}/${storageKey}` : null;
}

export function resolveBaseUrl(ctx) {
  const explicit = trimText(ctx.env.apiBaseUrl || ctx.env.apiPublicBaseUrl || ctx.env.baseUrl);
  if (explicit) return explicit.replace(/\/+$/, '');
  const protocol = trimText(ctx.req.headers['x-forwarded-proto']) || 'https';
  const host = trimText(ctx.req.headers['x-forwarded-host'] || ctx.req.headers.host);
  return host ? `${protocol}://${host}` : 'https://localhost';
}

export function buildCreativeUploadProxyUrl(ctx, ingestionId, workspaceId) {
  const base = resolveBaseUrl(ctx);
  const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
  return `${base}/v1/creative-ingestions/${ingestionId}/upload-proxy${query}`;
}

export function inferStorageKeyFromPublicUrl(env, publicUrl) {
  const base = trimBaseUrl(env.assetsPublicBaseUrl);
  const normalizedUrl = trimText(publicUrl);
  if (!base || !normalizedUrl) return null;
  if (!normalizedUrl.startsWith(`${base}/`)) return null;
  return normalizedUrl.slice(base.length + 1) || null;
}

export async function signUploadUrl(env, { storageKey, mimeType }) {
  if (!isR2SigningReady(env)) return null;
  const command = new PutObjectCommand({
    Bucket: env.r2Bucket,
    Key: storageKey,
    ContentType: trimText(mimeType) || undefined,
  });
  return getSignedUrl(getR2Client(env), command, { expiresIn: PREPARE_UPLOAD_TTL_SECONDS });
}

export async function readBinaryBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function normalizeCreative(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id ?? null,
    workspaceName: row.workspace_name ?? null,
    name: row.name,
    format: normalizeCreativeFormat(row.type),
    type: row.type,
    approvalStatus: row.approval_status,
    clickUrl: row.click_url ?? null,
    thumbnailUrl: row.thumbnail_url ?? row.file_url ?? null,
    previewUrl: row.file_url ?? row.thumbnail_url ?? null,
    fileUrl: row.file_url ?? null,
    fileSize: row.file_size ?? null,
    mimeType: row.mime_type ?? null,
    width: row.width ?? null,
    height: row.height ?? null,
    durationMs: row.duration_ms ?? null,
    transcodeStatus: row.transcode_status ?? null,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    latestVersion: normalizeCreativeVersion(row.latest_version ?? null),
  };
}

export function normalizeCreativeFormat(type) {
  const normalized = String(type ?? '').toLowerCase();
  if (normalized === 'vast' || normalized === 'vast_video' || normalized === 'video') return 'vast_video';
  if (normalized === 'native') return 'native';
  return 'display';
}

export function normalizeTranscodeJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    attempts: row.attempts ?? 0,
    maxAttempts: row.max_attempts ?? 0,
    errorMessage: row.error_message ?? null,
    completedAt: row.completed_at ?? null,
    failedAt: row.failed_at ?? null,
    stalledAt: row.stalled_at ?? null,
    updatedAt: row.updated_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

export function normalizeCreativeVersion(row) {
  if (!row) return null;
  return {
    id: row.id,
    creativeId: row.creative_id,
    versionNumber: row.version_number,
    sourceKind: row.source_kind,
    servingFormat: row.serving_format,
    status: row.status,
    publicUrl: row.public_url ?? null,
    previewUrl: resolveCreativeVersionPreviewUrl(row),
    entryPath: row.entry_path ?? null,
    mimeType: row.mime_type ?? null,
    width: row.width ?? null,
    height: row.height ?? null,
    durationMs: row.duration_ms ?? null,
    fileSize: row.file_size ?? null,
    metadata: row.metadata ?? {},
    createdBy: row.created_by ?? null,
    reviewedBy: row.reviewed_by ?? null,
    reviewedAt: row.reviewed_at ?? null,
    reviewNotes: row.review_notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeCreativeArtifact(row) {
  if (!row) return null;
  return {
    id: row.id,
    creativeVersionId: row.creative_version_id,
    kind: row.kind,
    storageKey: row.storage_key ?? null,
    publicUrl: row.public_url ?? null,
    mimeType: row.mime_type ?? null,
    sizeBytes: row.size_bytes ?? null,
    checksum: row.checksum ?? null,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeCreativeIngestion(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id ?? null,
    workspaceName: row.workspace_name ?? null,
    createdBy: row.created_by ?? null,
    creativeId: row.creative_id ?? null,
    creativeVersionId: row.creative_version_id ?? null,
    sourceKind: row.source_kind,
    status: row.status,
    originalFilename: row.original_filename,
    mimeType: row.mime_type ?? null,
    sizeBytes: row.size_bytes ?? null,
    storageKey: row.storage_key ?? null,
    publicUrl: row.public_url ?? null,
    checksum: row.checksum ?? null,
    metadata: row.metadata ?? {},
    validationReport: row.validation_report ?? {},
    errorCode: row.error_code ?? null,
    errorDetail: row.error_detail ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeTagBinding(row) {
  if (!row) return null;
  return {
    id: row.id,
    tagId: row.tag_id,
    creativeId: row.creative_id,
    creativeVersionId: row.creative_version_id,
    creativeSizeVariantId: row.creative_size_variant_id ?? null,
    status: row.status,
    weight: Number(row.weight || 1),
    startAt: row.start_at ?? null,
    endAt: row.end_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    creativeName: row.creative_name ?? '',
    creativeVersionStatus: row.creative_version_status ?? '',
    sourceKind: row.source_kind ?? '',
    servingFormat: row.serving_format ?? '',
    publicUrl: row.public_url ?? null,
    entryPath: row.entry_path ?? null,
    variantLabel: row.variant_label ?? '',
    variantWidth: row.variant_width ?? null,
    variantHeight: row.variant_height ?? null,
    variantStatus: row.variant_status ?? null,
  };
}

export function normalizeCreativeSizeVariant(row) {
  if (!row) return null;
  return {
    id: row.id,
    creativeVersionId: row.creative_version_id,
    label: row.label,
    width: row.width,
    height: row.height,
    status: row.status,
    publicUrl: row.public_url ?? null,
    artifactId: row.artifact_id ?? null,
    metadata: row.metadata ?? {},
    bindingCount: Number(row.binding_count ?? 0),
    activeBindingCount: Number(row.active_binding_count ?? 0),
    tagNames: Array.isArray(row.tag_names) ? row.tag_names.filter(Boolean) : [],
    totalImpressions: Number(row.total_impressions ?? 0),
    totalClicks: Number(row.total_clicks ?? 0),
    impressions7d: Number(row.impressions_7d ?? 0),
    clicks7d: Number(row.clicks_7d ?? 0),
    ctr: Number(row.ctr ?? 0),
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeVideoRendition(row) {
  if (!row) return null;
  return {
    id: row.id,
    creativeVersionId: row.creative_version_id,
    artifactId: row.artifact_id ?? null,
    label: row.label,
    width: row.width ?? null,
    height: row.height ?? null,
    bitrateKbps: row.bitrate_kbps ?? null,
    codec: row.codec ?? null,
    mimeType: row.mime_type ?? null,
    status: row.status,
    isSource: Boolean(row.is_source),
    sortOrder: row.sort_order ?? 0,
    publicUrl: row.public_url ?? null,
    storageKey: row.storage_key ?? null,
    sizeBytes: row.size_bytes ?? null,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object ?? {}, key);
}

export function normalizeOptionalPositiveInteger(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
}

export { randomUUID, PutObjectCommand };

export {
  badRequest,
  forbidden,
  sendJson,
  sendNoContent,
  serviceUnavailable,
  unauthorized,
  logWarn,
  withReadOnlySession,
  withSession,
  hasPermission,
  createCreativeSizeVariant,
  createCreativeSizeVariantsBulk,
  createCreativeIngestion,
  createPublishedCreative,
  createTagBinding,
  deleteCreative,
  finalizePublishedHtml5Creative,
  finalizePublishedHtml5Version,
  getCreative,
  getCreativeIngestion,
  getCreativeSizeVariant,
  getCreativeVersion,
  queueVideoTranscodeForCreativeVersion,
  listCreativeArtifacts,
  listCreativeIngestions,
  listCreativeIngestionsForUser,
  listCreativeSizeVariants,
  listCreatives,
  listCreativesForUser,
  listCreativeVersions,
  listVideoRenditions,
  markHtml5CreativePublishFailed,
  markCreativeIngestionPublishedState,
  markCreativeIngestionStatus,
  normalizeRawClickUrl,
  regenerateVideoRenditions,
  updateCreativeIngestion,
  updateCreative,
  updateCreativeSizeVariant,
  updateCreativeSizeVariantsBulkStatus,
  updateCreativeVersion,
  updateVideoRendition,
  upsertPublishedHtmlArtifact,
  dispatchHtml5ArchivePublishJob,
  deriveTranscodeDisplayStatus,
  getVideoTranscodeJobForVersion,
};
