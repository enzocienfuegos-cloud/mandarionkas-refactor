export async function getTagDailyStats(pool, workspaceId, tagId, opts = {}) {
  const { dateFrom, dateTo, limit = 30 } = opts;

  // Verify tag belongs to workspace
  const { rows: tagCheck } = await pool.query(
    `SELECT id FROM ad_tags WHERE id = $1 AND workspace_id = $2`,
    [tagId, workspaceId],
  );
  if (!tagCheck.length) return null;

  const params = [tagId];
  const conditions = ['ds.tag_id = $1'];

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
            CASE WHEN ds.impressions > 0
                 THEN ROUND(ds.clicks::NUMERIC / ds.impressions * 100, 4)
                 ELSE 0 END AS ctr,
            CASE WHEN ds.impressions > 0
                 THEN ROUND(ds.viewable_imps::NUMERIC / ds.impressions * 100, 4)
                 ELSE 0 END AS viewability_rate
     FROM tag_daily_stats ds
     WHERE ${conditions.join(' AND ')}
     ORDER BY ds.date DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function getTagSummaryStats(pool, workspaceId, tagId) {
  const { rows: tagCheck } = await pool.query(
    `SELECT id, name, format, status FROM ad_tags WHERE id = $1 AND workspace_id = $2`,
    [tagId, workspaceId],
  );
  if (!tagCheck.length) return null;
  const tag = tagCheck[0];

  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(ds.impressions), 0)   AS total_impressions,
       COALESCE(SUM(ds.clicks), 0)        AS total_clicks,
       COALESCE(SUM(ds.viewable_imps), 0) AS total_viewable,
       COALESCE(SUM(ds.spend), 0)         AS total_spend,
       CASE WHEN SUM(ds.impressions) > 0
            THEN ROUND(SUM(ds.clicks)::NUMERIC / SUM(ds.impressions) * 100, 4)
            ELSE 0 END AS overall_ctr,
       CASE WHEN SUM(ds.impressions) > 0
            THEN ROUND(SUM(ds.viewable_imps)::NUMERIC / SUM(ds.impressions) * 100, 4)
            ELSE 0 END AS overall_viewability,
       MIN(ds.date)   AS first_date,
       MAX(ds.date)   AS last_date,
       COUNT(ds.date) AS active_days
     FROM tag_daily_stats ds
     WHERE ds.tag_id = $1`,
    [tagId],
  );

  // Last 7 days
  const { rows: last7 } = await pool.query(
    `SELECT COALESCE(SUM(impressions), 0) AS impressions_7d,
            COALESCE(SUM(clicks), 0)      AS clicks_7d
     FROM tag_daily_stats
     WHERE tag_id = $1 AND date >= CURRENT_DATE - 6`,
    [tagId],
  );

  return { tag, ...rows[0], ...last7[0] };
}

export async function getTopTags(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, limit = 10, orderBy = 'impressions' } = opts;

  const validOrders = ['impressions', 'clicks', 'spend', 'ctr'];
  const safeOrder = validOrders.includes(orderBy) ? orderBy : 'impressions';

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
  params.push(Math.min(Number(limit) || 10, 50));

  const orderExpr = safeOrder === 'ctr'
    ? 'CASE WHEN SUM(ds.impressions) > 0 THEN SUM(ds.clicks)::NUMERIC / SUM(ds.impressions) * 100 ELSE 0 END'
    : `SUM(ds.${safeOrder})`;

  const { rows } = await pool.query(
    `SELECT t.id, t.name, t.format, t.status, t.campaign_id,
            COALESCE(SUM(ds.impressions), 0)   AS impressions,
            COALESCE(SUM(ds.clicks), 0)        AS clicks,
            COALESCE(SUM(ds.viewable_imps), 0) AS viewable_imps,
            COALESCE(SUM(ds.spend), 0)         AS spend,
            CASE WHEN SUM(ds.impressions) > 0
                 THEN ROUND(SUM(ds.clicks)::NUMERIC / SUM(ds.impressions) * 100, 4)
                 ELSE 0 END AS ctr
     FROM ad_tags t
     LEFT JOIN tag_daily_stats ds ON ds.tag_id = t.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY t.id, t.name, t.format, t.status, t.campaign_id
     ORDER BY ${orderExpr} DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function getCampaignDailyStats(pool, workspaceId, campaignId, opts = {}) {
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
