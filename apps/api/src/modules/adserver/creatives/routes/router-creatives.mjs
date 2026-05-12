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

export async function handleCreativeCatalogRoutes(ctx) {
  const { method, pathname, req, res, requestId, url } = ctx;

  if (method === 'GET' && pathname === '/v1/creatives') {
      return withReadOnlySession(ctx, async (session) => {
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
      return withReadOnlySession(ctx, async (session) => {
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
          click_url: normalizeRawClickUrl(ctx.body?.clickUrl ?? ctx.body?.click_url ?? null),
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

  return false;
}
