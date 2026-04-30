function normalizeStatus(status) {
  if (!status) return null;
  const value = String(status).trim().toLowerCase();
  return value || null;
}

function normalizeSearch(search) {
  const value = String(search || '').trim();
  return value.length >= 2 ? value : '';
}

function normalizeLimit(limit, fallback = 100) {
  return Math.min(Math.max(Number(limit) || fallback, 1), 500);
}

function normalizeOffset(offset) {
  return Math.max(Number(offset) || 0, 0);
}

function addCampaignSummarySelect() {
  return `
    COALESCE(stats.impressions, 0)::bigint AS impressions,
    COALESCE(stats.clicks, 0)::bigint AS clicks,
    COALESCE(stats.viewable_imps, 0)::bigint AS viewable_imps,
    COALESCE(stats.measured_imps, 0)::bigint AS measured_imps,
    COALESCE(stats.undetermined_imps, 0)::bigint AS undetermined_imps,
    COALESCE(engagements.total_engagements, 0)::bigint AS total_engagements,
    COALESCE(engagements.total_hover_duration_ms, 0)::bigint AS total_hover_duration_ms,
    COALESCE(view_time.total_in_view_duration_ms, 0)::bigint AS total_in_view_duration_ms,
    CASE WHEN COALESCE(stats.impressions, 0) > 0
      THEN ROUND(COALESCE(stats.clicks, 0)::NUMERIC / stats.impressions * 100, 4)
      ELSE 0 END AS ctr,
    CASE WHEN COALESCE(stats.measured_imps, 0) > 0
      THEN ROUND(COALESCE(stats.viewable_imps, 0)::NUMERIC / stats.measured_imps * 100, 4)
      ELSE 0 END AS viewability_rate,
    CASE WHEN COALESCE(stats.impressions, 0) > 0
      THEN ROUND(COALESCE(engagements.total_engagements, 0)::NUMERIC / stats.impressions * 100, 4)
      ELSE 0 END AS engagement_rate
  `;
}

function addCampaignSummaryJoins() {
  return `
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(ds.impressions), 0)::bigint AS impressions,
        COALESCE(SUM(ds.clicks), 0)::bigint AS clicks,
        COALESCE(SUM(ds.viewable_imps), 0)::bigint AS viewable_imps,
        COALESCE(SUM(ds.measured_imps), 0)::bigint AS measured_imps,
        COALESCE(SUM(ds.undetermined_imps), 0)::bigint AS undetermined_imps
      FROM ad_tags t
      LEFT JOIN tag_daily_stats ds ON ds.tag_id = t.id
      WHERE t.workspace_id = c.workspace_id
        AND t.campaign_id = c.id
    ) stats ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(es.event_count), 0)::bigint AS total_engagements,
        COALESCE(SUM(CASE WHEN es.event_type = 'hover_end' THEN es.total_duration_ms ELSE 0 END), 0)::bigint AS total_hover_duration_ms
      FROM ad_tags t
      LEFT JOIN tag_engagement_daily_stats es ON es.tag_id = t.id
      WHERE t.workspace_id = c.workspace_id
        AND t.campaign_id = c.id
    ) engagements ON TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(COALESCE(ie.viewability_duration_ms, 0)), 0)::bigint AS total_in_view_duration_ms
      FROM impression_events ie
      JOIN ad_tags t ON t.id = ie.tag_id
      WHERE ie.workspace_id = c.workspace_id
        AND t.workspace_id = c.workspace_id
        AND t.campaign_id = c.id
    ) view_time ON TRUE
  `;
}

export async function listCampaigns(pool, workspaceId, opts = {}) {
  const { status, advertiserId, limit = 100, offset = 0, search } = opts;
  const params = [workspaceId];
  const conditions = ['c.workspace_id = $1'];

  const normalizedStatus = normalizeStatus(status);
  const normalizedSearch = normalizeSearch(search);
  if (normalizedStatus) {
    params.push(normalizedStatus);
    conditions.push(`c.status = $${params.length}`);
  }
  if (advertiserId) {
    params.push(advertiserId);
    conditions.push(`c.advertiser_id = $${params.length}`);
  }
  if (normalizedSearch) {
    params.push(`%${normalizedSearch.toLowerCase()}%`);
    conditions.push(`LOWER(c.name) LIKE $${params.length}`);
  }

  params.push(normalizeLimit(limit));
  params.push(normalizeOffset(offset));

  const { rows } = await pool.query(
    `SELECT c.id, c.workspace_id, c.advertiser_id, c.name, c.status,
            c.start_date, c.end_date, c.budget, c.impression_goal, c.daily_budget,
            c.flight_type, c.kpi, c.kpi_goal, c.currency, c.timezone,
            c.notes, c.metadata, c.created_at, c.updated_at,
            adv.name AS advertiser_name,
            ${addCampaignSummarySelect()}
     FROM campaigns c
     LEFT JOIN advertisers adv ON adv.id = c.advertiser_id
     ${addCampaignSummaryJoins()}
     WHERE ${conditions.join(' AND ')}
     ORDER BY c.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function listCampaignsForUser(pool, userId, opts = {}) {
  const { status, workspaceId, limit = 250, offset = 0, search } = opts;
  const params = [userId];
  const conditions = [`wm.user_id = $1`, `wm.status = 'active'`];

  const normalizedStatus = normalizeStatus(status);
  const normalizedSearch = normalizeSearch(search);
  if (normalizedStatus) {
    params.push(normalizedStatus);
    conditions.push(`c.status = $${params.length}`);
  }
  if (workspaceId) {
    params.push(workspaceId);
    conditions.push(`c.workspace_id = $${params.length}`);
  }
  if (normalizedSearch) {
    params.push(`%${normalizedSearch.toLowerCase()}%`);
    conditions.push(`LOWER(c.name) LIKE $${params.length}`);
  }

  params.push(normalizeLimit(limit, 250));
  params.push(normalizeOffset(offset));

  const { rows } = await pool.query(
    `SELECT c.id, c.workspace_id, c.advertiser_id, c.name, c.status,
            c.start_date, c.end_date, c.budget, c.impression_goal, c.daily_budget,
            c.flight_type, c.kpi, c.kpi_goal, c.currency, c.timezone,
            c.notes, c.metadata, c.created_at, c.updated_at,
            adv.name AS advertiser_name,
            w.name AS workspace_name,
            ${addCampaignSummarySelect()}
     FROM campaigns c
     JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
     JOIN workspaces w ON w.id = c.workspace_id
     LEFT JOIN advertisers adv ON adv.id = c.advertiser_id
     ${addCampaignSummaryJoins()}
     WHERE ${conditions.join(' AND ')}
     ORDER BY c.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function getCampaign(pool, workspaceId, id) {
  const { rows } = await pool.query(
    `SELECT c.id, c.workspace_id, c.advertiser_id, c.name, c.status,
            c.start_date, c.end_date, c.budget, c.impression_goal, c.daily_budget,
            c.flight_type, c.kpi, c.kpi_goal, c.currency, c.timezone,
            c.notes, c.metadata, c.created_at, c.updated_at,
            adv.name AS advertiser_name
     FROM campaigns c
     LEFT JOIN advertisers adv ON adv.id = c.advertiser_id
     WHERE c.workspace_id = $1 AND c.id = $2`,
    [workspaceId, id],
  );
  return rows[0] ?? null;
}

export async function createCampaign(pool, workspaceId, data) {
  const {
    advertiser_id = null,
    name,
    status = 'draft',
    start_date = null,
    end_date = null,
    budget = null,
    impression_goal = null,
    daily_budget = null,
    flight_type = null,
    kpi = null,
    kpi_goal = null,
    currency = 'USD',
    timezone = 'UTC',
    notes = null,
    metadata = {},
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO campaigns
       (workspace_id, advertiser_id, name, status, start_date, end_date, budget,
        impression_goal, daily_budget, flight_type, kpi, kpi_goal, currency, timezone, notes, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      workspaceId,
      advertiser_id,
      name,
      status,
      start_date,
      end_date,
      budget,
      impression_goal,
      daily_budget,
      flight_type,
      kpi,
      kpi_goal,
      currency,
      timezone,
      notes,
      JSON.stringify(metadata),
    ],
  );
  return rows[0];
}

export async function updateCampaign(pool, workspaceId, id, data) {
  const allowed = [
    'advertiser_id',
    'name',
    'status',
    'start_date',
    'end_date',
    'budget',
    'impression_goal',
    'daily_budget',
    'flight_type',
    'kpi',
    'kpi_goal',
    'currency',
    'timezone',
    'notes',
    'metadata',
  ];
  const setClauses = [];
  const params = [workspaceId, id];

  for (const key of allowed) {
    if (key in data) {
      params.push(key === 'metadata' ? JSON.stringify(data[key]) : data[key]);
      setClauses.push(`${key} = $${params.length}`);
    }
  }

  if (!setClauses.length) {
    return getCampaign(pool, workspaceId, id);
  }

  setClauses.push('updated_at = NOW()');
  const { rows } = await pool.query(
    `UPDATE campaigns
     SET ${setClauses.join(', ')}
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    params,
  );
  return rows[0] ?? null;
}

export async function deleteCampaign(pool, workspaceId, id) {
  const { rows: dependencyRows } = await pool.query(
    `SELECT EXISTS(
       SELECT 1
       FROM ad_tags
       WHERE workspace_id = $1
         AND campaign_id = $2
     ) AS has_tags`,
    [workspaceId, id],
  );

  if (dependencyRows[0]?.has_tags) {
    const error = new Error('Campaign has dependent tags');
    error.code = 'CAMPAIGN_HAS_DEPENDENCIES';
    throw error;
  }

  const { rowCount } = await pool.query(
    `DELETE FROM campaigns WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, id],
  );
  return rowCount > 0;
}
