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
  const conditions = ['wm.user_id = $1'];
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
    params.push(normalizeRawClickUrl(input.click_url));
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
