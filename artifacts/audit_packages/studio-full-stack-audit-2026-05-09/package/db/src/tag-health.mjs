const HEALTHY_THRESHOLD_24H = 1;
const WARNING_ERROR_RATE = 0.05;
const CRITICAL_ERROR_RATE = 0.2;
const STALE_HOURS = 48;

export async function checkTagHealth(pool, workspaceId, tagId) {
  const { rows: tagRows } = await pool.query(
    `SELECT id, name, status, workspace_id FROM ad_tags WHERE id = $1 AND workspace_id = $2`,
    [tagId, workspaceId],
  );
  if (!tagRows.length) return null;
  const tag = tagRows[0];

  const { rows: impRows } = await pool.query(
    `SELECT
       COUNT(*) AS impression_count_24h,
       MAX(timestamp) AS last_impression_at,
       COUNT(CASE WHEN viewable IS FALSE THEN 1 END) AS non_viewable_count
     FROM impression_events
     WHERE tag_id = $1 AND timestamp >= NOW() - INTERVAL '24 hours'`,
    [tagId],
  );

  const impData = impRows[0] ?? {};
  const impressionCount24h = parseInt(impData.impression_count_24h || 0, 10);
  const lastImpressionAt = impData.last_impression_at ?? null;
  const nonViewable = parseInt(impData.non_viewable_count || 0, 10);
  const errorRate = impressionCount24h > 0 ? nonViewable / impressionCount24h : 0;

  let status = 'unknown';
  if (tag.status === 'archived') {
    status = 'unknown';
  } else if (!lastImpressionAt) {
    status = 'unknown';
  } else {
    const hoursSinceLast = (Date.now() - new Date(lastImpressionAt).getTime()) / 3_600_000;
    if (hoursSinceLast > STALE_HOURS || errorRate >= CRITICAL_ERROR_RATE) {
      status = 'critical';
    } else if (errorRate >= WARNING_ERROR_RATE || impressionCount24h < HEALTHY_THRESHOLD_24H) {
      status = 'warning';
    } else {
      status = 'healthy';
    }
  }

  const details = {
    tag_status: tag.status,
    error_rate: Math.round(errorRate * 10000) / 10000,
    non_viewable_count: nonViewable,
  };

  const { rows } = await pool.query(
    `INSERT INTO tag_health_logs
       (tag_id, workspace_id, status, last_impression_at, impression_count_24h, error_rate, details)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
     RETURNING *`,
    [tagId, workspaceId, status, lastImpressionAt, impressionCount24h, errorRate, JSON.stringify(details)],
  );
  return rows[0];
}

export async function listTagHealth(pool, workspaceId, opts = {}) {
  const { status, limit = 50, offset = 0 } = opts;
  const params = [workspaceId];
  const conditions = ['hl.workspace_id = $1'];
  if (status) {
    params.push(status);
    conditions.push(`hl.status = $${params.length}`);
  }
  params.push(Math.min(Number(limit) || 50, 200));
  params.push(Math.max(Number(offset) || 0, 0));

  const { rows } = await pool.query(
    `SELECT DISTINCT ON (hl.tag_id)
            hl.id, hl.tag_id, hl.workspace_id, hl.status,
            hl.last_impression_at, hl.impression_count_24h, hl.error_rate,
            hl.details, hl.checked_at,
            t.name AS tag_name, t.format, t.status AS tag_status
     FROM tag_health_logs hl
     JOIN ad_tags t ON t.id = hl.tag_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY hl.tag_id, hl.checked_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function getTagHealthSummary(pool, workspaceId) {
  const { rows } = await pool.query(
    `WITH latest AS (
       SELECT DISTINCT ON (tag_id) tag_id, status, checked_at
       FROM tag_health_logs
       WHERE workspace_id = $1
       ORDER BY tag_id, checked_at DESC
     )
     SELECT
       COUNT(*)::int AS total_tags,
       COUNT(CASE WHEN status = 'healthy' THEN 1 END)::int AS healthy_count,
       COUNT(CASE WHEN status = 'warning' THEN 1 END)::int AS warning_count,
       COUNT(CASE WHEN status = 'critical' THEN 1 END)::int AS critical_count,
       COUNT(CASE WHEN status = 'unknown' THEN 1 END)::int AS unknown_count
     FROM latest`,
    [workspaceId],
  );
  return rows[0] ?? {
    total_tags: 0,
    healthy_count: 0,
    warning_count: 0,
    critical_count: 0,
    unknown_count: 0,
  };
}
