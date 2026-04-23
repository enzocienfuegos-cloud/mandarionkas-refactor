import {
  createTagBinding,
  listCreatives,
  listCreativeVersions,
  listCreativeSizeVariants,
  listCreativeSizeVariantBindingSummaries,
  listCreativeSizeVariantPerformanceSummaries,
  getCreativeSizeVariant,
  createCreativeSizeVariant,
  createCreativeSizeVariantsBulk,
  updateCreativeSizeVariant,
  updateCreativeSizeVariantsBulkStatus,
  listCreativeArtifacts,
  getCreative,
  getCreativeVersion,
  createCreative,
  updateCreative,
  deleteCreative,
  assignCreativeToTag,
  removeCreativeFromTag,
} from '@smx/db';
import { getTag } from '@smx/db/tags';

function toApiCreativeVersion(version) {
  if (!version) return null;
  return {
    id: version.id,
    workspaceId: version.workspace_id,
    creativeId: version.creative_id,
    versionNumber: version.version_number,
    sourceKind: version.source_kind,
    servingFormat: version.serving_format,
    status: version.status,
    publicUrl: version.public_url ?? '',
    entryPath: version.entry_path ?? '',
    mimeType: version.mime_type ?? '',
    width: version.width ?? null,
    height: version.height ?? null,
    durationMs: version.duration_ms ?? null,
    fileSize: version.file_size ?? null,
    metadata: version.metadata ?? {},
    createdBy: version.created_by ?? null,
    reviewedBy: version.reviewed_by ?? null,
    reviewedAt: version.reviewed_at ?? null,
    reviewNotes: version.review_notes ?? '',
    createdAt: version.created_at,
    updatedAt: version.updated_at,
  };
}

function toApiCreativeArtifact(artifact) {
  if (!artifact) return null;
  return {
    id: artifact.id,
    creativeVersionId: artifact.creative_version_id,
    kind: artifact.kind,
    storageKey: artifact.storage_key ?? '',
    publicUrl: artifact.public_url ?? '',
    mimeType: artifact.mime_type ?? '',
    sizeBytes: artifact.size_bytes ?? null,
    checksum: artifact.checksum ?? '',
    metadata: artifact.metadata ?? {},
    createdAt: artifact.created_at,
    updatedAt: artifact.updated_at,
  };
}

function toApiCreativeSizeVariant(variant) {
  if (!variant) return null;
  return {
    id: variant.id,
    creativeVersionId: variant.creative_version_id,
    label: variant.label,
    width: variant.width,
    height: variant.height,
    status: variant.status,
    publicUrl: variant.public_url ?? '',
    artifactId: variant.artifact_id ?? null,
    metadata: variant.metadata ?? {},
    bindingCount: variant.binding_count ?? 0,
    activeBindingCount: variant.active_binding_count ?? 0,
    tagNames: Array.isArray(variant.tag_names) ? variant.tag_names : [],
    totalImpressions: Number(variant.total_impressions ?? 0),
    totalClicks: Number(variant.total_clicks ?? 0),
    impressions7d: Number(variant.impressions_7d ?? 0),
    clicks7d: Number(variant.clicks_7d ?? 0),
    ctr: Number(variant.ctr ?? 0),
    createdBy: variant.created_by ?? null,
    createdAt: variant.created_at,
    updatedAt: variant.updated_at,
  };
}

async function listCreativeSizeVariantsWithSummaries(pool, workspaceId, creativeVersionId) {
  const [variants, summaries, performance] = await Promise.all([
    listCreativeSizeVariants(pool, workspaceId, creativeVersionId),
    listCreativeSizeVariantBindingSummaries(pool, workspaceId, creativeVersionId),
    listCreativeSizeVariantPerformanceSummaries(pool, workspaceId, creativeVersionId),
  ]);
  const summaryByVariantId = new Map(
    summaries.map(summary => [summary.creative_size_variant_id, summary]),
  );
  const performanceByVariantId = new Map(
    performance.map(summary => [summary.creative_size_variant_id, summary]),
  );
  return variants.map(variant => ({
    ...variant,
    ...(summaryByVariantId.get(variant.id) ?? {}),
    ...(performanceByVariantId.get(variant.id) ?? {}),
  }));
}

export function handleCreativeRoutes(app, { requireWorkspace, pool }) {
  // GET /v1/creatives
  app.get('/v1/creatives', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { status, tagId, format, limit, offset, search } = req.query;

    const creatives = await listCreatives(pool, workspaceId, {
      approval_status: status,
      type: format,
      limit,
      offset,
      search,
    });

    // If tagId filter requested, additionally filter by tag assignment
    if (tagId) {
      const { rows: tagCreativeIds } = await pool.query(
        `SELECT creative_id FROM tag_creatives WHERE tag_id = $1`,
        [tagId],
      );
      const idSet = new Set(tagCreativeIds.map(r => r.creative_id));
      return reply.send({ creatives: creatives.filter(c => idSet.has(c.id)) });
    }

    return reply.send({ creatives });
  });

  // POST /v1/creatives
  app.post('/v1/creatives', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const {
      name, format, vastUrl, videoUrl, duration, width, height, clickUrl,
      fileUrl, fileSize, mimeType, metadata,
    } = req.body ?? {};

    if (!name) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name is required' });
    }

    const VALID_FORMATS = ['vast_video', 'display', 'native', 'image', 'video', 'vast'];
    const type = format ?? 'display';
    if (!VALID_FORMATS.includes(type)) {
      return reply.status(400).send({ error: 'Bad Request', message: `format must be one of: ${VALID_FORMATS.join(', ')}` });
    }

    const creative = await createCreative(pool, workspaceId, {
      name,
      type,
      file_url: fileUrl ?? vastUrl ?? videoUrl ?? null,
      file_size: fileSize ?? null,
      mime_type: mimeType ?? null,
      width: width ?? null,
      height: height ?? null,
      duration_ms: duration ? duration * 1000 : null,
      click_url: clickUrl ?? null,
      metadata: metadata ?? {},
    });

    return reply.status(201).send({ creative });
  });

  // GET /v1/creatives/:id
  app.get('/v1/creatives/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const creative = await getCreative(pool, workspaceId, id);
    if (!creative) {
      return reply.status(404).send({ error: 'Not Found', message: 'Creative not found' });
    }
    return reply.send({ creative });
  });

  // GET /v1/creatives/:id/versions
  app.get('/v1/creatives/:id/versions', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const creative = await getCreative(pool, workspaceId, id);
    if (!creative) {
      return reply.status(404).send({ error: 'Not Found', message: 'Creative not found' });
    }

    const versions = await listCreativeVersions(pool, workspaceId, id);
    return reply.send({ versions: versions.map(toApiCreativeVersion) });
  });

  // GET /v1/creative-versions/:id
  app.get('/v1/creative-versions/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const version = await getCreativeVersion(pool, workspaceId, id);
    if (!version) {
      return reply.status(404).send({ error: 'Not Found', message: 'Creative version not found' });
    }

    const artifacts = await listCreativeArtifacts(pool, workspaceId, id);
    const variants = await listCreativeSizeVariantsWithSummaries(pool, workspaceId, id);

    return reply.send({
      creativeVersion: toApiCreativeVersion(version),
      artifacts: artifacts.map(toApiCreativeArtifact),
      variants: variants.map(toApiCreativeSizeVariant),
    });
  });

  app.get('/v1/creative-versions/:id/variants', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const version = await getCreativeVersion(pool, workspaceId, id);
    if (!version) {
      return reply.status(404).send({ error: 'Not Found', message: 'Creative version not found' });
    }

    const variants = await listCreativeSizeVariantsWithSummaries(pool, workspaceId, id);
    return reply.send({ variants: variants.map(toApiCreativeSizeVariant) });
  });

  app.post('/v1/creative-versions/:id/variants', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId, userId } = req.authSession;
    const { id } = req.params;
    const version = await getCreativeVersion(pool, workspaceId, id);
    if (!version) {
      return reply.status(404).send({ error: 'Not Found', message: 'Creative version not found' });
    }

    const width = Number(req.body?.width);
    const height = Number(req.body?.height);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'width and height must be positive numbers' });
    }

    const variant = await createCreativeSizeVariant(pool, workspaceId, {
      creative_version_id: id,
      label: req.body?.label,
      width,
      height,
      status: req.body?.status ?? 'draft',
      public_url: req.body?.publicUrl ?? version.public_url ?? null,
      artifact_id: req.body?.artifactId ?? null,
      metadata: req.body?.metadata ?? {},
      created_by: userId,
    });

    return reply.status(201).send({ variant: toApiCreativeSizeVariant(variant) });
  });

  app.post('/v1/creative-versions/:id/variants/bulk', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId, userId } = req.authSession;
    const { id } = req.params;
    const version = await getCreativeVersion(pool, workspaceId, id);
    if (!version) {
      return reply.status(404).send({ error: 'Not Found', message: 'Creative version not found' });
    }

    const requestedVariants = Array.isArray(req.body?.variants) ? req.body.variants : [];
    if (!requestedVariants.length) {
      return reply.status(400).send({ error: 'Bad Request', message: 'variants must be a non-empty array' });
    }

    const existing = await listCreativeSizeVariants(pool, workspaceId, id);
    const existingKeys = new Set(existing.map(variant => `${variant.width}x${variant.height}`));
    const normalizedVariants = [];
    for (const variant of requestedVariants) {
      const width = Number(variant?.width);
      const height = Number(variant?.height);
      if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Every variant must include positive width and height' });
      }
      const key = `${width}x${height}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      normalizedVariants.push({
        label: variant?.label,
        width,
        height,
        status: variant?.status ?? req.body?.status ?? 'draft',
        public_url: variant?.publicUrl ?? req.body?.publicUrl ?? version.public_url ?? null,
        artifact_id: variant?.artifactId ?? null,
        metadata: variant?.metadata ?? {},
      });
    }

    const created = await createCreativeSizeVariantsBulk(pool, workspaceId, id, normalizedVariants, {
      status: req.body?.status ?? 'draft',
      public_url: req.body?.publicUrl ?? version.public_url ?? null,
      created_by: userId,
    });
    const variants = await listCreativeSizeVariantsWithSummaries(pool, workspaceId, id);
    return reply.status(201).send({
      created: created.map(toApiCreativeSizeVariant),
      variants: variants.map(toApiCreativeSizeVariant),
      skippedCount: requestedVariants.length - normalizedVariants.length,
    });
  });

  app.patch('/v1/creative-variants/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const current = await getCreativeSizeVariant(pool, workspaceId, id);
    if (!current) {
      return reply.status(404).send({ error: 'Not Found', message: 'Creative size variant not found' });
    }

    const variant = await updateCreativeSizeVariant(pool, workspaceId, id, {
      label: req.body?.label,
      width: req.body?.width,
      height: req.body?.height,
      status: req.body?.status,
      publicUrl: req.body?.publicUrl,
      artifactId: req.body?.artifactId,
      metadata: req.body?.metadata,
    });

    return reply.send({ variant: toApiCreativeSizeVariant(variant) });
  });

  app.patch('/v1/creative-versions/:id/variants/status', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;
    const version = await getCreativeVersion(pool, workspaceId, id);
    if (!version) {
      return reply.status(404).send({ error: 'Not Found', message: 'Creative version not found' });
    }

    const variantIds = Array.isArray(req.body?.variantIds) ? req.body.variantIds.filter(Boolean) : [];
    if (!variantIds.length) {
      return reply.status(400).send({ error: 'Bad Request', message: 'variantIds must be a non-empty array' });
    }

    await updateCreativeSizeVariantsBulkStatus(pool, workspaceId, variantIds, req.body?.status ?? 'draft');
    const variants = await listCreativeSizeVariantsWithSummaries(pool, workspaceId, id);
    return reply.send({ variants: variants.map(toApiCreativeSizeVariant) });
  });

  // PUT /v1/creatives/:id
  app.put('/v1/creatives/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;
    const body = req.body ?? {};

    const fieldMap = {
      name: 'name',
      format: 'type',
      fileUrl: 'file_url',
      fileSize: 'file_size',
      mimeType: 'mime_type',
      width: 'width',
      height: 'height',
      clickUrl: 'click_url',
      metadata: 'metadata',
      transcodeStatus: 'transcode_status',
    };

    const data = {};
    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (camel in body) data[snake] = body[camel];
    }

    if ('duration' in body) data.duration_ms = body.duration ? body.duration * 1000 : null;

    const creative = await updateCreative(pool, workspaceId, id, data);
    if (!creative) {
      return reply.status(404).send({ error: 'Not Found', message: 'Creative not found' });
    }
    return reply.send({ creative });
  });

  // DELETE /v1/creatives/:id
  app.delete('/v1/creatives/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const deleted = await deleteCreative(pool, workspaceId, id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Not Found', message: 'Creative not found' });
    }
    return reply.status(204).send();
  });

  // POST /v1/creatives/:id/assign/:tagId
  app.post('/v1/creatives/:id/assign/:tagId', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id, tagId } = req.params;
    const { weight = 1 } = req.body ?? {};

    // Verify creative belongs to workspace
    const creative = await getCreative(pool, workspaceId, id);
    if (!creative) {
      return reply.status(404).send({ error: 'Not Found', message: 'Creative not found' });
    }

    // Verify tag belongs to workspace
    const { rows: tagRows } = await pool.query(
      `SELECT id FROM ad_tags WHERE id = $1 AND workspace_id = $2`,
      [tagId, workspaceId],
    );
    if (!tagRows.length) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    const assignment = await assignCreativeToTag(pool, tagId, id, weight);
    return reply.status(201).send({ assignment });
  });

  // POST /v1/creative-versions/:id/assign/:tagId
  app.post('/v1/creative-versions/:id/assign/:tagId', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId, userId } = req.authSession;
    const { id, tagId } = req.params;
    const { weight = 1, status = 'active', startAt = null, endAt = null } = req.body ?? {};

    const version = await getCreativeVersion(pool, workspaceId, id);
    if (!version) {
      return reply.status(404).send({ error: 'Not Found', message: 'Creative version not found' });
    }

    const tag = await getTag(pool, workspaceId, tagId);
    if (!tag) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    const variants = await listCreativeSizeVariants(pool, workspaceId, id);
    const defaultVariant = variants.find((variant) =>
      Number(variant.width ?? 0) === Number(version.width ?? 0)
      && Number(variant.height ?? 0) === Number(version.height ?? 0),
    ) ?? variants[0] ?? null;

    const binding = await createTagBinding(pool, workspaceId, {
      tag_id: tagId,
      creative_version_id: id,
      creative_size_variant_id: defaultVariant?.id ?? null,
      status,
      weight,
      start_at: startAt,
      end_at: endAt,
      created_by: userId,
    });

    return reply.status(201).send({ binding });
  });

  app.post('/v1/creative-variants/:id/assign/:tagId', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId, userId } = req.authSession;
    const { id, tagId } = req.params;
    const { weight = 1, status = 'active', startAt = null, endAt = null } = req.body ?? {};

    const variant = await getCreativeSizeVariant(pool, workspaceId, id);
    if (!variant) {
      return reply.status(404).send({ error: 'Not Found', message: 'Creative size variant not found' });
    }

    const tag = await getTag(pool, workspaceId, tagId);
    if (!tag) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    const binding = await createTagBinding(pool, workspaceId, {
      tag_id: tagId,
      creative_version_id: variant.creative_version_id,
      creative_size_variant_id: variant.id,
      status,
      weight,
      start_at: startAt,
      end_at: endAt,
      created_by: userId,
    });

    return reply.status(201).send({ binding });
  });

  // DELETE /v1/creatives/:id/assign/:tagId
  app.delete('/v1/creatives/:id/assign/:tagId', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id, tagId } = req.params;

    // Verify creative belongs to workspace
    const creative = await getCreative(pool, workspaceId, id);
    if (!creative) {
      return reply.status(404).send({ error: 'Not Found', message: 'Creative not found' });
    }

    const removed = await removeCreativeFromTag(pool, tagId, id);
    if (!removed) {
      return reply.status(404).send({ error: 'Not Found', message: 'Assignment not found' });
    }
    return reply.status(204).send();
  });
}
