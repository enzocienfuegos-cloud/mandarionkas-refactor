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
  deriveTranscodeDisplayStatus,
  getVideoTranscodeJobForVersion
} from './shared.mjs';

export async function handleCreativeBindingRoutes(ctx) {
  const { method, pathname, req, res, requestId, url } = ctx;

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
