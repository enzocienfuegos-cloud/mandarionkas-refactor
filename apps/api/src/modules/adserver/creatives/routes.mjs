import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { badRequest, forbidden, sendJson, serviceUnavailable, unauthorized } from '../../../lib/http.mjs';
import { requireAuthenticatedSession } from '../../auth/service.mjs';
import {
  createCreativeSizeVariant,
  createCreativeSizeVariantsBulk,
  createCreativeIngestion,
  createPublishedCreative,
  createTagBinding,
  deleteCreative,
  getCreative,
  getCreativeIngestion,
  getCreativeSizeVariant,
  getCreativeVersion,
  queueVideoTranscodeForCreativeVersion,
  listPendingReviewCreativeVersions,
  listCreativeArtifacts,
  listCreativeIngestions,
  listCreativeIngestionsForUser,
  listCreativeSizeVariants,
  listCreatives,
  listCreativesForUser,
  listCreativeVersions,
  listVideoRenditions,
  regenerateVideoRenditions,
  updateCreativeIngestion,
  updateCreative,
  updateCreativeSizeVariant,
  updateCreativeSizeVariantsBulkStatus,
  updateCreativeVersion,
  updateVideoRendition,
} from '../../../../../../packages/db/src/creatives.mjs';

const R2_REGION = 'auto';
const PREPARE_UPLOAD_TTL_SECONDS = 60 * 15;
let cachedR2Client = null;
let cachedR2Key = '';

async function withSession(ctx, callback) {
  const session = await requireAuthenticatedSession({ env: ctx.env, headers: ctx.req.headers });
  if (!session.ok) {
    if (session.statusCode === 503) return serviceUnavailable(ctx.res, ctx.requestId, session.message);
    if (session.statusCode === 401) return unauthorized(ctx.res, ctx.requestId, session.message);
    return false;
  }
  try {
    return await callback(session);
  } finally {
    await session.finish();
  }
}

async function resolveTargetWorkspaceId(client, userId, fallbackWorkspaceId, requestedWorkspaceId) {
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

function trimText(value) {
  return String(value ?? '').trim();
}

function sanitizeFilename(filename) {
  return trimText(filename).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-160) || 'upload.bin';
}

function trimBaseUrl(value) {
  return trimText(value).replace(/\/+$/, '');
}

function isR2SigningReady(env) {
  return Boolean(env.r2Endpoint && env.r2Bucket && env.r2AccessKeyId && env.r2SecretAccessKey);
}

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

function buildCreativeStorageKey({ workspaceId, ingestionId, filename }) {
  return `workspaces/${workspaceId}/creative-ingestions/${ingestionId}/${sanitizeFilename(filename)}`;
}

function buildPublicUrl(env, storageKey) {
  const base = trimBaseUrl(env.assetsPublicBaseUrl);
  return base && storageKey ? `${base}/${storageKey}` : null;
}

async function signUploadUrl(env, { storageKey, mimeType }) {
  if (!isR2SigningReady(env)) return null;
  const command = new PutObjectCommand({
    Bucket: env.r2Bucket,
    Key: storageKey,
    ContentType: trimText(mimeType) || undefined,
  });
  return getSignedUrl(getR2Client(env), command, { expiresIn: PREPARE_UPLOAD_TTL_SECONDS });
}

function normalizeCreative(row) {
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

function normalizeCreativeFormat(type) {
  const normalized = String(type ?? '').toLowerCase();
  if (normalized === 'vast' || normalized === 'vast_video' || normalized === 'video') return 'vast_video';
  if (normalized === 'native') return 'native';
  return 'display';
}

function normalizeCreativeVersion(row) {
  if (!row) return null;
  return {
    id: row.id,
    creativeId: row.creative_id,
    versionNumber: row.version_number,
    sourceKind: row.source_kind,
    servingFormat: row.serving_format,
    status: row.status,
    publicUrl: row.public_url ?? null,
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

function normalizeCreativeArtifact(row) {
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

function normalizeCreativeIngestion(row) {
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

function normalizeTagBinding(row) {
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

function normalizeCreativeSizeVariant(row) {
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

function normalizeVideoRendition(row) {
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

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object ?? {}, key);
}

function normalizeOptionalPositiveInteger(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
}

function hasPermission(session, permission) {
  return session.permissions.includes(permission);
}

export async function handleCreativeRoutes(ctx) {
  const { method, pathname, res, requestId, url } = ctx;

  if (method === 'GET' && pathname === '/v1/creatives') {
    return withSession(ctx, async (session) => {
      const scope = url.searchParams.get('scope');
      const workspaceFilter = url.searchParams.get('workspaceId') || url.searchParams.get('clientId');
      const includeLatestVersion = ['1', 'true', 'yes'].includes(String(url.searchParams.get('includeLatestVersion') || '').toLowerCase());
      const creatives = scope === 'all'
        ? await listCreativesForUser(session.client, session.user.id, {
          workspaceId: workspaceFilter,
          approval_status: url.searchParams.get('approvalStatus') || url.searchParams.get('status'),
          type: url.searchParams.get('type') || url.searchParams.get('format'),
          limit: url.searchParams.get('limit'),
          offset: url.searchParams.get('offset'),
          search: url.searchParams.get('search'),
          includeLatestVersion,
        })
        : await listCreatives(session.client, session.session.activeWorkspaceId, {
          approval_status: url.searchParams.get('approvalStatus') || url.searchParams.get('status'),
          type: url.searchParams.get('type') || url.searchParams.get('format'),
          limit: url.searchParams.get('limit'),
          offset: url.searchParams.get('offset'),
          search: url.searchParams.get('search'),
          includeLatestVersion,
        });
      return sendJson(res, 200, { creatives: creatives.map(normalizeCreative), requestId });
    });
  }

  if (method === 'GET' && /^\/v1\/creatives\/[^/]+\/versions$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const creativeId = pathname.split('/')[3];
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      const creative = await getCreative(session.client, workspaceId, creativeId);
      if (!creative) return badRequest(res, requestId, 'Creative not found.');
      const versions = await listCreativeVersions(session.client, workspaceId, creativeId);
      return sendJson(res, 200, { versions: versions.map(normalizeCreativeVersion), requestId });
    });
  }

  if (method === 'PUT' && /^\/v1\/creatives\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to update creatives.');
      }
      const creativeId = pathname.split('/')[3];
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        ctx.body?.workspaceId || ctx.body?.workspace_id || url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      const creative = await updateCreative(session.client, workspaceId, creativeId, {
        name: ctx.body?.name,
        click_url: ctx.body?.clickUrl ?? ctx.body?.click_url,
      });
      if (!creative) return badRequest(res, requestId, 'Creative not found.');
      return sendJson(res, 200, { creative: normalizeCreative(creative), requestId });
    });
  }

  if (method === 'DELETE' && /^\/v1\/creatives\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:delete')) {
        return forbidden(res, requestId, 'You do not have permission to delete creatives.');
      }
      const creativeId = pathname.split('/')[3];
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      const deleted = await deleteCreative(session.client, workspaceId, creativeId);
      if (!deleted) return badRequest(res, requestId, 'Creative not found.');
      res.statusCode = 204;
      res.end();
      return true;
    });
  }

  if (method === 'GET' && /^\/v1\/creative-versions\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const versionId = pathname.split('/')[3];
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      const creativeVersion = await getCreativeVersion(session.client, workspaceId, versionId);
      if (!creativeVersion) return badRequest(res, requestId, 'Creative version not found.');
      const artifacts = await listCreativeArtifacts(session.client, workspaceId, versionId);
      const variants = await listCreativeSizeVariants(session.client, workspaceId, versionId);
      const videoRenditions = await listVideoRenditions(session.client, workspaceId, versionId);
      return sendJson(res, 200, {
        creativeVersion: normalizeCreativeVersion(creativeVersion),
        artifacts: artifacts.map(normalizeCreativeArtifact),
        variants: variants.map(normalizeCreativeSizeVariant),
        videoRenditions: videoRenditions.map(normalizeVideoRendition),
        requestId,
      });
    });
  }

  if (method === 'GET' && /^\/v1\/creative-versions\/[^/]+\/variants$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const versionId = pathname.split('/')[3];
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      const creativeVersion = await getCreativeVersion(session.client, workspaceId, versionId);
      if (!creativeVersion) return badRequest(res, requestId, 'Creative version not found.');
      const variants = await listCreativeSizeVariants(session.client, workspaceId, versionId);
      return sendJson(res, 200, { variants: variants.map(normalizeCreativeSizeVariant), requestId });
    });
  }

  if (method === 'POST' && /^\/v1\/creative-versions\/[^/]+\/variants$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to create creative variants.');
      }
      const versionId = pathname.split('/')[3];
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        ctx.body?.workspaceId || ctx.body?.workspace_id || url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      const creativeVersion = await getCreativeVersion(session.client, workspaceId, versionId);
      if (!creativeVersion) return badRequest(res, requestId, 'Creative version not found.');
      try {
        const variant = await createCreativeSizeVariant(session.client, {
          workspaceId,
          creativeVersionId: versionId,
          label: ctx.body?.label,
          width: ctx.body?.width,
          height: ctx.body?.height,
          status: ctx.body?.status,
          publicUrl: ctx.body?.publicUrl ?? ctx.body?.public_url,
          artifactId: ctx.body?.artifactId ?? ctx.body?.artifact_id,
          metadata: ctx.body?.metadata,
          createdBy: session.user.id,
        });
        return sendJson(res, 200, { variant: normalizeCreativeSizeVariant(variant), requestId });
      } catch (error) {
        return badRequest(res, requestId, error?.message || 'Failed to create creative variant.');
      }
    });
  }

  if (method === 'POST' && /^\/v1\/creative-versions\/[^/]+\/variants\/bulk$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to create creative variants.');
      }
      const versionId = pathname.split('/')[3];
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        ctx.body?.workspaceId || ctx.body?.workspace_id || url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      const creativeVersion = await getCreativeVersion(session.client, workspaceId, versionId);
      if (!creativeVersion) return badRequest(res, requestId, 'Creative version not found.');
      const variants = Array.isArray(ctx.body?.variants) ? ctx.body.variants : [];
      try {
        const result = await createCreativeSizeVariantsBulk(session.client, {
          workspaceId,
          creativeVersionId: versionId,
          variants,
          status: ctx.body?.status,
          publicUrl: ctx.body?.publicUrl ?? ctx.body?.public_url,
          createdBy: session.user.id,
        });
        return sendJson(res, 200, {
          created: result.created.map(normalizeCreativeSizeVariant),
          variants: result.variants.map(normalizeCreativeSizeVariant),
          skippedCount: result.skippedCount,
          requestId,
        });
      } catch (error) {
        return badRequest(res, requestId, error?.message || 'Failed to create creative variants.');
      }
    });
  }

  if (method === 'PATCH' && /^\/v1\/creative-versions\/[^/]+\/variants\/status$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to update creative variants.');
      }
      const versionId = pathname.split('/')[3];
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        ctx.body?.workspaceId || ctx.body?.workspace_id || url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      const creativeVersion = await getCreativeVersion(session.client, workspaceId, versionId);
      if (!creativeVersion) return badRequest(res, requestId, 'Creative version not found.');
      const variantIds = Array.isArray(ctx.body?.variantIds)
        ? ctx.body.variantIds
        : Array.isArray(ctx.body?.variant_ids)
          ? ctx.body.variant_ids
          : [];
      const variants = await updateCreativeSizeVariantsBulkStatus(
        session.client,
        workspaceId,
        versionId,
        variantIds,
        ctx.body?.status,
      );
      return sendJson(res, 200, { variants: variants.map(normalizeCreativeSizeVariant), requestId });
    });
  }

  if (method === 'GET' && /^\/v1\/creative-versions\/[^/]+\/video-renditions$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const versionId = pathname.split('/')[3];
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      const creativeVersion = await getCreativeVersion(session.client, workspaceId, versionId);
      if (!creativeVersion) return badRequest(res, requestId, 'Creative version not found.');
      const renditions = await listVideoRenditions(session.client, workspaceId, versionId);
      return sendJson(res, 200, { renditions: renditions.map(normalizeVideoRendition), requestId });
    });
  }

  if (method === 'POST' && /^\/v1\/creative-versions\/[^/]+\/video-renditions\/regenerate$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to regenerate video renditions.');
      }
      const versionId = pathname.split('/')[3];
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        ctx.body?.workspaceId || ctx.body?.workspace_id || url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      const creativeVersion = await getCreativeVersion(session.client, workspaceId, versionId);
      if (!creativeVersion) return badRequest(res, requestId, 'Creative version not found.');
      const creative = await getCreative(session.client, workspaceId, creativeVersion.creative_id);
      const artifacts = await listCreativeArtifacts(session.client, workspaceId, versionId);
      const sourceArtifact = artifacts.find((artifact) => artifact.kind === 'video_mp4') || artifacts[0] || null;
      const renditions = await regenerateVideoRenditions(session.client, workspaceId, versionId);
      if (creativeVersion.source_kind === 'video_mp4' && sourceArtifact?.storage_key && creativeVersion.public_url) {
        await queueVideoTranscodeForCreativeVersion(session.client, {
          workspaceId,
          creativeId: creativeVersion.creative_id,
          creativeVersionId: versionId,
          createdBy: session.user.id,
          creativeName: creative?.name || sourceArtifact?.metadata?.originalFilename || 'Video creative',
          mimeType: creativeVersion.mime_type || sourceArtifact?.mime_type || 'video/mp4',
          storageKey: sourceArtifact.storage_key,
          publicUrl: creativeVersion.public_url,
          sizeBytes: creativeVersion.file_size ?? sourceArtifact?.size_bytes ?? null,
          width: creativeVersion.width ?? null,
          height: creativeVersion.height ?? null,
          durationMs: creativeVersion.duration_ms ?? null,
        });
      }
      return sendJson(res, 200, { renditions: renditions.map(normalizeVideoRendition), requestId });
    });
  }

  if (method === 'GET' && pathname === '/v1/creative-versions/pending-review') {
    return withSession(ctx, async (session) => {
      const creativeVersions = await listPendingReviewCreativeVersions(session.client, session.user.id);
      return sendJson(res, 200, {
        creativeVersions: creativeVersions.map(normalizeCreativeVersion),
        requestId,
      });
    });
  }

  if (method === 'PATCH' && /^\/v1\/creative-versions\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to update creative versions.');
      }
      const versionId = pathname.split('/')[3];
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        ctx.body?.workspaceId || ctx.body?.workspace_id || url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      const creativeVersion = await updateCreativeVersion(session.client, workspaceId, versionId, {
        status: ctx.body?.status,
        metadata: ctx.body?.metadata,
        reviewed_by: ctx.body?.reviewedBy ?? ctx.body?.reviewed_by,
        reviewed_at: ctx.body?.reviewedAt ?? ctx.body?.reviewed_at,
        review_notes: ctx.body?.reviewNotes ?? ctx.body?.review_notes,
      });
      if (!creativeVersion) return badRequest(res, requestId, 'Creative version not found.');
      return sendJson(res, 200, { creativeVersion: normalizeCreativeVersion(creativeVersion), requestId });
    });
  }

  if (method === 'POST' && /^\/v1\/creative-versions\/[^/]+\/submit$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to submit creative versions.');
      }
      const versionId = pathname.split('/')[3];
      const creativeVersion = await updateCreativeVersion(session.client, session.session.activeWorkspaceId, versionId, {
        status: 'pending_review',
      });
      if (!creativeVersion) return badRequest(res, requestId, 'Creative version not found.');
      return sendJson(res, 200, { creativeVersion: normalizeCreativeVersion(creativeVersion), requestId });
    });
  }

  if (method === 'POST' && /^\/v1\/creative-versions\/[^/]+\/approve$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to approve creative versions.');
      }
      const versionId = pathname.split('/')[3];
      const creativeVersion = await updateCreativeVersion(session.client, session.session.activeWorkspaceId, versionId, {
        status: 'approved',
        reviewed_by: session.user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: ctx.body?.notes ?? null,
      });
      if (!creativeVersion) return badRequest(res, requestId, 'Creative version not found.');
      return sendJson(res, 200, { creativeVersion: normalizeCreativeVersion(creativeVersion), requestId });
    });
  }

  if (method === 'POST' && /^\/v1\/creative-versions\/[^/]+\/reject$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to reject creative versions.');
      }
      const versionId = pathname.split('/')[3];
      const creativeVersion = await updateCreativeVersion(session.client, session.session.activeWorkspaceId, versionId, {
        status: 'rejected',
        reviewed_by: session.user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: ctx.body?.reason ?? null,
      });
      if (!creativeVersion) return badRequest(res, requestId, 'Creative version not found.');
      return sendJson(res, 200, { creativeVersion: normalizeCreativeVersion(creativeVersion), requestId });
    });
  }

  if (method === 'GET' && pathname === '/v1/creative-ingestions') {
    return withSession(ctx, async (session) => {
      const scope = url.searchParams.get('scope');
      const workspaceFilter = url.searchParams.get('workspaceId') || url.searchParams.get('clientId');
      const ingestions = scope === 'all'
        ? await listCreativeIngestionsForUser(session.client, session.user.id, {
          workspaceId: workspaceFilter,
          status: url.searchParams.get('status'),
          sourceKind: url.searchParams.get('sourceKind'),
          limit: url.searchParams.get('limit'),
          offset: url.searchParams.get('offset'),
        })
        : await listCreativeIngestions(session.client, session.session.activeWorkspaceId, {
          status: url.searchParams.get('status'),
          sourceKind: url.searchParams.get('sourceKind'),
          limit: url.searchParams.get('limit'),
          offset: url.searchParams.get('offset'),
        });
      return sendJson(res, 200, { ingestions: ingestions.map(normalizeCreativeIngestion), requestId });
    });
  }

  if (method === 'GET' && /^\/v1\/creative-ingestions\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const ingestionId = pathname.split('/')[3];
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      const ingestion = await getCreativeIngestion(session.client, workspaceId, ingestionId);
      if (!ingestion) return badRequest(res, requestId, 'Creative ingestion not found.');
      return sendJson(res, 200, { ingestion: normalizeCreativeIngestion(ingestion), requestId });
    });
  }

  if (method === 'POST' && pathname === '/v1/creative-ingestions/upload-url') {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:create')) {
        return forbidden(res, requestId, 'You do not have permission to upload creatives.');
      }
      if (!isR2SigningReady(ctx.env)) {
        return badRequest(res, requestId, 'Creative uploads are not configured yet.');
      }
      if (!trimBaseUrl(ctx.env.assetsPublicBaseUrl)) {
        return badRequest(res, requestId, 'ASSETS_PUBLIC_BASE_URL is required to prepare creative uploads.');
      }

      const filename = trimText(ctx.body?.filename);
      const sourceKind = trimText(ctx.body?.sourceKind || ctx.body?.source_kind).toLowerCase();
      if (!filename) return badRequest(res, requestId, 'Filename is required.');
      if (!['html5_zip', 'video_mp4'].includes(sourceKind)) {
        return badRequest(res, requestId, 'sourceKind must be html5_zip or video_mp4.');
      }

      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        ctx.body?.workspaceId || ctx.body?.workspace_id || url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      const ingestionId = randomUUID();
      const storageKey = buildCreativeStorageKey({ workspaceId, ingestionId, filename });
      const publicUrl = buildPublicUrl(ctx.env, storageKey);
      const uploadUrl = await signUploadUrl(ctx.env, {
        storageKey,
        mimeType: ctx.body?.mimeType || ctx.body?.mime_type,
      });
      const ingestion = await createCreativeIngestion(session.client, {
        id: ingestionId,
        workspaceId,
        createdBy: session.user.id,
        sourceKind,
        status: 'uploaded',
        originalFilename: filename,
        mimeType: ctx.body?.mimeType || ctx.body?.mime_type || null,
        sizeBytes: ctx.body?.sizeBytes ?? ctx.body?.size_bytes ?? null,
        storageKey,
        publicUrl,
        metadata: {
          requestedName: trimText(ctx.body?.name) || null,
          clickUrl: trimText(ctx.body?.clickUrl ?? ctx.body?.click_url) || null,
          width: normalizeOptionalPositiveInteger(ctx.body?.width),
          height: normalizeOptionalPositiveInteger(ctx.body?.height),
          durationMs: normalizeOptionalPositiveInteger(ctx.body?.durationMs ?? ctx.body?.duration_ms),
        },
      });
      return sendJson(res, 200, {
        ingestion: normalizeCreativeIngestion(ingestion),
        upload: { ingestionId, storageKey, uploadUrl, publicUrl },
        requestId,
      });
    });
  }

  if (method === 'POST' && /^\/v1\/creative-ingestions\/[^/]+\/complete$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:create')) {
        return forbidden(res, requestId, 'You do not have permission to complete creative uploads.');
      }
      const ingestionId = pathname.split('/')[3];
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        ctx.body?.workspaceId || ctx.body?.workspace_id || url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      const existing = await getCreativeIngestion(session.client, workspaceId, ingestionId);
      if (!existing) return badRequest(res, requestId, 'Creative ingestion not found.');
      const ingestion = await updateCreativeIngestion(session.client, workspaceId, ingestionId, {
        original_filename: trimText(ctx.body?.filename) || existing.original_filename,
        mime_type: trimText(ctx.body?.mimeType || ctx.body?.mime_type) || existing.mime_type,
        size_bytes: ctx.body?.sizeBytes ?? ctx.body?.size_bytes ?? existing.size_bytes,
        public_url: trimText(ctx.body?.publicUrl || ctx.body?.public_url) || existing.public_url,
        storage_key: trimText(ctx.body?.storageKey || ctx.body?.storage_key) || existing.storage_key,
        status: 'validated',
        metadata: {
          ...(existing.metadata || {}),
          requestedName: trimText(ctx.body?.name) || existing.metadata?.requestedName || null,
          clickUrl: trimText(ctx.body?.clickUrl ?? ctx.body?.click_url) || existing.metadata?.clickUrl || null,
          width: normalizeOptionalPositiveInteger(ctx.body?.width) ?? existing.metadata?.width ?? null,
          height: normalizeOptionalPositiveInteger(ctx.body?.height) ?? existing.metadata?.height ?? null,
          durationMs: normalizeOptionalPositiveInteger(ctx.body?.durationMs ?? ctx.body?.duration_ms) ?? existing.metadata?.durationMs ?? null,
        },
        validation_report: {
          completed: true,
          readyToPublish: true,
        },
      });
      return sendJson(res, 200, { ingestion: normalizeCreativeIngestion(ingestion), requestId });
    });
  }

  if (method === 'POST' && /^\/v1\/creative-ingestions\/[^/]+\/publish$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:create')) {
        return forbidden(res, requestId, 'You do not have permission to publish creatives.');
      }
      const ingestionId = pathname.split('/')[3];
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        ctx.body?.workspaceId || ctx.body?.workspace_id || url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      const existing = await getCreativeIngestion(session.client, workspaceId, ingestionId);
      if (!existing) return badRequest(res, requestId, 'Creative ingestion not found.');

      if (existing.creative_id && existing.creative_version_id && existing.status === 'published') {
        const creative = await getCreative(session.client, workspaceId, existing.creative_id);
        const creativeVersion = await getCreativeVersion(session.client, workspaceId, existing.creative_version_id);
        return sendJson(res, 200, {
          ingestion: normalizeCreativeIngestion(existing),
          creative: normalizeCreative(creative),
          creativeVersion: normalizeCreativeVersion(creativeVersion),
          queued: false,
          processing: false,
          requestId,
        });
      }

      const result = await createPublishedCreative(session.client, {
        workspaceId,
        createdBy: session.user.id,
        ingestionId,
        sourceKind: existing.source_kind,
        name: trimText(ctx.body?.name) || existing.metadata?.requestedName || existing.original_filename,
        clickUrl: trimText(ctx.body?.clickUrl ?? ctx.body?.click_url) || existing.metadata?.clickUrl || null,
        publicUrl: existing.public_url,
        storageKey: existing.storage_key,
        originalFilename: existing.original_filename,
        mimeType: existing.mime_type,
        sizeBytes: existing.size_bytes,
        width: normalizeOptionalPositiveInteger(ctx.body?.width) ?? existing.metadata?.width ?? null,
        height: normalizeOptionalPositiveInteger(ctx.body?.height) ?? existing.metadata?.height ?? null,
        durationMs: normalizeOptionalPositiveInteger(ctx.body?.durationMs ?? ctx.body?.duration_ms) ?? existing.metadata?.durationMs ?? null,
        metadata: existing.metadata || {},
      });
      return sendJson(res, 200, {
        ingestion: normalizeCreativeIngestion(result.ingestion),
        creative: normalizeCreative(result.creative),
        creativeVersion: normalizeCreativeVersion(result.creativeVersion),
        queued: Boolean(result.transcode?.queued),
        processing: Boolean(result.transcode?.queued),
        transcode: result.transcode ?? null,
        requestId,
      });
    });
  }

  if (method === 'POST' && /^\/v1\/creative-versions\/[^/]+\/assign\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to assign creatives.');
      }
      const versionId = pathname.split('/')[3];
      const tagId = pathname.split('/')[5];
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        ctx.body?.workspaceId || ctx.body?.workspace_id || url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      const creativeVersion = await getCreativeVersion(session.client, workspaceId, versionId);
      if (!creativeVersion) return badRequest(res, requestId, 'Creative version not found.');
      const binding = await createTagBinding(session.client, {
        workspaceId,
        tagId,
        creativeVersionId: versionId,
        status: ctx.body?.status,
        weight: ctx.body?.weight,
        createdBy: session.user.id,
      });
      return sendJson(res, 200, { binding: normalizeTagBinding(binding), requestId });
    });
  }

  if (method === 'PATCH' && /^\/v1\/creative-variants\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to update creative variants.');
      }
      const variantId = pathname.split('/')[3];
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        ctx.body?.workspaceId || ctx.body?.workspace_id || url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      try {
        const variant = await updateCreativeSizeVariant(session.client, workspaceId, variantId, {
          ...(hasOwn(ctx.body, 'label') ? { label: ctx.body?.label } : {}),
          ...(hasOwn(ctx.body, 'width') ? { width: ctx.body?.width } : {}),
          ...(hasOwn(ctx.body, 'height') ? { height: ctx.body?.height } : {}),
          ...(hasOwn(ctx.body, 'status') ? { status: ctx.body?.status } : {}),
          ...(hasOwn(ctx.body, 'publicUrl') || hasOwn(ctx.body, 'public_url') ? { public_url: ctx.body?.publicUrl ?? ctx.body?.public_url } : {}),
          ...(hasOwn(ctx.body, 'artifactId') || hasOwn(ctx.body, 'artifact_id') ? { artifact_id: ctx.body?.artifactId ?? ctx.body?.artifact_id } : {}),
          ...(hasOwn(ctx.body, 'metadata') ? { metadata: ctx.body?.metadata } : {}),
        });
        if (!variant) return badRequest(res, requestId, 'Creative variant not found.');
        return sendJson(res, 200, { variant: normalizeCreativeSizeVariant(variant), requestId });
      } catch (error) {
        return badRequest(res, requestId, error?.message || 'Failed to update creative variant.');
      }
    });
  }

  if (method === 'POST' && /^\/v1\/creative-variants\/[^/]+\/assign\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to assign creative variants.');
      }
      const variantId = pathname.split('/')[3];
      const tagId = pathname.split('/')[5];
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        ctx.body?.workspaceId || ctx.body?.workspace_id || url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      const variant = await getCreativeSizeVariant(session.client, workspaceId, variantId);
      if (!variant) return badRequest(res, requestId, 'Creative variant not found.');
      const binding = await createTagBinding(session.client, {
        workspaceId,
        tagId,
        creativeVersionId: variant.creative_version_id,
        creativeSizeVariantId: variant.id,
        status: ctx.body?.status,
        weight: ctx.body?.weight,
        createdBy: session.user.id,
      });
      return sendJson(res, 200, { binding: normalizeTagBinding(binding), requestId });
    });
  }

  if (method === 'PATCH' && /^\/v1\/video-renditions\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to update video renditions.');
      }
      const renditionId = pathname.split('/')[3];
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        ctx.body?.workspaceId || ctx.body?.workspace_id || url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
      );
      const rendition = await updateVideoRendition(session.client, workspaceId, renditionId, {
        ...(hasOwn(ctx.body, 'label') ? { label: ctx.body?.label } : {}),
        ...(hasOwn(ctx.body, 'status') ? { status: ctx.body?.status } : {}),
        ...(hasOwn(ctx.body, 'sortOrder') || hasOwn(ctx.body, 'sort_order') ? { sort_order: ctx.body?.sortOrder ?? ctx.body?.sort_order } : {}),
        ...(hasOwn(ctx.body, 'metadata') ? { metadata: ctx.body?.metadata } : {}),
      });
      if (!rendition) return badRequest(res, requestId, 'Video rendition not found.');
      return sendJson(res, 200, { rendition: normalizeVideoRendition(rendition), requestId });
    });
  }

  return false;
}
