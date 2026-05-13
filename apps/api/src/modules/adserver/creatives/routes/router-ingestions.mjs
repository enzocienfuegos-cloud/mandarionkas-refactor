import {
  PutObjectCommand,
  badRequest,
  forbidden,
  sendJson,
  sendNoContent,
  withReadOnlySession,
  withSession,
  hasPermission,
  withTransaction,
  randomUUID,
  logWarn,
  PREPARE_UPLOAD_TTL_SECONDS,
  resolveTargetWorkspaceId,
  trimText,
  trimBaseUrl,
  normalizeHtmlEntryPath,
  resolveRequestedClickUrl,
  buildPublishJobState,
  getDbPool,
  isR2SigningReady,
  getR2Client,
  checkCreativeUploadRateLimit,
  sendUploadRateLimited,
  buildCreativeStorageKey,
  buildPublicUrl,
  buildCreativeUploadProxyUrl,
  signUploadUrl,
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

export async function handleCreativeIngestionRoutes(ctx) {
  const { method, pathname, req, res, requestId, url } = ctx;

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
        const rateLimit = await checkCreativeUploadRateLimit({
          client: session.client,
          env: ctx.env,
          headers: req.headers,
          userId: session.user.id,
          workspaceId,
        });
        if (!rateLimit.ok) {
          return sendUploadRateLimited(res, requestId, rateLimit);
        }

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
        const rateLimit = await checkCreativeUploadRateLimit({
          client: session.client,
          env: ctx.env,
          headers: req.headers,
          userId: session.user.id,
          workspaceId,
        });
        if (!rateLimit.ok) {
          return sendUploadRateLimited(res, requestId, rateLimit);
        }

        const ingestionId = randomUUID();
        const storageKey = buildCreativeStorageKey({ workspaceId, ingestionId, filename });
        const publicUrl = buildPublicUrl(ctx.env, storageKey);
        const uploadProxyUrl = buildCreativeUploadProxyUrl(ctx, ingestionId, workspaceId);
        const presignedUrl = await signUploadUrl(ctx.env, {
          storageKey,
          mimeType: ctx.body?.mimeType || ctx.body?.mime_type || null,
        });
        const ingestion = await createCreativeIngestion(session.client, {
          id: ingestionId,
          workspaceId,
          createdBy: session.user.id,
          sourceKind,
          status: 'pending_upload',
          originalFilename: filename,
          mimeType: ctx.body?.mimeType || ctx.body?.mime_type || null,
          sizeBytes: ctx.body?.sizeBytes ?? ctx.body?.size_bytes ?? null,
          storageKey,
          publicUrl,
          metadata: {
            requestedName: trimText(ctx.body?.name) || null,
            clickUrl: resolveRequestedClickUrl(ctx.body, null),
            width: normalizeOptionalPositiveInteger(ctx.body?.width),
            height: normalizeOptionalPositiveInteger(ctx.body?.height),
            durationMs: normalizeOptionalPositiveInteger(ctx.body?.durationMs ?? ctx.body?.duration_ms),
          },
        });
        return sendJson(res, 200, {
          ingestion: normalizeCreativeIngestion(ingestion),
          upload: {
            ingestionId,
            storageKey,
            publicUrl,
            presignedUrl: presignedUrl ?? null,
            presignedMethod: 'PUT',
            presignedExpiresAt: presignedUrl
              ? new Date(Date.now() + PREPARE_UPLOAD_TTL_SECONDS * 1000).toISOString()
              : null,
            proxyUrl: uploadProxyUrl,
            proxyMethod: 'POST',
            uploadUrl: uploadProxyUrl,
            uploadMethod: 'POST',
          },
          requestId,
        });
      });
    }
  
    if (method === 'POST' && /^\/v1\/creative-ingestions\/[^/]+\/upload-proxy$/.test(pathname)) {
      return withSession(ctx, async (session) => {
        if (!hasPermission(session, 'projects:create')) {
          return forbidden(res, requestId, 'You do not have permission to upload creatives.');
        }
        if (!isR2SigningReady(ctx.env)) {
          return badRequest(res, requestId, 'Creative uploads are not configured yet.');
        }
  
        const ingestionId = pathname.split('/')[3];
        const workspaceId = await resolveTargetWorkspaceId(
          session.client,
          session.user.id,
          session.session.activeWorkspaceId,
          url.searchParams.get('workspaceId') || url.searchParams.get('clientId'),
        );
        const ingestion = await getCreativeIngestion(session.client, workspaceId, ingestionId);
        if (!ingestion) return badRequest(res, requestId, 'Creative ingestion not found.');
        if (!trimText(ingestion.storage_key)) {
          return badRequest(res, requestId, 'Creative ingestion is missing a storage key.');
        }
  
        const bodyBuffer = await readBinaryBody(req);
        if (!bodyBuffer.length) {
          return badRequest(res, requestId, 'Upload body is empty.');
        }
  
        const contentType = trimText(ingestion.mime_type || req.headers['content-type']) || 'application/octet-stream';
        await getR2Client(ctx.env).send(new PutObjectCommand({
          Bucket: ctx.env.r2Bucket,
          Key: ingestion.storage_key,
          Body: bodyBuffer,
          ContentType: contentType,
          ContentLength: bodyBuffer.length,
        }));
  
        await updateCreativeIngestion(session.client, workspaceId, ingestionId, {
          status: 'uploaded',
          mime_type: contentType,
          size_bytes: bodyBuffer.length,
          public_url: trimText(ingestion.public_url) || buildPublicUrl(ctx.env, ingestion.storage_key),
        });
  
        return sendNoContent(res);
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
            clickUrl: resolveRequestedClickUrl(ctx.body, existing.metadata?.clickUrl || null),
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
          return sendJson(res, 200, {
            ingestion: normalizeCreativeIngestion(existing),
            queued: false,
            processing: false,
            requestId,
          });
        }
  
        const isHtml5 = trimText(existing.source_kind).toLowerCase() === 'html5_zip';
  
        if (isHtml5) {
          res.statusCode = 202;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ queued: true, processing: true, requestId }));
  
          const backgroundEnv = ctx.env;
          const backgroundBody = ctx.body;
          const snapshotExisting = { ...existing };
  
          void (async () => {
            const pool = getDbPool(backgroundEnv);
            if (!pool) {
              logWarn({ event: 'html5_publish_bg_skipped', reason: 'no_db_pool', ingestionId });
              return;
            }
  
            const queuedPublishMetadata = {
              ...(snapshotExisting.metadata || {}),
              entryPath: normalizeHtmlEntryPath(snapshotExisting.metadata?.entryPath || 'index.html'),
              publishJob: buildPublishJobState('queued'),
            };
  
            let creativeVersionId = snapshotExisting.creative_version_id;
  
            try {
              if (!creativeVersionId) {
                const client = await pool.connect();
                let result;
                try {
                  result = await withTransaction(client, (tx) =>
                    createPublishedCreative(tx, {
                      workspaceId,
                      createdBy: session.user.id,
                      ingestionId,
                      sourceKind: snapshotExisting.source_kind,
                      name: trimText(backgroundBody?.name) || snapshotExisting.metadata?.requestedName || snapshotExisting.original_filename,
                      clickUrl: resolveRequestedClickUrl(backgroundBody, snapshotExisting.metadata?.clickUrl || null),
                      publicUrl: snapshotExisting.public_url,
                      storageKey: snapshotExisting.storage_key || inferStorageKeyFromPublicUrl(backgroundEnv, snapshotExisting.public_url),
                      originalFilename: snapshotExisting.original_filename,
                      mimeType: snapshotExisting.mime_type,
                      sizeBytes: snapshotExisting.size_bytes,
                      width: normalizeOptionalPositiveInteger(backgroundBody?.width) ?? snapshotExisting.metadata?.width ?? null,
                      height: normalizeOptionalPositiveInteger(backgroundBody?.height) ?? snapshotExisting.metadata?.height ?? null,
                      durationMs: normalizeOptionalPositiveInteger(backgroundBody?.durationMs ?? backgroundBody?.duration_ms) ?? snapshotExisting.metadata?.durationMs ?? null,
                      metadata: queuedPublishMetadata,
                      deferHtml5ArchivePublish: true,
                      ingestionStatus: 'processing',
                      ingestionMetadata: queuedPublishMetadata,
                      ingestionValidationReport: {
                        ...(snapshotExisting.validation_report || {}),
                        readyToPublish: true,
                        publishQueued: true,
                      },
                    }),
                  );
                } finally {
                  client.release();
                }
                creativeVersionId = result.creativeVersion?.id;
              } else {
                await markCreativeIngestionStatus(pool, workspaceId, ingestionId, {
                  status: 'processing',
                  metadata: queuedPublishMetadata,
                });
              }
  
              if (!creativeVersionId) throw new Error('Failed to resolve creative_version_id for HTML5 publish.');

              // The DB trigger is the normal queue signal, but an explicit NOTIFY
              // makes this path resilient when a migration or listener reconnect
              // gap would otherwise leave the creative in "publishing".
              await pool.query(`SELECT pg_notify('smx.publish-html5-archive', $1)`, [ingestionId]);
  
              logWarn({ event: 'html5_publish_dispatched_via_notify', ingestionId, creativeVersionId });
              return;
            } catch (err) {
              logWarn({
                event: 'html5_publish_bg_error',
                ingestionId,
                workspaceId,
                message: err?.message ?? String(err),
              });
              try {
                if (creativeVersionId) {
                  await markHtml5CreativePublishFailed(pool, workspaceId, creativeVersionId, {
                    reason: 'html5_publish_failed',
                    detail: err?.message || 'HTML5 publish failed in background.',
                  });
                }
                await markCreativeIngestionStatus(pool, workspaceId, ingestionId, {
                  status: 'failed',
                  errorCode: 'html5_publish_failed',
                  errorDetail: err?.message || 'HTML5 publish failed in background.',
                });
              } catch (_) { /* ignore secondary failure */ }
            }
          })();
  
          return true;
        }
  
        const result = await withTransaction(session.client, (tx) =>
          createPublishedCreative(tx, {
            workspaceId,
            createdBy: session.user.id,
            ingestionId,
            sourceKind: existing.source_kind,
            name: trimText(ctx.body?.name) || existing.metadata?.requestedName || existing.original_filename,
            clickUrl: resolveRequestedClickUrl(ctx.body, existing.metadata?.clickUrl || null),
            publicUrl: existing.public_url,
            storageKey: existing.storage_key || inferStorageKeyFromPublicUrl(ctx.env, existing.public_url),
            originalFilename: existing.original_filename,
            mimeType: existing.mime_type,
            sizeBytes: existing.size_bytes,
            width: normalizeOptionalPositiveInteger(ctx.body?.width) ?? existing.metadata?.width ?? null,
            height: normalizeOptionalPositiveInteger(ctx.body?.height) ?? existing.metadata?.height ?? null,
            durationMs: normalizeOptionalPositiveInteger(ctx.body?.durationMs ?? ctx.body?.duration_ms) ?? existing.metadata?.durationMs ?? null,
            metadata: existing.metadata || {},
          }),
        );
  
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

  return false;
}
