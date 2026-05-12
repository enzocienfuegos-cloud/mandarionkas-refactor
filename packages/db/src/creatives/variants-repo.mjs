import {
  randomUUID,
  enqueueVideoTranscodeJob,
  trimText,
  normalizeLimit,
  normalizeOffset,
  normalizeSearch,
  extractJsonObject,
  normalizeRawClickUrl,
  hasPublishedRenditionAsset,
  latestVersionSelect,
  normalizeCreativeStatus,
  normalizeBindingStatus,
  normalizeSourceKind,
  inferCreativeType,
  inferServingFormat,
  inferArtifactKind,
  normalizeHtmlEntryPath,
  resolvePublishedHtml5PreviewUrl,
  buildAutoVideoOutputPlan,
  getVideoProfileOutputKey,
  buildQueuedVideoProcessingMetadata,
  normalizeVariantStatus,
  normalizeRenditionStatus,
  normalizePositiveInteger,
  buildVariantLabel,
  estimateBitrateKbps,
  buildVideoLadderProfiles,
  buildVideoTargetProfiles,
} from './shared.mjs';

export async function listCreativeSizeVariants(pool, workspaceId, creativeVersionId) {
  const { rows } = await pool.query(
    `SELECT v.id, v.workspace_id, v.creative_version_id, v.label, v.width, v.height,
            v.status, v.public_url, v.artifact_id, v.metadata, v.created_by,
            v.created_at, v.updated_at,
            COALESCE(COUNT(b.id), 0)::int AS binding_count,
            COALESCE(COUNT(*) FILTER (WHERE b.status = 'active'), 0)::int AS active_binding_count,
            COALESCE(
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), NULL),
              ARRAY[]::TEXT[]
            ) AS tag_names
     FROM creative_size_variants v
     LEFT JOIN creative_tag_bindings b ON b.creative_size_variant_id = v.id
     LEFT JOIN ad_tags t ON t.id = b.tag_id
     WHERE v.workspace_id = $1 AND v.creative_version_id = $2
     GROUP BY v.id
     ORDER BY v.created_at DESC`,
    [workspaceId, creativeVersionId],
  );
  return rows;
}

export async function getCreativeSizeVariant(pool, workspaceId, variantId) {
  const { rows } = await pool.query(
    `SELECT id, workspace_id, creative_version_id, label, width, height, status,
            public_url, artifact_id, metadata, created_by, created_at, updated_at
     FROM creative_size_variants
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, variantId],
  );
  return rows[0] ?? null;
}

export async function createCreativeSizeVariant(pool, input = {}) {
  const width = normalizePositiveInteger(input.width);
  const height = normalizePositiveInteger(input.height);
  if (!width || !height) {
    throw new Error('Width and height must be positive integers.');
  }

  const params = [
    input.workspaceId,
    input.creativeVersionId,
    buildVariantLabel({ ...input, width, height }),
    width,
    height,
    normalizeVariantStatus(input.status),
    input.publicUrl || null,
    input.artifactId || null,
    JSON.stringify(input.metadata || {}),
    input.createdBy || null,
  ];

  const { rows } = await pool.query(
    `INSERT INTO creative_size_variants (
       workspace_id, creative_version_id, label, width, height,
       status, public_url, artifact_id, metadata, created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
     ON CONFLICT (creative_version_id, width, height)
     DO UPDATE SET
       label = EXCLUDED.label,
       status = EXCLUDED.status,
       public_url = COALESCE(EXCLUDED.public_url, creative_size_variants.public_url),
       artifact_id = COALESCE(EXCLUDED.artifact_id, creative_size_variants.artifact_id),
       metadata = CASE
         WHEN EXCLUDED.metadata = '{}'::jsonb THEN creative_size_variants.metadata
         ELSE creative_size_variants.metadata || EXCLUDED.metadata
       END,
       updated_at = NOW()
     RETURNING id, workspace_id, creative_version_id, label, width, height, status,
               public_url, artifact_id, metadata, created_by, created_at, updated_at`,
    params,
  );
  return rows[0] ?? null;
}

export async function createCreativeSizeVariantsBulk(pool, input = {}) {
  const variants = Array.isArray(input.variants) ? input.variants : [];
  const created = [];
  let skippedCount = 0;

  for (const variant of variants) {
    const width = normalizePositiveInteger(variant.width);
    const height = normalizePositiveInteger(variant.height);
    if (!width || !height) {
      skippedCount += 1;
      continue;
    }
    const existing = await pool.query(
      `SELECT id
       FROM creative_size_variants
       WHERE workspace_id = $1 AND creative_version_id = $2 AND width = $3 AND height = $4`,
      [input.workspaceId, input.creativeVersionId, width, height],
    );
    if (existing.rowCount) {
      skippedCount += 1;
      continue;
    }
    const createdVariant = await createCreativeSizeVariant(pool, {
      workspaceId: input.workspaceId,
      creativeVersionId: input.creativeVersionId,
      label: variant.label,
      width,
      height,
      status: variant.status ?? input.status,
      publicUrl: variant.publicUrl ?? input.publicUrl,
      artifactId: variant.artifactId ?? null,
      metadata: variant.metadata ?? {},
      createdBy: input.createdBy,
    });
    if (createdVariant) created.push(createdVariant);
  }

  const allVariants = await listCreativeSizeVariants(pool, input.workspaceId, input.creativeVersionId);
  return { created, variants: allVariants, skippedCount };
}

export async function updateCreativeSizeVariant(pool, workspaceId, variantId, input = {}) {
  const fields = [];
  const params = [workspaceId, variantId];

  if (Object.prototype.hasOwnProperty.call(input, 'label')) {
    params.push(String(input.label || '').trim());
    fields.push(`label = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'width')) {
    const width = normalizePositiveInteger(input.width);
    if (!width) throw new Error('Width must be a positive integer.');
    params.push(width);
    fields.push(`width = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'height')) {
    const height = normalizePositiveInteger(input.height);
    if (!height) throw new Error('Height must be a positive integer.');
    params.push(height);
    fields.push(`height = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'status')) {
    params.push(normalizeVariantStatus(input.status));
    fields.push(`status = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'public_url')) {
    params.push(input.public_url || null);
    fields.push(`public_url = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'artifact_id')) {
    params.push(input.artifact_id || null);
    fields.push(`artifact_id = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'metadata')) {
    params.push(JSON.stringify(input.metadata || {}));
    fields.push(`metadata = $${params.length}::jsonb`);
  }

  if (!fields.length) {
    return getCreativeSizeVariant(pool, workspaceId, variantId);
  }

  fields.push('updated_at = NOW()');
  const { rows } = await pool.query(
    `UPDATE creative_size_variants
     SET ${fields.join(', ')}
     WHERE workspace_id = $1 AND id = $2
     RETURNING id, workspace_id, creative_version_id, label, width, height, status,
               public_url, artifact_id, metadata, created_by, created_at, updated_at`,
    params,
  );
  return rows[0] ?? null;
}

export async function updateCreativeSizeVariantsBulkStatus(pool, workspaceId, creativeVersionId, variantIds = [], status) {
  const normalizedIds = variantIds.map((value) => String(value || '').trim()).filter(Boolean);
  if (!normalizedIds.length) {
    return listCreativeSizeVariants(pool, workspaceId, creativeVersionId);
  }
  await pool.query(
    `UPDATE creative_size_variants
     SET status = $4, updated_at = NOW()
     WHERE workspace_id = $1 AND creative_version_id = $2 AND id = ANY($3::text[])`,
    [workspaceId, creativeVersionId, normalizedIds, normalizeVariantStatus(status, 'active')],
  );
  return listCreativeSizeVariants(pool, workspaceId, creativeVersionId);
}
