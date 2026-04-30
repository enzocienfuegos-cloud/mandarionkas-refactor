function normalizeLimit(limit, fallback = 100) {
  return Math.min(Math.max(Number(limit) || fallback, 1), 500);
}

function normalizeOffset(offset) {
  return Math.max(Number(offset) || 0, 0);
}

function normalizeSearch(search) {
  const value = String(search || '').trim().toLowerCase();
  return value.length >= 2 ? value : '';
}

function latestVersionSelect() {
  return `
    SELECT DISTINCT ON (cv.creative_id)
      cv.id,
      cv.workspace_id,
      cv.creative_id,
      cv.version_number,
      cv.source_kind,
      cv.serving_format,
      cv.status,
      cv.public_url,
      cv.entry_path,
      cv.mime_type,
      cv.width,
      cv.height,
      cv.duration_ms,
      cv.file_size,
      cv.metadata,
      cv.created_by,
      cv.reviewed_by,
      cv.reviewed_at,
      cv.review_notes,
      cv.created_at,
      cv.updated_at
    FROM creative_versions cv
    WHERE cv.creative_id = c.id
    ORDER BY cv.creative_id, cv.version_number DESC, cv.created_at DESC
    LIMIT 1
  `;
}

export async function listCreatives(pool, workspaceId, opts = {}) {
  const { approval_status, type, limit = 100, offset = 0, search, includeLatestVersion = false } = opts;
  const params = [workspaceId];
  const conditions = ['c.workspace_id = $1'];
  const normalizedSearch = normalizeSearch(search);

  if (approval_status) {
    params.push(approval_status);
    conditions.push(`c.approval_status = $${params.length}`);
  }
  if (type) {
    params.push(type);
    conditions.push(`c.type = $${params.length}`);
  }
  if (normalizedSearch) {
    params.push(`%${normalizedSearch}%`);
    conditions.push(`LOWER(c.name) LIKE $${params.length}`);
  }

  params.push(normalizeLimit(limit));
  params.push(normalizeOffset(offset));

  const latestJoin = includeLatestVersion
    ? `LEFT JOIN LATERAL (${latestVersionSelect()}) latest_version ON TRUE`
    : '';
  const latestSelect = includeLatestVersion
    ? `,
       row_to_json(latest_version) AS latest_version`
    : '';

  const { rows } = await pool.query(
    `SELECT c.id, c.workspace_id, c.name, c.type, c.file_url, c.thumbnail_url, c.file_size,
            c.mime_type, c.width, c.height, c.duration_ms, c.click_url, c.metadata,
            c.approval_status, c.reviewed_by, c.reviewed_at, c.review_notes,
            c.transcode_status, c.created_at, c.updated_at
            ${latestSelect}
     FROM creatives c
     ${latestJoin}
     WHERE ${conditions.join(' AND ')}
     ORDER BY c.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function listCreativesForUser(pool, userId, opts = {}) {
  const { approval_status, type, workspaceId, limit = 100, offset = 0, search, includeLatestVersion = false } = opts;
  const params = [userId];
  const conditions = ["wm.user_id = $1", "wm.status = 'active'"];
  const normalizedSearch = normalizeSearch(search);

  if (workspaceId) {
    params.push(workspaceId);
    conditions.push(`c.workspace_id = $${params.length}`);
  }
  if (approval_status) {
    params.push(approval_status);
    conditions.push(`c.approval_status = $${params.length}`);
  }
  if (type) {
    params.push(type);
    conditions.push(`c.type = $${params.length}`);
  }
  if (normalizedSearch) {
    params.push(`%${normalizedSearch}%`);
    conditions.push(`LOWER(c.name) LIKE $${params.length}`);
  }

  params.push(normalizeLimit(limit));
  params.push(normalizeOffset(offset));

  const latestJoin = includeLatestVersion
    ? `LEFT JOIN LATERAL (${latestVersionSelect()}) latest_version ON TRUE`
    : '';
  const latestSelect = includeLatestVersion
    ? `,
       row_to_json(latest_version) AS latest_version`
    : '';

  const { rows } = await pool.query(
    `SELECT c.id, c.workspace_id, w.name AS workspace_name, c.name, c.type, c.file_url, c.thumbnail_url, c.file_size,
            c.mime_type, c.width, c.height, c.duration_ms, c.click_url, c.metadata,
            c.approval_status, c.reviewed_by, c.reviewed_at, c.review_notes,
            c.transcode_status, c.created_at, c.updated_at
            ${latestSelect}
     FROM creatives c
     JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
     JOIN workspaces w ON w.id = c.workspace_id
     ${latestJoin}
     WHERE ${conditions.join(' AND ')}
     ORDER BY c.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function getCreative(pool, workspaceId, id) {
  const { rows } = await pool.query(
    `SELECT c.id, c.workspace_id, c.name, c.type, c.file_url, c.thumbnail_url, c.file_size,
            c.mime_type, c.width, c.height, c.duration_ms, c.click_url, c.metadata,
            c.approval_status, c.reviewed_by, c.reviewed_at, c.review_notes,
            c.transcode_status, c.created_at, c.updated_at
     FROM creatives c
     WHERE c.workspace_id = $1 AND c.id = $2`,
    [workspaceId, id],
  );
  return rows[0] ?? null;
}

export async function updateCreative(pool, workspaceId, id, input = {}) {
  const fields = [];
  const params = [workspaceId, id];

  if (Object.prototype.hasOwnProperty.call(input, 'name')) {
    params.push(String(input.name || '').trim());
    fields.push(`name = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'click_url')) {
    params.push(input.click_url || null);
    fields.push(`click_url = $${params.length}`);
  }
  if (!fields.length) {
    return getCreative(pool, workspaceId, id);
  }

  fields.push('updated_at = NOW()');
  const { rows } = await pool.query(
    `UPDATE creatives
     SET ${fields.join(', ')}
     WHERE workspace_id = $1 AND id = $2
     RETURNING id, workspace_id, name, type, file_url, thumbnail_url, file_size,
               mime_type, width, height, duration_ms, click_url, metadata,
               approval_status, reviewed_by, reviewed_at, review_notes,
               transcode_status, created_at, updated_at`,
    params,
  );
  return rows[0] ?? null;
}

export async function deleteCreative(pool, workspaceId, id) {
  const result = await pool.query(
    `DELETE FROM creatives WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, id],
  );
  return result.rowCount > 0;
}

export async function listCreativeVersions(pool, workspaceId, creativeId) {
  const { rows } = await pool.query(
    `SELECT id, workspace_id, creative_id, version_number, source_kind, serving_format,
            status, public_url, entry_path, mime_type, width, height, duration_ms,
            file_size, metadata, created_by, reviewed_by, reviewed_at, review_notes,
            created_at, updated_at
     FROM creative_versions
     WHERE workspace_id = $1 AND creative_id = $2
     ORDER BY version_number DESC, created_at DESC`,
    [workspaceId, creativeId],
  );
  return rows;
}

export async function getCreativeVersion(pool, workspaceId, versionId) {
  const { rows } = await pool.query(
    `SELECT id, workspace_id, creative_id, version_number, source_kind, serving_format,
            status, public_url, entry_path, mime_type, width, height, duration_ms,
            file_size, metadata, created_by, reviewed_by, reviewed_at, review_notes,
            created_at, updated_at
     FROM creative_versions
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, versionId],
  );
  return rows[0] ?? null;
}

export async function listPendingReviewCreativeVersions(pool, userId) {
  const { rows } = await pool.query(
    `SELECT cv.id, cv.workspace_id, w.name AS workspace_name, cv.creative_id, c.name AS creative_name,
            cv.version_number, cv.source_kind, cv.serving_format, cv.status, cv.public_url, cv.entry_path,
            cv.mime_type, cv.width, cv.height, cv.duration_ms, cv.file_size, cv.metadata, cv.created_by,
            cv.reviewed_by, cv.reviewed_at, cv.review_notes, cv.created_at, cv.updated_at
     FROM creative_versions cv
     JOIN creatives c ON c.id = cv.creative_id
     JOIN workspace_members wm ON wm.workspace_id = cv.workspace_id
     JOIN workspaces w ON w.id = cv.workspace_id
     WHERE wm.user_id = $1
       AND wm.status = 'active'
       AND cv.status = 'pending_review'
     ORDER BY cv.created_at DESC`,
    [userId],
  );
  return rows;
}

export async function updateCreativeVersion(pool, workspaceId, versionId, input = {}) {
  const fields = [];
  const params = [workspaceId, versionId];

  for (const [key, value] of Object.entries({
    status: input.status,
    metadata: input.metadata,
    reviewed_by: input.reviewed_by,
    reviewed_at: input.reviewed_at,
    review_notes: input.review_notes,
  })) {
    if (value === undefined) continue;
    params.push(key === 'metadata' ? JSON.stringify(value ?? {}) : value);
    if (key === 'metadata') {
      fields.push(`metadata = $${params.length}::jsonb`);
    } else {
      fields.push(`${key} = $${params.length}`);
    }
  }

  if (!fields.length) {
    return getCreativeVersion(pool, workspaceId, versionId);
  }

  fields.push('updated_at = NOW()');
  const { rows } = await pool.query(
    `UPDATE creative_versions
     SET ${fields.join(', ')}
     WHERE workspace_id = $1 AND id = $2
     RETURNING id, workspace_id, creative_id, version_number, source_kind, serving_format,
               status, public_url, entry_path, mime_type, width, height, duration_ms,
               file_size, metadata, created_by, reviewed_by, reviewed_at, review_notes,
               created_at, updated_at`,
    params,
  );
  return rows[0] ?? null;
}

export async function listCreativeArtifacts(pool, workspaceId, creativeVersionId) {
  const { rows } = await pool.query(
    `SELECT id, workspace_id, creative_version_id, kind, storage_key, public_url, mime_type,
            size_bytes, checksum, metadata, created_at, updated_at
     FROM creative_artifacts
     WHERE workspace_id = $1 AND creative_version_id = $2
     ORDER BY created_at DESC`,
    [workspaceId, creativeVersionId],
  );
  return rows;
}

export async function listCreativeIngestions(pool, workspaceId, opts = {}) {
  const { status, sourceKind, limit = 100, offset = 0 } = opts;
  const params = [workspaceId];
  const conditions = ['ci.workspace_id = $1'];

  if (status) {
    params.push(status);
    conditions.push(`ci.status = $${params.length}`);
  }
  if (sourceKind) {
    params.push(sourceKind);
    conditions.push(`ci.source_kind = $${params.length}`);
  }

  params.push(normalizeLimit(limit));
  params.push(normalizeOffset(offset));

  const { rows } = await pool.query(
    `SELECT ci.id, ci.workspace_id, ci.created_by, ci.creative_id, ci.creative_version_id,
            ci.source_kind, ci.status, ci.original_filename, ci.mime_type, ci.size_bytes,
            ci.storage_key, ci.public_url, ci.checksum, ci.metadata, ci.validation_report,
            ci.error_code, ci.error_detail, ci.created_at, ci.updated_at
     FROM creative_ingestions ci
     WHERE ${conditions.join(' AND ')}
     ORDER BY ci.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function listCreativeIngestionsForUser(pool, userId, opts = {}) {
  const { workspaceId, status, sourceKind, limit = 100, offset = 0 } = opts;
  const params = [userId];
  const conditions = ["wm.user_id = $1", "wm.status = 'active'"];

  if (workspaceId) {
    params.push(workspaceId);
    conditions.push(`ci.workspace_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`ci.status = $${params.length}`);
  }
  if (sourceKind) {
    params.push(sourceKind);
    conditions.push(`ci.source_kind = $${params.length}`);
  }

  params.push(normalizeLimit(limit));
  params.push(normalizeOffset(offset));

  const { rows } = await pool.query(
    `SELECT ci.id, ci.workspace_id, w.name AS workspace_name, ci.created_by, ci.creative_id, ci.creative_version_id,
            ci.source_kind, ci.status, ci.original_filename, ci.mime_type, ci.size_bytes,
            ci.storage_key, ci.public_url, ci.checksum, ci.metadata, ci.validation_report,
            ci.error_code, ci.error_detail, ci.created_at, ci.updated_at
     FROM creative_ingestions ci
     JOIN workspace_members wm ON wm.workspace_id = ci.workspace_id
     JOIN workspaces w ON w.id = ci.workspace_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY ci.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function getCreativeIngestion(pool, workspaceId, ingestionId) {
  const { rows } = await pool.query(
    `SELECT ci.id, ci.workspace_id, ci.created_by, ci.creative_id, ci.creative_version_id,
            ci.source_kind, ci.status, ci.original_filename, ci.mime_type, ci.size_bytes,
            ci.storage_key, ci.public_url, ci.checksum, ci.metadata, ci.validation_report,
            ci.error_code, ci.error_detail, ci.created_at, ci.updated_at
     FROM creative_ingestions ci
     WHERE ci.workspace_id = $1 AND ci.id = $2`,
    [workspaceId, ingestionId],
  );
  return rows[0] ?? null;
}
