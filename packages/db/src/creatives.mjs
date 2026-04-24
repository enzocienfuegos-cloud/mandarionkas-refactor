import { ensureLegacyCreativeVersion } from './creative-catalog.mjs';

export async function listCreatives(pool, workspaceId, opts = {}) {
  const { approval_status, type, limit = 100, offset = 0, search } = opts;
  const params = [workspaceId];
  const conditions = ['c.workspace_id = $1'];

  if (approval_status) {
    params.push(approval_status);
    conditions.push(`c.approval_status = $${params.length}`);
  }
  if (type) {
    params.push(type);
    conditions.push(`c.type = $${params.length}`);
  }
  if (search && search.trim().length >= 2) {
    params.push(search.trim());
    conditions.push(`c.search_vec @@ websearch_to_tsquery('english', $${params.length})`);
  }

  params.push(Math.min(Number(limit) || 100, 500));
  params.push(Number(offset) || 0);

  const { rows } = await pool.query(
    `SELECT c.id, c.workspace_id, c.name, c.type, c.file_url, c.file_size,
            c.mime_type, c.width, c.height, c.duration_ms, c.click_url, c.metadata,
            c.approval_status, c.reviewed_by, c.reviewed_at, c.review_notes,
            c.transcode_status, c.created_at, c.updated_at
     FROM creatives c
     WHERE ${conditions.join(' AND ')}
     ORDER BY c.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function listCreativesForUser(pool, userId, opts = {}) {
  const { approval_status, type, workspaceId, limit = 100, offset = 0, search } = opts;
  const params = [userId];
  const conditions = ["wm.user_id = $1", "wm.status = 'active'"];

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
  if (search && search.trim().length >= 2) {
    params.push(search.trim());
    conditions.push(`c.search_vec @@ websearch_to_tsquery('english', $${params.length})`);
  }

  params.push(Math.min(Number(limit) || 100, 500));
  params.push(Number(offset) || 0);

  const { rows } = await pool.query(
    `SELECT c.id, c.workspace_id, w.name AS workspace_name, c.name, c.type, c.file_url, c.file_size,
            c.mime_type, c.width, c.height, c.duration_ms, c.click_url, c.metadata,
            c.approval_status, c.reviewed_by, c.reviewed_at, c.review_notes,
            c.transcode_status, c.created_at, c.updated_at
     FROM creatives c
     JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
     JOIN workspaces w ON w.id = c.workspace_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY c.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function getCreative(pool, workspaceId, id) {
  const { rows } = await pool.query(
    `SELECT c.id, c.workspace_id, c.name, c.type, c.file_url, c.file_size,
            c.mime_type, c.width, c.height, c.duration_ms, c.click_url, c.metadata,
            c.approval_status, c.reviewed_by, c.reviewed_at, c.review_notes,
            c.transcode_status, c.created_at, c.updated_at
     FROM creatives c
     WHERE c.workspace_id = $1 AND c.id = $2`,
    [workspaceId, id],
  );
  return rows[0] ?? null;
}

export async function createCreative(pool, workspaceId, data, options = {}) {
  const {
    name, type = 'image', file_url = null, file_size = null,
    mime_type = null, width = null, height = null, duration_ms = null,
    click_url = null, metadata = {},
    approval_status = 'draft', transcode_status = 'pending',
  } = data;
  const { ensureLegacyVersion = true } = options;

  const { rows } = await pool.query(
    `INSERT INTO creatives
       (workspace_id, name, type, file_url, file_size, mime_type, width, height,
        duration_ms, click_url, metadata, approval_status, transcode_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [workspaceId, name, type, file_url, file_size, mime_type, width, height,
     duration_ms, click_url, JSON.stringify(metadata), approval_status, transcode_status],
  );
  const creative = rows[0];
  if (ensureLegacyVersion) {
    await ensureLegacyCreativeVersion(pool, workspaceId, creative);
  }
  return creative;
}

export async function updateCreative(pool, workspaceId, id, data) {
  const allowed = [
    'name', 'type', 'file_url', 'file_size', 'mime_type', 'width', 'height',
    'duration_ms', 'click_url', 'metadata', 'transcode_status',
  ];
  const setClauses = [];
  const params = [workspaceId, id];
  for (const key of allowed) {
    if (key in data) {
      params.push(key === 'metadata' ? JSON.stringify(data[key]) : data[key]);
      setClauses.push(`${key} = $${params.length}`);
    }
  }
  if (setClauses.length === 0) return getCreative(pool, workspaceId, id);
  setClauses.push(`updated_at = NOW()`);

  const { rows } = await pool.query(
    `UPDATE creatives SET ${setClauses.join(', ')}
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    params,
  );
  const creative = rows[0] ?? null;
  if (creative) {
    await ensureLegacyCreativeVersion(pool, workspaceId, creative);
  }
  return creative;
}

export async function deleteCreative(pool, workspaceId, id) {
  const { rowCount } = await pool.query(
    `DELETE FROM creatives WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, id],
  );
  return rowCount > 0;
}

export async function getCreativesByTag(pool, tagId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.workspace_id, c.name, c.type, c.file_url, c.width, c.height,
            c.duration_ms, c.approval_status, c.transcode_status, c.click_url,
            tc.weight, tc.created_at AS assigned_at
     FROM tag_creatives tc
     JOIN creatives c ON c.id = tc.creative_id
     WHERE tc.tag_id = $1
     ORDER BY tc.weight DESC, tc.created_at ASC`,
    [tagId],
  );
  return rows;
}

export async function assignCreativeToTag(pool, tagId, creativeId, weight = 1) {
  const { rows } = await pool.query(
    `INSERT INTO tag_creatives (tag_id, creative_id, weight)
     VALUES ($1, $2, $3)
     ON CONFLICT (tag_id, creative_id) DO UPDATE SET weight = EXCLUDED.weight
     RETURNING *`,
    [tagId, creativeId, weight],
  );
  return rows[0];
}

export async function removeCreativeFromTag(pool, tagId, creativeId) {
  const { rowCount } = await pool.query(
    `DELETE FROM tag_creatives WHERE tag_id = $1 AND creative_id = $2`,
    [tagId, creativeId],
  );
  return rowCount > 0;
}

export async function submitForReview(pool, workspaceId, id) {
  const { rows } = await pool.query(
    `UPDATE creatives
     SET approval_status = 'pending_review', updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2
       AND approval_status IN ('draft', 'rejected')
     RETURNING *`,
    [workspaceId, id],
  );
  return rows[0] ?? null;
}

export async function approveCreative(pool, workspaceId, id, reviewerId, notes = null) {
  const { rows } = await pool.query(
    `UPDATE creatives
     SET approval_status = 'approved',
         reviewed_by = $3,
         reviewed_at = NOW(),
         review_notes = $4,
         updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2
       AND approval_status = 'pending_review'
     RETURNING *`,
    [workspaceId, id, reviewerId, notes],
  );
  return rows[0] ?? null;
}

export async function rejectCreative(pool, workspaceId, id, reviewerId, reason) {
  const { rows } = await pool.query(
    `UPDATE creatives
     SET approval_status = 'rejected',
         reviewed_by = $3,
         reviewed_at = NOW(),
         review_notes = $4,
         updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2
       AND approval_status = 'pending_review'
     RETURNING *`,
    [workspaceId, id, reviewerId, reason],
  );
  return rows[0] ?? null;
}
