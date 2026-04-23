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
  return rows[0] ?? null;
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
            c.name AS creative_name
     FROM tag_bindings tb
     JOIN creative_versions cv ON cv.id = tb.creative_version_id
     JOIN creatives c ON c.id = cv.creative_id
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
    status = 'active',
    weight = 1,
    start_at = null,
    end_at = null,
    created_by = null,
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO tag_bindings (
       workspace_id, tag_id, creative_version_id,
       status, weight, start_at, end_at, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (tag_id, creative_version_id)
     DO UPDATE SET
       status = EXCLUDED.status,
       weight = EXCLUDED.weight,
       start_at = EXCLUDED.start_at,
       end_at = EXCLUDED.end_at,
       created_by = COALESCE(EXCLUDED.created_by, tag_bindings.created_by),
       updated_at = NOW()
     RETURNING *`,
    [
      workspaceId,
      tag_id,
      creative_version_id,
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
