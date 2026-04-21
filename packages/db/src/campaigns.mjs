export async function listCampaigns(pool, workspaceId, opts = {}) {
  const { status, advertiserId, limit = 100, offset = 0, search } = opts;
  const params = [workspaceId];
  const conditions = ['c.workspace_id = $1'];

  if (status) {
    params.push(status);
    conditions.push(`c.status = $${params.length}`);
  }
  if (advertiserId) {
    params.push(advertiserId);
    conditions.push(`c.advertiser_id = $${params.length}`);
  }
  if (search && search.trim().length >= 2) {
    params.push(search.trim());
    conditions.push(`c.search_vec @@ websearch_to_tsquery('english', $${params.length})`);
  }

  params.push(Math.min(Number(limit) || 100, 500));
  params.push(Number(offset) || 0);

  const { rows } = await pool.query(
    `SELECT c.id, c.workspace_id, c.advertiser_id, c.name, c.status,
            c.start_date, c.end_date, c.budget, c.impression_goal, c.daily_budget,
            c.flight_type, c.kpi, c.kpi_goal, c.currency, c.timezone,
            c.notes, c.metadata, c.created_at, c.updated_at,
            adv.name AS advertiser_name
     FROM campaigns c
     LEFT JOIN advertisers adv ON adv.id = c.advertiser_id
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
    advertiser_id = null, name, status = 'draft',
    start_date = null, end_date = null, budget = null,
    impression_goal = null, daily_budget = null,
    flight_type = null, kpi = null, kpi_goal = null,
    currency = 'USD', timezone = 'UTC', notes = null, metadata = {},
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO campaigns
       (workspace_id, advertiser_id, name, status, start_date, end_date, budget,
        impression_goal, daily_budget, flight_type, kpi, kpi_goal, currency, timezone, notes, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [workspaceId, advertiser_id, name, status, start_date, end_date, budget,
     impression_goal, daily_budget, flight_type, kpi, kpi_goal,
     currency, timezone, notes, JSON.stringify(metadata)],
  );
  return rows[0];
}

export async function updateCampaign(pool, workspaceId, id, data) {
  const allowed = [
    'advertiser_id', 'name', 'status', 'start_date', 'end_date', 'budget',
    'impression_goal', 'daily_budget', 'flight_type', 'kpi', 'kpi_goal',
    'currency', 'timezone', 'notes', 'metadata',
  ];
  const setClauses = [];
  const params = [workspaceId, id];
  for (const key of allowed) {
    if (key in data) {
      params.push(key === 'metadata' ? JSON.stringify(data[key]) : data[key]);
      setClauses.push(`${key} = $${params.length}`);
    }
  }
  if (setClauses.length === 0) return getCampaign(pool, workspaceId, id);
  setClauses.push(`updated_at = NOW()`);

  const { rows } = await pool.query(
    `UPDATE campaigns SET ${setClauses.join(', ')}
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    params,
  );
  return rows[0] ?? null;
}

export async function deleteCampaign(pool, workspaceId, id) {
  const { rowCount } = await pool.query(
    `DELETE FROM campaigns WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, id],
  );
  return rowCount > 0;
}

// --- Advertiser functions ---

export async function listAdvertisers(pool, workspaceId, opts = {}) {
  const { status, limit = 100, offset = 0, search } = opts;
  const params = [workspaceId];
  const conditions = ['a.workspace_id = $1'];

  if (status) {
    params.push(status);
    conditions.push(`a.status = $${params.length}`);
  }
  if (search && search.trim().length >= 2) {
    params.push(search.trim());
    conditions.push(`a.search_vec @@ websearch_to_tsquery('english', $${params.length})`);
  }

  params.push(Math.min(Number(limit) || 100, 500));
  params.push(Number(offset) || 0);

  const { rows } = await pool.query(
    `SELECT a.id, a.workspace_id, a.name, a.domain, a.industry,
            a.contact_email, a.notes, a.status, a.created_at, a.updated_at
     FROM advertisers a
     WHERE ${conditions.join(' AND ')}
     ORDER BY a.name ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function getAdvertiser(pool, workspaceId, id) {
  const { rows } = await pool.query(
    `SELECT id, workspace_id, name, domain, industry, contact_email, notes, status, created_at, updated_at
     FROM advertisers
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, id],
  );
  return rows[0] ?? null;
}

export async function createAdvertiser(pool, workspaceId, data) {
  const {
    name, domain = null, industry = null,
    contact_email = null, notes = null, status = 'active',
  } = data;
  const { rows } = await pool.query(
    `INSERT INTO advertisers (workspace_id, name, domain, industry, contact_email, notes, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [workspaceId, name, domain, industry, contact_email, notes, status],
  );
  return rows[0];
}

export async function updateAdvertiser(pool, workspaceId, id, data) {
  const allowed = ['name', 'domain', 'industry', 'contact_email', 'notes', 'status'];
  const setClauses = [];
  const params = [workspaceId, id];
  for (const key of allowed) {
    if (key in data) {
      params.push(data[key]);
      setClauses.push(`${key} = $${params.length}`);
    }
  }
  if (setClauses.length === 0) return getAdvertiser(pool, workspaceId, id);
  setClauses.push(`updated_at = NOW()`);

  const { rows } = await pool.query(
    `UPDATE advertisers SET ${setClauses.join(', ')}
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    params,
  );
  return rows[0] ?? null;
}
