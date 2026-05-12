import {
  PutObjectCommand,
  badRequest,
  forbidden,
  sendJson,
  sendNoContent,
  withReadOnlySession,
  withSession,
  hasPermission,
  randomUUID,
  logWarn,
  resolveTargetWorkspaceId,
  trimText,
  trimBaseUrl,
  normalizeHtmlEntryPath,
  resolveRequestedClickUrl,
  buildPublishJobState,
  getDbPool,
  isR2SigningReady,
  getR2Client,
  publishHtml5ArchiveInProcess,
  buildCreativeStorageKey,
  buildPublicUrl,
  buildCreativeUploadProxyUrl,
  inferStorageKeyFromPublicUrl,
  readBinaryBody,
  normalizeCreative,
  normalizeTranscodeJob,
  normalizeCreativeVersion,
  normalizeCreativeArtifact,
  normalizeCreativeIngestion,
  normalizeTagBinding,
  normalizeCreativeSizeVariant,
  normalizeVideoRendition,
  hasOwn,
  normalizeOptionalPositiveInteger,
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
  listCreativeArtifacts,
  listCreativeIngestions,
  listCreativeIngestionsForUser,
  listCreativeSizeVariants,
  listCreatives,
  listCreativesForUser,
  listCreativeVersions,
  listVideoRenditions,
  markHtml5CreativePublishFailed,
  markCreativeIngestionStatus,
  normalizeRawClickUrl,
  regenerateVideoRenditions,
  updateCreativeIngestion,
  updateCreative,
  updateCreativeSizeVariant,
  updateCreativeSizeVariantsBulkStatus,
  updateCreativeVersion,
  updateVideoRendition,
  dispatchHtml5ArchivePublishJob,
  deriveTranscodeDisplayStatus,
  getVideoTranscodeJobForVersion
} from './shared.mjs';

export async function handleCreativeVersionRoutes(ctx) {
  const { method, pathname, req, res, requestId, url } = ctx;

  if (method === 'GET' && /^\/v1\/creative-versions\/[^/]+$/.test(pathname)) {
      return withReadOnlySession(ctx, async (session) => {
        const versionId = pathname.split('/')[3];
        const workspaceId = await resolveTargetWorkspaceId(
          session.client,
          session.user.id,
          session.session.activeWorkspaceId,
          url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
        );
        let creativeVersion = await getCreativeVersion(session.client, workspaceId, versionId);
        if (!creativeVersion) return badRequest(res, requestId, 'Creative version not found.');
        const transcodeJob = await getVideoTranscodeJobForVersion(session.client, workspaceId, versionId);
        const transcodeStatus = deriveTranscodeDisplayStatus(transcodeJob);
        const artifacts = await listCreativeArtifacts(session.client, workspaceId, versionId);
        const variants = await listCreativeSizeVariants(session.client, workspaceId, versionId);
        const videoRenditions = await listVideoRenditions(session.client, workspaceId, versionId);
        return sendJson(res, 200, {
          creativeVersion: normalizeCreativeVersion(creativeVersion),
          transcodeStatus,
          transcodeJob: normalizeTranscodeJob(transcodeJob),
          artifacts: artifacts.map(normalizeCreativeArtifact),
          variants: variants.map(normalizeCreativeSizeVariant),
          videoRenditions: videoRenditions.map(normalizeVideoRendition),
          requestId,
        });
      });
    }
  
    if (method === 'GET' && /^\/v1\/creative-versions\/[^/]+\/variants$/.test(pathname)) {
      return withReadOnlySession(ctx, async (session) => {
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
        const transcodeJob = await getVideoTranscodeJobForVersion(session.client, workspaceId, versionId);
        const renditions = await listVideoRenditions(session.client, workspaceId, versionId);
        return sendJson(res, 200, {
          renditions: renditions.map(normalizeVideoRendition),
          transcodeStatus: deriveTranscodeDisplayStatus(transcodeJob),
          transcodeJob: normalizeTranscodeJob(transcodeJob),
          requestId,
        });
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
        const sourceStorageKey = sourceArtifact?.storage_key
          || inferStorageKeyFromPublicUrl(ctx.env, sourceArtifact?.public_url)
          || inferStorageKeyFromPublicUrl(ctx.env, creativeVersion.public_url)
          || null;
        const renditions = await regenerateVideoRenditions(session.client, workspaceId, versionId);
        if (creativeVersion.source_kind === 'video_mp4' && sourceStorageKey && creativeVersion.public_url) {
          await queueVideoTranscodeForCreativeVersion(session.client, {
            workspaceId,
            creativeId: creativeVersion.creative_id,
            creativeVersionId: versionId,
            createdBy: session.user.id,
            creativeName: creative?.name || sourceArtifact?.metadata?.originalFilename || 'Video creative',
            mimeType: creativeVersion.mime_type || sourceArtifact?.mime_type || 'video/mp4',
            storageKey: sourceStorageKey,
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

  return false;
}
