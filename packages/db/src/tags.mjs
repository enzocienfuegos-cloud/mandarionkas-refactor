const VALID_STATUSES = ['draft', 'active', 'paused', 'archived'];
const VALID_FORMATS = ['vast', 'display', 'native', 'tracker'];

function normalizeTagFormat(format) {
  if (!format) return null;
  const normalized = String(format).trim().toLowerCase();
  if (normalized === 'vast_video') return 'vast';
  if (normalized === 'vast') return 'vast';
  return VALID_FORMATS.includes(normalized) ? normalized : null;
}

function normalizeTagStatus(status) {
  if (!status) return null;
  const normalized = String(status).trim().toLowerCase();
  return VALID_STATUSES.includes(normalized) ? normalized : null;
}

function normalizeSearch(search) {
  const value = String(search || '').trim().toLowerCase();
  return value.length >= 2 ? value : '';
}

function normalizeLimit(limit, fallback = 100) {
  return Math.min(Math.max(Number(limit) || fallback, 1), 500);
}

function normalizeOffset(offset) {
  return Math.max(Number(offset) || 0, 0);
}

function baseTagSelect() {
  return `SELECT t.id, t.workspace_id, t.campaign_id, t.name, t.format, t.status,
            t.click_url, t.impression_url, t.tag_code, t.description,
            t.targeting, t.frequency_cap, t.frequency_cap_window,
            t.geo_targets, t.device_targets, t.created_at, t.updated_at,
            c.name AS campaign_name,
            0::int AS assigned_count,
            ''::text AS assigned_names,
            COALESCE(tfc.display_width, 0) AS serving_width,
            COALESCE(tfc.display_height, 0) AS serving_height,
            tfc.tracker_type`;
}

export async function listTags(pool, workspaceId, opts = {}) {
  const { status, format, campaignId, limit = 100, offset = 0, search } = opts;
  const params = [workspaceId];
  const conditions = ['t.workspace_id = $1'];

  const normalizedStatus = normalizeTagStatus(status);
  const normalizedFormat = normalizeTagFormat(format);
  const normalizedSearch = normalizeSearch(search);

  if (normalizedStatus) {
    params.push(normalizedStatus);
    conditions.push(`t.status = $${params.length}`);
  }
  if (normalizedFormat) {
    params.push(normalizedFormat);
    conditions.push(`t.format = $${params.length}`);
  }
  if (campaignId) {
    params.push(campaignId);
    conditions.push(`t.campaign_id = $${params.length}`);
  }
  if (normalizedSearch) {
    params.push(`%${normalizedSearch}%`);
    conditions.push(`LOWER(t.name) LIKE $${params.length}`);
  }

  params.push(normalizeLimit(limit));
  params.push(normalizeOffset(offset));

  const { rows } = await pool.query(
    `${baseTagSelect()}
     FROM ad_tags t
     LEFT JOIN campaigns c ON c.id = t.campaign_id
     LEFT JOIN tag_format_configs tfc ON tfc.tag_id = t.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function listTagsForUser(pool, userId, opts = {}) {
  const { status, format, campaignId, workspaceId, limit = 100, offset = 0, search } = opts;
  const params = [userId];
  const conditions = [`wm.user_id = $1`, `wm.status = 'active'`];

  const normalizedStatus = normalizeTagStatus(status);
  const normalizedFormat = normalizeTagFormat(format);
  const normalizedSearch = normalizeSearch(search);

  if (workspaceId) {
    params.push(workspaceId);
    conditions.push(`t.workspace_id = $${params.length}`);
  }
  if (normalizedStatus) {
    params.push(normalizedStatus);
    conditions.push(`t.status = $${params.length}`);
  }
  if (normalizedFormat) {
    params.push(normalizedFormat);
    conditions.push(`t.format = $${params.length}`);
  }
  if (campaignId) {
    params.push(campaignId);
    conditions.push(`t.campaign_id = $${params.length}`);
  }
  if (normalizedSearch) {
    params.push(`%${normalizedSearch}%`);
    conditions.push(`LOWER(t.name) LIKE $${params.length}`);
  }

  params.push(normalizeLimit(limit));
  params.push(normalizeOffset(offset));

  const { rows } = await pool.query(
    `${baseTagSelect()}, w.name AS workspace_name
     FROM ad_tags t
     JOIN workspace_members wm ON wm.workspace_id = t.workspace_id
     JOIN workspaces w ON w.id = t.workspace_id
     LEFT JOIN campaigns c ON c.id = t.campaign_id
     LEFT JOIN tag_format_configs tfc ON tfc.tag_id = t.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function getTag(pool, workspaceId, tagId) {
  const { rows } = await pool.query(
    `${baseTagSelect()}
     FROM ad_tags t
     LEFT JOIN campaigns c ON c.id = t.campaign_id
     LEFT JOIN tag_format_configs tfc ON tfc.tag_id = t.id
     WHERE t.workspace_id = $1 AND t.id = $2`,
    [workspaceId, tagId],
  );
  return rows[0] ?? null;
}

export async function getTagById(pool, tagId) {
  const { rows } = await pool.query(
    `${baseTagSelect()}
     FROM ad_tags t
     LEFT JOIN campaigns c ON c.id = t.campaign_id
     LEFT JOIN tag_format_configs tfc ON tfc.tag_id = t.id
     WHERE t.id = $1`,
    [tagId],
  );
  return rows[0] ?? null;
}

export async function createTag(pool, workspaceId, data) {
  const {
    campaign_id = null,
    name,
    format = 'display',
    status = 'draft',
    click_url = null,
    impression_url = null,
    description = null,
    targeting = {},
    frequency_cap = null,
    frequency_cap_window = null,
    geo_targets = [],
    device_targets = [],
    serving_width = null,
    serving_height = null,
    tracker_type = null,
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO ad_tags
       (workspace_id, campaign_id, name, format, status, click_url, impression_url, description, targeting, frequency_cap, frequency_cap_window, geo_targets, device_targets)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12::text[],$13::text[])
     RETURNING id`,
    [
      workspaceId,
      campaign_id,
      name,
      normalizeTagFormat(format) ?? 'display',
      normalizeTagStatus(status) ?? 'draft',
      click_url,
      impression_url,
      description,
      JSON.stringify(targeting || {}),
      frequency_cap,
      frequency_cap_window,
      geo_targets,
      device_targets,
    ],
  );
  const tagId = rows[0]?.id;
  if ((serving_width || serving_height || tracker_type) && tagId) {
    await pool.query(
      `INSERT INTO tag_format_configs (tag_id, display_width, display_height, tracker_type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tag_id) DO UPDATE
       SET display_width = EXCLUDED.display_width,
           display_height = EXCLUDED.display_height,
           tracker_type = EXCLUDED.tracker_type,
           updated_at = NOW()`,
      [tagId, serving_width, serving_height, tracker_type],
    );
  }
  return getTag(pool, workspaceId, tagId);
}

export async function updateTag(pool, workspaceId, id, data) {
  const allowed = [
    'campaign_id',
    'name',
    'format',
    'status',
    'click_url',
    'impression_url',
    'description',
    'targeting',
    'frequency_cap',
    'frequency_cap_window',
    'geo_targets',
    'device_targets',
  ];
  const setClauses = [];
  const params = [workspaceId, id];

  for (const key of allowed) {
    if (key in data) {
      let value = data[key];
      if (key === 'format') value = normalizeTagFormat(value) ?? value;
      if (key === 'status') value = normalizeTagStatus(value) ?? value;
      if (key === 'targeting') value = JSON.stringify(value || {});
      params.push(value);
      const cast = key === 'targeting' ? '::jsonb' : key === 'geo_targets' || key === 'device_targets' ? '::text[]' : '';
      setClauses.push(`${key} = $${params.length}${cast}`);
    }
  }

  if (setClauses.length) {
    setClauses.push('updated_at = NOW()');
    await pool.query(
      `UPDATE ad_tags SET ${setClauses.join(', ')}
       WHERE workspace_id = $1 AND id = $2`,
      params,
    );
  }

  if ('serving_width' in data || 'serving_height' in data || 'tracker_type' in data) {
    await pool.query(
      `INSERT INTO tag_format_configs (tag_id, display_width, display_height, tracker_type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tag_id) DO UPDATE
       SET display_width = COALESCE(EXCLUDED.display_width, tag_format_configs.display_width),
           display_height = COALESCE(EXCLUDED.display_height, tag_format_configs.display_height),
           tracker_type = COALESCE(EXCLUDED.tracker_type, tag_format_configs.tracker_type),
           updated_at = NOW()`,
      [id, data.serving_width ?? null, data.serving_height ?? null, data.tracker_type ?? null],
    );
  }

  return getTag(pool, workspaceId, id);
}

export async function deleteTag(pool, workspaceId, id) {
  const { rowCount } = await pool.query(
    `DELETE FROM ad_tags WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, id],
  );
  return rowCount > 0;
}
