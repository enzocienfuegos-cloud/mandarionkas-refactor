const VALID_STATUSES = ['draft', 'active', 'paused', 'archived'];
const VALID_FORMATS  = ['vast', 'display', 'native'];

function normalizeTagFormat(format) {
  if (!format) return null;
  const normalized = String(format).trim().toLowerCase();
  if (normalized === 'vast_video') return 'vast';
  return VALID_FORMATS.includes(normalized) ? normalized : null;
}

function normalizeTagStatus(status) {
  if (!status) return null;
  const normalized = String(status).trim().toLowerCase();
  return VALID_STATUSES.includes(normalized) ? normalized : null;
}

export async function listTags(pool, workspaceId, opts = {}) {
  const { status, format, campaignId, limit = 100, offset = 0, search } = opts;
  const params = [workspaceId];
  const conditions = ['t.workspace_id = $1'];

  if (status) {
    params.push(normalizeTagStatus(status) ?? status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (format) {
    params.push(normalizeTagFormat(format) ?? format);
    conditions.push(`t.format = $${params.length}`);
  }
  if (campaignId) {
    params.push(campaignId);
    conditions.push(`t.campaign_id = $${params.length}`);
  }
  if (search && search.trim().length >= 2) {
    params.push(search.trim());
    conditions.push(`t.search_vec @@ websearch_to_tsquery('english', $${params.length})`);
  }

  params.push(Math.min(Number(limit) || 100, 500));
  params.push(Number(offset) || 0);

  const { rows } = await pool.query(
    `SELECT t.id, t.workspace_id, t.campaign_id, t.name, t.format, t.status,
            t.click_url, t.impression_url, t.tag_code, t.description,
            t.targeting, t.frequency_cap, t.frequency_cap_window,
            t.geo_targets, t.device_targets, t.created_at, t.updated_at,
            c.name AS campaign_name
     FROM ad_tags t
     LEFT JOIN campaigns c ON c.id = t.campaign_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function getTag(pool, workspaceId, tagId) {
  const { rows } = await pool.query(
    `SELECT t.id, t.workspace_id, t.campaign_id, t.name, t.format, t.status,
            t.click_url, t.impression_url, t.tag_code, t.description,
            t.targeting, t.frequency_cap, t.frequency_cap_window,
            t.geo_targets, t.device_targets, t.created_at, t.updated_at,
            c.name AS campaign_name
     FROM ad_tags t
     LEFT JOIN campaigns c ON c.id = t.campaign_id
     WHERE t.workspace_id = $1 AND t.id = $2`,
    [workspaceId, tagId],
  );
  return rows[0] ?? null;
}

export async function createTag(pool, workspaceId, data) {
  const {
    campaign_id = null, name, format = 'display', status = 'active',
    click_url = null, impression_url = null, tag_code = null,
    description = null, targeting = {}, frequency_cap = null,
    frequency_cap_window = null, geo_targets = [], device_targets = [],
  } = data;

  const normalizedFormat = normalizeTagFormat(format) ?? 'display';
  const normalizedStatus = normalizeTagStatus(status) ?? 'active';

  const { rows } = await pool.query(
    `INSERT INTO ad_tags
       (workspace_id, campaign_id, name, format, status, click_url, impression_url,
        tag_code, description, targeting, frequency_cap, frequency_cap_window,
        geo_targets, device_targets)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [workspaceId, campaign_id, name, normalizedFormat, normalizedStatus, click_url, impression_url,
     tag_code, description, JSON.stringify(targeting), frequency_cap,
     frequency_cap_window, geo_targets, device_targets],
  );
  return rows[0];
}

export async function updateTag(pool, workspaceId, tagId, data) {
  const allowed = [
    'campaign_id', 'name', 'format', 'status', 'click_url', 'impression_url',
    'tag_code', 'description', 'targeting', 'frequency_cap', 'frequency_cap_window',
    'geo_targets', 'device_targets',
  ];
  const setClauses = [];
  const params = [workspaceId, tagId];
  for (const key of allowed) {
    if (key in data) {
      let value = data[key];
      if (key === 'targeting') value = JSON.stringify(value);
      if (key === 'format') value = normalizeTagFormat(value) ?? value;
      if (key === 'status') value = normalizeTagStatus(value) ?? value;
      params.push(value);
      setClauses.push(`${key} = $${params.length}`);
    }
  }
  if (setClauses.length === 0) return getTag(pool, workspaceId, tagId);

  setClauses.push(`updated_at = NOW()`);
  const { rows } = await pool.query(
    `UPDATE ad_tags SET ${setClauses.join(', ')}
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    params,
  );
  return rows[0] ?? null;
}

export async function deleteTag(pool, workspaceId, tagId) {
  const { rowCount } = await pool.query(
    `DELETE FROM ad_tags WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, tagId],
  );
  return rowCount > 0;
}

export async function getTagWithCreatives(pool, workspaceId, tagId) {
  const tag = await getTag(pool, workspaceId, tagId);
  if (!tag) return null;

  const { rows: creatives } = await pool.query(
    `SELECT c.id, c.name, c.type, c.file_url, c.width, c.height, c.duration_ms,
            c.approval_status, c.transcode_status, c.click_url,
            tc.weight, tc.created_at AS assigned_at
     FROM tag_creatives tc
     JOIN creatives c ON c.id = tc.creative_id
     WHERE tc.tag_id = $1
     ORDER BY tc.weight DESC, tc.created_at ASC`,
    [tagId],
  );
  return { ...tag, creatives };
}
