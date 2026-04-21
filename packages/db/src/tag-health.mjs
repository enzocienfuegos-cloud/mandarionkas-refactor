const HEALTHY_THRESHOLD_24H   = 1;    // at least 1 impression in 24h
const WARNING_ERROR_RATE       = 0.05; // 5% error rate
const CRITICAL_ERROR_RATE      = 0.20; // 20% error rate
const STALE_HOURS              = 48;   // no impressions for 48h = critical

export async function checkTagHealth(pool, workspaceId, tagId) {
  // Verify tag belongs to workspace
  const { rows: tagRows } = await pool.query(
    `SELECT id, name, status, workspace_id FROM ad_tags WHERE id = $1 AND workspace_id = $2`,
    [tagId, workspaceId],
  );
  if (!tagRows.length) return null;
  const tag = tagRows[0];

  // Count impressions in last 24h
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
  const impression_count_24h = parseInt(impData.impression_count_24h || 0, 10);
  const last_impression_at   = impData.last_impression_at ?? null;

  // Compute error rate from non-viewable impressions
  const total = impression_count_24h || 0;
  const nonViewable = parseInt(impData.non_viewable_count || 0, 10);
  const error_rate = total > 0 ? nonViewable / total : 0;

  // Determine status
  let status = 'unknown';
  if (tag.status === 'archived') {
    status = 'unknown';
  } else if (!last_impression_at) {
    status = 'unknown';
  } else {
    const hoursSinceLast = (Date.now() - new Date(last_impression_at).getTime()) / 3_600_000;
    if (hoursSinceLast > STALE_HOURS || error_rate >= CRITICAL_ERROR_RATE) {
      status = 'critical';
    } else if (error_rate >= WARNING_ERROR_RATE || impression_count_24h < HEALTHY_THRESHOLD_24H) {
      status = 'warning';
    } else {
      status = 'healthy';
    }
  }

  const details = {
    tag_status: tag.status,
    error_rate: Math.round(error_rate * 10000) / 10000,
    non_viewable_count: nonViewable,
  };

  // Persist health log
  const { rows: logRows } = await pool.query(
    `INSERT INTO tag_health_logs
       (tag_id, workspace_id, status, last_impression_at, impression_count_24h, error_rate, details)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [tagId, workspaceId, status, last_impression_at, impression_count_24h,
     error_rate, JSON.stringify(details)],
  );

  return logRows[0];
}

export async function listTagHealth(pool, workspaceId, opts = {}) {
  const { status, limit = 50, offset = 0 } = opts;
  const params = [workspaceId];
  const conditions = ['hl.workspace_id = $1'];

  // Only fetch the most recent health log per tag
  if (status) {
    params.push(status);
    conditions.push(`hl.status = $${params.length}`);
  }

  params.push(Math.min(Number(limit) || 50, 200));
  params.push(Number(offset) || 0);

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
       COUNT(*)                                               AS total_tags,
       COUNT(CASE WHEN status = 'healthy'  THEN 1 END)       AS healthy_count,
       COUNT(CASE WHEN status = 'warning'  THEN 1 END)       AS warning_count,
       COUNT(CASE WHEN status = 'critical' THEN 1 END)       AS critical_count,
       COUNT(CASE WHEN status = 'unknown'  THEN 1 END)       AS unknown_count
     FROM latest`,
    [workspaceId],
  );
  return rows[0];
}
