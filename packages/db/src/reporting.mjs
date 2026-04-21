export async function getTagStats(pool, workspaceId, tagId, opts = {}) {
  const { dateFrom, dateTo, limit = 30 } = opts;
  const params = [tagId];
  const conditions = ['ds.tag_id = $1'];

  // Verify tag belongs to workspace
  const { rows: tagCheck } = await pool.query(
    `SELECT id FROM ad_tags WHERE id = $1 AND workspace_id = $2`,
    [tagId, workspaceId],
  );
  if (!tagCheck.length) return null;

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`ds.date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`ds.date <= $${params.length}`);
  }
  params.push(Math.min(Number(limit) || 30, 90));

  const { rows } = await pool.query(
    `SELECT ds.date, ds.impressions, ds.clicks, ds.viewable_imps, ds.spend,
            CASE WHEN ds.impressions > 0 THEN ROUND(ds.clicks::NUMERIC / ds.impressions * 100, 4) ELSE 0 END AS ctr
     FROM tag_daily_stats ds
     WHERE ${conditions.join(' AND ')}
     ORDER BY ds.date DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function getWorkspaceStats(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo } = opts;
  const params = [workspaceId];
  const conditions = ['t.workspace_id = $1'];

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`ds.date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`ds.date <= $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT
       ds.date,
       SUM(ds.impressions) AS impressions,
       SUM(ds.clicks)      AS clicks,
       SUM(ds.viewable_imps) AS viewable_imps,
       SUM(ds.spend)       AS spend,
       CASE WHEN SUM(ds.impressions) > 0
            THEN ROUND(SUM(ds.clicks)::NUMERIC / SUM(ds.impressions) * 100, 4)
            ELSE 0 END AS ctr
     FROM tag_daily_stats ds
     JOIN ad_tags t ON t.id = ds.tag_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY ds.date
     ORDER BY ds.date DESC`,
    params,
  );
  return rows;
}

export async function getCampaignStats(pool, workspaceId, campaignId, opts = {}) {
  const { dateFrom, dateTo, limit = 30 } = opts;
  const params = [campaignId, workspaceId];
  const conditions = ['t.campaign_id = $1', 't.workspace_id = $2'];

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`ds.date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`ds.date <= $${params.length}`);
  }
  params.push(Math.min(Number(limit) || 30, 90));

  const { rows } = await pool.query(
    `SELECT
       ds.date,
       SUM(ds.impressions)   AS impressions,
       SUM(ds.clicks)        AS clicks,
       SUM(ds.viewable_imps) AS viewable_imps,
       SUM(ds.spend)         AS spend,
       CASE WHEN SUM(ds.impressions) > 0
            THEN ROUND(SUM(ds.clicks)::NUMERIC / SUM(ds.impressions) * 100, 4)
            ELSE 0 END AS ctr
     FROM tag_daily_stats ds
     JOIN ad_tags t ON t.id = ds.tag_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY ds.date
     ORDER BY ds.date DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function upsertDailyStats(pool, tagId, date, impressions, clicks = 0) {
  const { rows } = await pool.query(
    `INSERT INTO tag_daily_stats (tag_id, date, impressions, clicks)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tag_id, date)
     DO UPDATE SET
       impressions = tag_daily_stats.impressions + EXCLUDED.impressions,
       clicks      = tag_daily_stats.clicks + EXCLUDED.clicks,
       updated_at  = NOW()
     RETURNING *`,
    [tagId, date, impressions, clicks],
  );
  return rows[0];
}
