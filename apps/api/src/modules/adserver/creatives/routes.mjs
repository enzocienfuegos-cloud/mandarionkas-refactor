import { badRequest, forbidden, notImplemented, sendJson, serviceUnavailable, unauthorized } from '../../../lib/http.mjs';
import { requireAuthenticatedSession } from '../../auth/service.mjs';
import {
  deleteCreative,
  getCreative,
  getCreativeIngestion,
  getCreativeVersion,
  listPendingReviewCreativeVersions,
  listCreativeArtifacts,
  listCreativeIngestions,
  listCreativeIngestionsForUser,
  listCreatives,
  listCreativesForUser,
  listCreativeVersions,
  updateCreative,
  updateCreativeVersion,
} from '../../../../../../packages/db/src/creatives.mjs';

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
    `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
    [candidate, userId],
  );
  if (!rowCount) {
    const error = new Error('Not a member of the selected client');
    error.statusCode = 403;
    throw error;
  }
  return candidate;
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
      return sendJson(res, 200, {
        creativeVersion: normalizeCreativeVersion(creativeVersion),
        artifacts: artifacts.map(normalizeCreativeArtifact),
        variants: [],
        videoRenditions: [],
        requestId,
      });
    });
  }

  if (method === 'GET' && /^\/v1\/creative-versions\/[^/]+\/variants$/.test(pathname)) {
    return withSession(ctx, async () => sendJson(res, 200, { variants: [], requestId }));
  }

  if (method === 'POST' && /^\/v1\/creative-versions\/[^/]+\/variants$/.test(pathname)) {
    return withSession(ctx, async () => notImplemented(res, requestId, pathname, 'Creative variant authoring is the next creatives subdomain to port.'));
  }

  if (method === 'POST' && /^\/v1\/creative-versions\/[^/]+\/variants\/bulk$/.test(pathname)) {
    return withSession(ctx, async () => notImplemented(res, requestId, pathname, 'Bulk creative variant authoring is not ported yet.'));
  }

  if (method === 'PATCH' && /^\/v1\/creative-versions\/[^/]+\/variants\/status$/.test(pathname)) {
    return withSession(ctx, async () => notImplemented(res, requestId, pathname, 'Bulk creative variant status changes are not ported yet.'));
  }

  if (method === 'GET' && /^\/v1\/creative-versions\/[^/]+\/video-renditions$/.test(pathname)) {
    return withSession(ctx, async () => sendJson(res, 200, { renditions: [], requestId }));
  }

  if (method === 'POST' && /^\/v1\/creative-versions\/[^/]+\/video-renditions\/regenerate$/.test(pathname)) {
    return withSession(ctx, async () => notImplemented(res, requestId, pathname, 'Video transcoding orchestration has not been ported yet.'));
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
    return withSession(ctx, async () => notImplemented(res, requestId, pathname, 'Signed upload URL generation will be ported with the ingestion publish workflow.'));
  }

  if (method === 'POST' && /^\/v1\/creative-ingestions\/[^/]+\/complete$/.test(pathname)) {
    return withSession(ctx, async () => notImplemented(res, requestId, pathname, 'Creative ingestion completion is not ported yet.'));
  }

  if (method === 'POST' && /^\/v1\/creative-ingestions\/[^/]+\/publish$/.test(pathname)) {
    return withSession(ctx, async () => notImplemented(res, requestId, pathname, 'Creative ingestion publish jobs are the next creative workflow slice.'));
  }

  if (method === 'POST' && /^\/v1\/creative-versions\/[^/]+\/assign\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async () => notImplemented(res, requestId, pathname, 'Creative-to-tag bindings will be ported with the variant binding subdomain.'));
  }

  if (method === 'PATCH' && /^\/v1\/creative-variants\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async () => notImplemented(res, requestId, pathname, 'Creative variant editing is not ported yet.'));
  }

  if (method === 'POST' && /^\/v1\/creative-variants\/[^/]+\/assign\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async () => notImplemented(res, requestId, pathname, 'Creative variant tag assignment is not ported yet.'));
  }

  if (method === 'PATCH' && /^\/v1\/video-renditions\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async () => notImplemented(res, requestId, pathname, 'Video rendition editing is not ported yet.'));
  }

  return false;
}
