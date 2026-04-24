function normalizeVersionStatus(status, fallback = 'draft') {
  const normalized = String(status ?? '').trim().toLowerCase();
  return ['draft', 'processing', 'pending_review', 'approved', 'rejected', 'archived'].includes(normalized)
    ? normalized
    : fallback;
}

function normalizeSourceKind(sourceKind) {
  const normalized = String(sourceKind ?? '').trim().toLowerCase();
  return [
    'legacy',
    'studio_export',
    'html5_zip',
    'video_mp4',
    'image_upload',
    'native_upload',
    'vast_wrapper',
  ].includes(normalized)
    ? normalized
    : 'legacy';
}

function normalizeServingFormat(servingFormat) {
  const normalized = String(servingFormat ?? '').trim().toLowerCase();
  return ['display_html', 'display_image', 'vast_video', 'native', 'vast_wrapper'].includes(normalized)
    ? normalized
    : 'display_image';
}

function normalizeBindingStatus(status) {
  const normalized = String(status ?? '').trim().toLowerCase();
  return ['draft', 'active', 'paused', 'archived'].includes(normalized)
    ? normalized
    : 'active';
}

function normalizeVariantStatus(status) {
  const normalized = String(status ?? '').trim().toLowerCase();
  return ['draft', 'active', 'paused', 'archived'].includes(normalized)
    ? normalized
    : 'draft';
}

function normalizeVideoRenditionStatus(status) {
  const normalized = String(status ?? '').trim().toLowerCase();
  return ['draft', 'processing', 'active', 'paused', 'archived', 'failed'].includes(normalized)
    ? normalized
    : 'draft';
}

async function syncCreativeApprovalStatus(pool, workspaceId, creativeId, status, reviewerId = null, notes = null) {
  await pool.query(
    `UPDATE creatives
     SET approval_status = $3,
         reviewed_by = CASE WHEN $4::uuid IS NULL THEN reviewed_by ELSE $4 END,
         reviewed_at = CASE WHEN $4::uuid IS NULL THEN reviewed_at ELSE NOW() END,
         review_notes = CASE WHEN $5::text IS NULL THEN review_notes ELSE $5 END,
         updated_at = NOW()
     WHERE workspace_id = $1
       AND id = $2`,
    [workspaceId, creativeId, status, reviewerId, notes],
  );
}

export function inferServingFormatFromCreative(creative = {}) {
  if (creative.type === 'html') return 'display_html';
  if (creative.type === 'native') return 'native';
  if (creative.type === 'video' || creative.type === 'vast' || String(creative.mime_type ?? '').startsWith('video/')) {
    return 'vast_video';
  }
  return 'display_image';
}

export function inferVersionStatusFromCreative(creative = {}) {
  if (creative.transcode_status === 'pending' || creative.transcode_status === 'processing') {
    return 'processing';
  }
  return normalizeVersionStatus(creative.approval_status, 'draft');
}

export async function listCreativeVersions(pool, workspaceId, creativeId) {
  const { rows } = await pool.query(
    `SELECT *
     FROM creative_versions
     WHERE workspace_id = $1
       AND creative_id = $2
     ORDER BY version_number DESC, created_at DESC`,
    [workspaceId, creativeId],
  );
  return rows;
}

export async function getCreativeVersion(pool, workspaceId, versionId) {
  const { rows } = await pool.query(
    `SELECT *
     FROM creative_versions
     WHERE workspace_id = $1
       AND id = $2`,
    [workspaceId, versionId],
  );
  return rows[0] ?? null;
}

export async function updateCreativeVersion(pool, workspaceId, versionId, patch = {}) {
  const fieldMap = {
    status: 'status',
    publicUrl: 'public_url',
    entryPath: 'entry_path',
    mimeType: 'mime_type',
    width: 'width',
    height: 'height',
    durationMs: 'duration_ms',
    fileSize: 'file_size',
    metadata: 'metadata',
    reviewedBy: 'reviewed_by',
    reviewedAt: 'reviewed_at',
    reviewNotes: 'review_notes',
  };

  const params = [workspaceId, versionId];
  const setClauses = [];

  for (const [camel, column] of Object.entries(fieldMap)) {
    if (!(camel in patch)) continue;
    const value = patch[camel];
    if (column === 'metadata') {
      params.push(JSON.stringify(value ?? {}));
      setClauses.push(`${column} = $${params.length}::jsonb`);
    } else if (column === 'status') {
      params.push(normalizeVersionStatus(value));
      setClauses.push(`${column} = $${params.length}`);
    } else {
      params.push(value);
      setClauses.push(`${column} = $${params.length}`);
    }
  }

  if (!setClauses.length) {
    return getCreativeVersion(pool, workspaceId, versionId);
  }

  setClauses.push('updated_at = NOW()');

  const { rows } = await pool.query(
    `UPDATE creative_versions
     SET ${setClauses.join(', ')}
     WHERE workspace_id = $1
       AND id = $2
     RETURNING *`,
    params,
  );
  return rows[0] ?? null;
}

export async function listCreativeVersionsForReview(pool, workspaceId, status = 'pending_review') {
  const { rows } = await pool.query(
    `SELECT cv.*, c.name AS creative_name
     FROM creative_versions cv
     JOIN creatives c ON c.id = cv.creative_id
     WHERE cv.workspace_id = $1
       AND cv.status = $2
     ORDER BY cv.created_at DESC`,
    [workspaceId, normalizeVersionStatus(status, 'pending_review')],
  );
  return rows;
}

export async function createCreativeVersion(pool, workspaceId, data) {
  const {
    creativeId,
    source_kind = 'legacy',
    serving_format = 'display_image',
    status = 'draft',
    public_url = null,
    entry_path = null,
    mime_type = null,
    width = null,
    height = null,
    duration_ms = null,
    file_size = null,
    metadata = {},
    created_by = null,
    reviewed_by = null,
    reviewed_at = null,
    review_notes = null,
  } = data;

  if (!creativeId) {
    throw new Error('creativeId is required');
  }

  const { rows } = await pool.query(
    `WITH next_version AS (
       SELECT COALESCE(MAX(version_number), 0) + 1 AS version_number
       FROM creative_versions
       WHERE creative_id = $2
     )
     INSERT INTO creative_versions (
       workspace_id, creative_id, version_number,
       source_kind, serving_format, status,
       public_url, entry_path, mime_type, width, height,
       duration_ms, file_size, metadata, created_by,
       reviewed_by, reviewed_at, review_notes
     )
     SELECT
       $1, $2, next_version.version_number,
       $3, $4, $5,
       $6, $7, $8, $9, $10,
       $11, $12, $13::jsonb, $14,
       $15, $16, $17
     FROM next_version
     RETURNING *`,
    [
      workspaceId,
      creativeId,
      normalizeSourceKind(source_kind),
      normalizeServingFormat(serving_format),
      normalizeVersionStatus(status),
      public_url,
      entry_path,
      mime_type,
      width,
      height,
      duration_ms,
      file_size,
      JSON.stringify(metadata ?? {}),
      created_by,
      reviewed_by,
      reviewed_at,
      review_notes,
    ],
  );
  const version = rows[0] ?? null;
  if (version?.width && version?.height) {
    await ensureCreativeVersionDefaultVariant(pool, workspaceId, version);
  }
  return version;
}

export async function ensureLegacyCreativeVersion(pool, workspaceId, creative) {
  if (!creative?.id) return null;

  const existing = await pool.query(
    `SELECT *
     FROM creative_versions
     WHERE workspace_id = $1
       AND creative_id = $2
       AND source_kind = 'legacy'
     ORDER BY version_number ASC
     LIMIT 1`,
    [workspaceId, creative.id],
  );
  if (existing.rows[0]) return existing.rows[0];

  return createCreativeVersion(pool, workspaceId, {
    creativeId: creative.id,
    source_kind: 'legacy',
    serving_format: inferServingFormatFromCreative(creative),
    status: inferVersionStatusFromCreative(creative),
    public_url: creative.file_url ?? null,
    mime_type: creative.mime_type ?? null,
    width: creative.width ?? null,
    height: creative.height ?? null,
    duration_ms: creative.duration_ms ?? null,
    file_size: creative.file_size ?? null,
    metadata: {
      legacyCreativeId: creative.id,
      legacyType: creative.type ?? null,
    },
  });
}

export async function submitCreativeVersionForReview(pool, workspaceId, versionId) {
  const { rows } = await pool.query(
    `UPDATE creative_versions
     SET status = 'pending_review',
         updated_at = NOW()
     WHERE workspace_id = $1
       AND id = $2
       AND status IN ('draft', 'rejected')
     RETURNING *`,
    [workspaceId, versionId],
  );
  const version = rows[0] ?? null;
  if (version) {
    await syncCreativeApprovalStatus(pool, workspaceId, version.creative_id, 'pending_review');
  }
  return version;
}

export async function approveCreativeVersion(pool, workspaceId, versionId, reviewerId, notes = null) {
  const { rows } = await pool.query(
    `UPDATE creative_versions
     SET status = 'approved',
         reviewed_by = $3,
         reviewed_at = NOW(),
         review_notes = $4,
         updated_at = NOW()
     WHERE workspace_id = $1
       AND id = $2
       AND status = 'pending_review'
     RETURNING *`,
    [workspaceId, versionId, reviewerId, notes],
  );
  const version = rows[0] ?? null;
  if (version) {
    await syncCreativeApprovalStatus(pool, workspaceId, version.creative_id, 'approved', reviewerId, notes);
  }
  return version;
}

export async function rejectCreativeVersion(pool, workspaceId, versionId, reviewerId, reason) {
  const { rows } = await pool.query(
    `UPDATE creative_versions
     SET status = 'rejected',
         reviewed_by = $3,
         reviewed_at = NOW(),
         review_notes = $4,
         updated_at = NOW()
     WHERE workspace_id = $1
       AND id = $2
       AND status = 'pending_review'
     RETURNING *`,
    [workspaceId, versionId, reviewerId, reason],
  );
  const version = rows[0] ?? null;
  if (version) {
    await syncCreativeApprovalStatus(pool, workspaceId, version.creative_id, 'rejected', reviewerId, reason);
  }
  return version;
}

export async function listCreativeArtifacts(pool, workspaceId, creativeVersionId) {
  const { rows } = await pool.query(
    `SELECT *
     FROM creative_artifacts
     WHERE workspace_id = $1
       AND creative_version_id = $2
     ORDER BY created_at ASC`,
    [workspaceId, creativeVersionId],
  );
  return rows;
}

export async function listCreativeSizeVariants(pool, workspaceId, creativeVersionId) {
  const { rows } = await pool.query(
    `SELECT *
     FROM creative_size_variants
     WHERE workspace_id = $1
       AND creative_version_id = $2
     ORDER BY width ASC, height ASC, created_at ASC`,
    [workspaceId, creativeVersionId],
  );
  return rows;
}

export async function listCreativeSizeVariantBindingSummaries(pool, workspaceId, creativeVersionId) {
  const { rows } = await pool.query(
    `SELECT
       csv.id AS creative_size_variant_id,
       COUNT(tb.id)::int AS binding_count,
       COUNT(*) FILTER (WHERE tb.status = 'active')::int AS active_binding_count,
       ARRAY_REMOVE(ARRAY_AGG(DISTINCT at.name), NULL) AS tag_names
     FROM creative_size_variants csv
     LEFT JOIN tag_bindings tb
       ON tb.creative_size_variant_id = csv.id
      AND tb.workspace_id = csv.workspace_id
      AND tb.status <> 'archived'
     LEFT JOIN ad_tags at
       ON at.id = tb.tag_id
      AND at.workspace_id = tb.workspace_id
     WHERE csv.workspace_id = $1
       AND csv.creative_version_id = $2
     GROUP BY csv.id`,
    [workspaceId, creativeVersionId],
  );
  return rows;
}

export async function listCreativeSizeVariantPerformanceSummaries(pool, workspaceId, creativeVersionId) {
  const { rows } = await pool.query(
    `SELECT
       csv.id AS creative_size_variant_id,
       COALESCE(SUM(cvds.impressions), 0)::bigint AS total_impressions,
       COALESCE(SUM(cvds.clicks), 0)::bigint AS total_clicks,
       COALESCE(SUM(CASE WHEN cvds.date >= CURRENT_DATE - 6 THEN cvds.impressions ELSE 0 END), 0)::bigint AS impressions_7d,
       COALESCE(SUM(CASE WHEN cvds.date >= CURRENT_DATE - 6 THEN cvds.clicks ELSE 0 END), 0)::bigint AS clicks_7d,
       CASE WHEN COALESCE(SUM(cvds.impressions), 0) > 0
            THEN ROUND(COALESCE(SUM(cvds.clicks), 0)::numeric / SUM(cvds.impressions) * 100, 4)
            ELSE 0 END AS ctr
     FROM creative_size_variants csv
     LEFT JOIN creative_variant_daily_stats cvds
       ON cvds.creative_size_variant_id = csv.id
     WHERE csv.workspace_id = $1
       AND csv.creative_version_id = $2
     GROUP BY csv.id`,
    [workspaceId, creativeVersionId],
  );
  return rows;
}

export async function getCreativeSizeVariant(pool, workspaceId, variantId) {
  const { rows } = await pool.query(
    `SELECT *
     FROM creative_size_variants
     WHERE workspace_id = $1
       AND id = $2`,
    [workspaceId, variantId],
  );
  return rows[0] ?? null;
}

export async function createCreativeSizeVariant(pool, workspaceId, data) {
  const {
    creative_version_id,
    label,
    width,
    height,
    status = 'draft',
    public_url = null,
    artifact_id = null,
    metadata = {},
    created_by = null,
  } = data;

  const variantLabel = String(label ?? '').trim() || `${width}x${height}`;
  const { rows } = await pool.query(
    `INSERT INTO creative_size_variants (
       workspace_id, creative_version_id, label, width, height,
       status, public_url, artifact_id, metadata, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
     RETURNING *`,
    [
      workspaceId,
      creative_version_id,
      variantLabel,
      Math.max(1, Number(width) || 1),
      Math.max(1, Number(height) || 1),
      normalizeVariantStatus(status),
      public_url,
      artifact_id,
      JSON.stringify(metadata ?? {}),
      created_by,
    ],
  );
  return rows[0] ?? null;
}

export async function ensureCreativeVersionDefaultVariant(pool, workspaceId, creativeVersion, options = {}) {
  if (!creativeVersion?.id || !creativeVersion?.width || !creativeVersion?.height) {
    return null;
  }

  const existingVariants = await listCreativeSizeVariants(pool, workspaceId, creativeVersion.id);
  const matchingVariant = existingVariants.find((variant) =>
    Number(variant.width) === Number(creativeVersion.width)
    && Number(variant.height) === Number(creativeVersion.height),
  );

  const desiredStatus = creativeVersion.status === 'approved'
    ? 'active'
    : creativeVersion.status === 'archived'
      ? 'archived'
      : options.defaultStatus ?? 'draft';

  if (matchingVariant) {
    const patch = {};
    if (!matchingVariant.public_url && creativeVersion.public_url) {
      patch.publicUrl = creativeVersion.public_url;
    }
    if (matchingVariant.status !== desiredStatus && (matchingVariant.metadata?.defaultVariant || options.forceStatusSync)) {
      patch.status = desiredStatus;
    }
    if (Object.keys(patch).length > 0) {
      return updateCreativeSizeVariant(pool, workspaceId, matchingVariant.id, patch);
    }
    return matchingVariant;
  }

  return createCreativeSizeVariant(pool, workspaceId, {
    creative_version_id: creativeVersion.id,
    label: `${creativeVersion.width}x${creativeVersion.height}`,
    width: creativeVersion.width,
    height: creativeVersion.height,
    status: desiredStatus,
    public_url: creativeVersion.public_url ?? null,
    metadata: {
      defaultVariant: true,
      source: 'creative_version',
    },
    created_by: creativeVersion.created_by ?? null,
  });
}

export async function createCreativeSizeVariantsBulk(pool, workspaceId, creativeVersionId, variants = [], options = {}) {
  if (!Array.isArray(variants) || variants.length === 0) {
    return [];
  }

  const created = [];
  for (const variant of variants) {
    const createdVariant = await createCreativeSizeVariant(pool, workspaceId, {
      creative_version_id: creativeVersionId,
      label: variant.label,
      width: variant.width,
      height: variant.height,
      status: variant.status ?? options.status ?? 'draft',
      public_url: variant.public_url ?? options.public_url ?? null,
      artifact_id: variant.artifact_id ?? null,
      metadata: variant.metadata ?? {},
      created_by: options.created_by ?? null,
    });
    if (createdVariant) {
      created.push(createdVariant);
    }
  }
  return created;
}

export async function updateCreativeSizeVariant(pool, workspaceId, variantId, patch = {}) {
  const fieldMap = {
    label: 'label',
    width: 'width',
    height: 'height',
    status: 'status',
    publicUrl: 'public_url',
    artifactId: 'artifact_id',
    metadata: 'metadata',
  };

  const params = [workspaceId, variantId];
  const setClauses = [];

  for (const [camel, column] of Object.entries(fieldMap)) {
    if (!(camel in patch)) continue;
    const value = patch[camel];
    if (column === 'metadata') {
      params.push(JSON.stringify(value ?? {}));
      setClauses.push(`${column} = $${params.length}::jsonb`);
    } else if (column === 'status') {
      params.push(normalizeVariantStatus(value));
      setClauses.push(`${column} = $${params.length}`);
    } else if (column === 'width' || column === 'height') {
      params.push(Math.max(1, Number(value) || 1));
      setClauses.push(`${column} = $${params.length}`);
    } else {
      params.push(value);
      setClauses.push(`${column} = $${params.length}`);
    }
  }

  if (!setClauses.length) {
    return getCreativeSizeVariant(pool, workspaceId, variantId);
  }

  setClauses.push('updated_at = NOW()');

  const { rows } = await pool.query(
    `UPDATE creative_size_variants
     SET ${setClauses.join(', ')}
     WHERE workspace_id = $1
       AND id = $2
     RETURNING *`,
    params,
  );
  return rows[0] ?? null;
}

export async function updateCreativeSizeVariantsBulkStatus(pool, workspaceId, variantIds = [], status = 'draft') {
  const ids = Array.from(new Set((variantIds ?? []).filter(Boolean)));
  if (!ids.length) return [];

  const { rows } = await pool.query(
    `UPDATE creative_size_variants
     SET status = $3,
         updated_at = NOW()
     WHERE workspace_id = $1
       AND id = ANY($2::uuid[])
     RETURNING *`,
    [workspaceId, ids, normalizeVariantStatus(status)],
  );
  return rows;
}

export async function createCreativeArtifact(pool, workspaceId, data) {
  const {
    creative_version_id,
    kind,
    storage_key = null,
    public_url = null,
    mime_type = null,
    size_bytes = null,
    checksum = null,
    metadata = {},
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO creative_artifacts (
       workspace_id, creative_version_id, kind,
       storage_key, public_url, mime_type, size_bytes,
       checksum, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
     RETURNING *`,
    [
      workspaceId,
      creative_version_id,
      kind,
      storage_key,
      public_url,
      mime_type,
      size_bytes,
      checksum,
      JSON.stringify(metadata ?? {}),
    ],
  );
  return rows[0] ?? null;
}

export async function listVideoRenditions(pool, workspaceId, creativeVersionId) {
  const { rows } = await pool.query(
    `SELECT vr.*,
            ca.public_url AS artifact_public_url,
            ca.storage_key AS artifact_storage_key,
            ca.mime_type AS artifact_mime_type,
            ca.size_bytes AS artifact_size_bytes,
            ca.metadata AS artifact_metadata
     FROM video_renditions vr
     LEFT JOIN creative_artifacts ca
       ON ca.id = vr.artifact_id
      AND ca.workspace_id = vr.workspace_id
     WHERE vr.workspace_id = $1
       AND vr.creative_version_id = $2
     ORDER BY vr.sort_order ASC, vr.created_at ASC`,
    [workspaceId, creativeVersionId],
  );
  return rows;
}

export async function createVideoRendition(pool, workspaceId, data) {
  const {
    creative_version_id,
    artifact_id = null,
    label,
    width = null,
    height = null,
    bitrate_kbps = null,
    codec = null,
    mime_type = null,
    status = 'draft',
    is_source = false,
    sort_order = 0,
    metadata = {},
  } = data;

  if (!creative_version_id) {
    throw new Error('creative_version_id is required');
  }
  if (!label) {
    throw new Error('label is required');
  }

  const { rows } = await pool.query(
    `INSERT INTO video_renditions (
       workspace_id, creative_version_id, artifact_id, label, width, height,
       bitrate_kbps, codec, mime_type, status, is_source, sort_order, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
     RETURNING *`,
    [
      workspaceId,
      creative_version_id,
      artifact_id,
      String(label).trim(),
      width,
      height,
      bitrate_kbps,
      codec,
      mime_type,
      normalizeVideoRenditionStatus(status),
      Boolean(is_source),
      Number(sort_order) || 0,
      JSON.stringify(metadata ?? {}),
    ],
  );
  return rows[0] ?? null;
}

export async function updateVideoRendition(pool, workspaceId, renditionId, patch = {}) {
  const fieldMap = {
    label: 'label',
    width: 'width',
    height: 'height',
    bitrateKbps: 'bitrate_kbps',
    codec: 'codec',
    mimeType: 'mime_type',
    status: 'status',
    isSource: 'is_source',
    sortOrder: 'sort_order',
    metadata: 'metadata',
    artifactId: 'artifact_id',
  };

  const params = [workspaceId, renditionId];
  const setClauses = [];

  for (const [camel, column] of Object.entries(fieldMap)) {
    if (!(camel in patch)) continue;
    const value = patch[camel];
    if (column === 'metadata') {
      params.push(JSON.stringify(value ?? {}));
      setClauses.push(`${column} = $${params.length}::jsonb`);
    } else if (column === 'status') {
      params.push(normalizeVideoRenditionStatus(value));
      setClauses.push(`${column} = $${params.length}`);
    } else if (column === 'is_source') {
      params.push(Boolean(value));
      setClauses.push(`${column} = $${params.length}`);
    } else if (column === 'sort_order' || column === 'bitrate_kbps' || column === 'width' || column === 'height') {
      params.push(value == null ? null : Number(value));
      setClauses.push(`${column} = $${params.length}`);
    } else {
      params.push(value);
      setClauses.push(`${column} = $${params.length}`);
    }
  }

  if (!setClauses.length) {
    const { rows } = await pool.query(
      `SELECT *
       FROM video_renditions
       WHERE workspace_id = $1
         AND id = $2`,
      [workspaceId, renditionId],
    );
    return rows[0] ?? null;
  }

  setClauses.push('updated_at = NOW()');
  const { rows } = await pool.query(
    `UPDATE video_renditions
     SET ${setClauses.join(', ')}
     WHERE workspace_id = $1
       AND id = $2
     RETURNING *`,
    params,
  );
  return rows[0] ?? null;
}

export async function listTagBindings(pool, workspaceId, tagId, opts = {}) {
  const params = [workspaceId, tagId];
  const conditions = ['tb.workspace_id = $1', 'tb.tag_id = $2'];

  if (opts.status) {
    params.push(normalizeBindingStatus(opts.status));
    conditions.push(`tb.status = $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT tb.*, cv.version_number, cv.source_kind, cv.serving_format,
            cv.status AS creative_version_status, cv.public_url, cv.entry_path,
            c.name AS creative_name,
            csv.label AS variant_label,
            csv.width AS variant_width,
            csv.height AS variant_height,
            csv.status AS variant_status
     FROM tag_bindings tb
     JOIN creative_versions cv ON cv.id = tb.creative_version_id
     JOIN creatives c ON c.id = cv.creative_id
     LEFT JOIN creative_size_variants csv ON csv.id = tb.creative_size_variant_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY tb.weight DESC, tb.created_at ASC`,
    params,
  );
  return rows;
}

export async function createTagBinding(pool, workspaceId, data) {
  const {
    tag_id,
    creative_version_id,
    creative_size_variant_id = null,
    status = 'active',
    weight = 1,
    start_at = null,
    end_at = null,
    created_by = null,
  } = data;

  const existing = creative_size_variant_id
    ? await pool.query(
      `SELECT *
       FROM tag_bindings
       WHERE workspace_id = $1
         AND tag_id = $2
         AND (
           creative_size_variant_id = $3::uuid
           OR (creative_version_id = $4::uuid AND creative_size_variant_id IS NULL)
         )
       ORDER BY
         CASE WHEN creative_size_variant_id = $3::uuid THEN 0 ELSE 1 END,
         created_at ASC
       LIMIT 1`,
      [workspaceId, tag_id, creative_size_variant_id, creative_version_id],
    )
    : await pool.query(
      `SELECT *
       FROM tag_bindings
       WHERE workspace_id = $1
         AND tag_id = $2
         AND creative_version_id = $3
         AND creative_size_variant_id IS NULL`,
      [workspaceId, tag_id, creative_version_id],
    );

  if (existing.rows[0]) {
    const { rows } = await pool.query(
      `UPDATE tag_bindings
       SET status = $3,
           weight = $4,
           start_at = $5,
           end_at = $6,
           created_by = COALESCE($7, created_by),
           creative_version_id = $8,
           creative_size_variant_id = $9,
           updated_at = NOW()
       WHERE workspace_id = $1
         AND id = $2
       RETURNING *`,
      [
        workspaceId,
        existing.rows[0].id,
        normalizeBindingStatus(status),
        Math.max(1, Number(weight) || 1),
        start_at,
        end_at,
        created_by,
        creative_version_id,
        creative_size_variant_id,
      ],
    );
    return rows[0] ?? null;
  }

  const { rows } = await pool.query(
    `INSERT INTO tag_bindings (
       workspace_id, tag_id, creative_version_id, creative_size_variant_id,
       status, weight, start_at, end_at, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      workspaceId,
      tag_id,
      creative_version_id,
      creative_size_variant_id,
      normalizeBindingStatus(status),
      Math.max(1, Number(weight) || 1),
      start_at,
      end_at,
      created_by,
    ],
  );
  return rows[0] ?? null;
}

export async function updateTagBinding(pool, workspaceId, bindingId, data = {}) {
  const updates = [];
  const params = [workspaceId, bindingId];

  if (data.status !== undefined) {
    params.push(normalizeBindingStatus(data.status));
    updates.push(`status = $${params.length}`);
  }

  if (data.weight !== undefined) {
    params.push(Math.max(1, Number(data.weight) || 1));
    updates.push(`weight = $${params.length}`);
  }

  if (data.start_at !== undefined) {
    params.push(data.start_at);
    updates.push(`start_at = $${params.length}`);
  }

  if (data.end_at !== undefined) {
    params.push(data.end_at);
    updates.push(`end_at = $${params.length}`);
  }

  if (updates.length === 0) {
    const { rows } = await pool.query(
      `SELECT *
       FROM tag_bindings
       WHERE workspace_id = $1
         AND id = $2`,
      params,
    );
    return rows[0] ?? null;
  }

  const { rows } = await pool.query(
    `UPDATE tag_bindings
     SET ${updates.join(', ')},
         updated_at = NOW()
     WHERE workspace_id = $1
       AND id = $2
     RETURNING *`,
    params,
  );
  return rows[0] ?? null;
}

export async function getActiveTagBinding(pool, workspaceId, tagId, at = new Date()) {
  const { rows } = await pool.query(
    `SELECT tb.*, cv.version_number, cv.source_kind, cv.serving_format,
            cv.status AS creative_version_status, cv.public_url, cv.entry_path,
            cv.mime_type, cv.width, cv.height, cv.duration_ms,
            c.id AS creative_id, c.name AS creative_name, c.click_url
     FROM tag_bindings tb
     JOIN creative_versions cv ON cv.id = tb.creative_version_id
     JOIN creatives c ON c.id = cv.creative_id
     WHERE tb.workspace_id = $1
       AND tb.tag_id = $2
       AND tb.status = 'active'
       AND cv.status = 'approved'
       AND (tb.start_at IS NULL OR tb.start_at <= $3)
       AND (tb.end_at IS NULL OR tb.end_at >= $3)
     ORDER BY tb.weight DESC, tb.created_at ASC
     LIMIT 1`,
    [workspaceId, tagId, at],
  );
  return rows[0] ?? null;
}
