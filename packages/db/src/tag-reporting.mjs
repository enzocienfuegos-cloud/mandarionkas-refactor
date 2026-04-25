function addTimestampFilters(params, conditions, dateFrom, dateTo, alias = 'timestamp') {
  if (dateFrom) {
    params.push(`${dateFrom}T00:00:00.000Z`);
    conditions.push(`${alias} >= $${params.length}::timestamptz`);
  }
  if (dateTo) {
    params.push(`${dateTo}T23:59:59.999Z`);
    conditions.push(`${alias} <= $${params.length}::timestamptz`);
  }
}

function addCreativeFilters(params, conditions, creativeId = '', creativeSizeVariantId = '') {
  if (creativeId) {
    params.push(creativeId);
    conditions.push(`creative_id = $${params.length}`);
  }
  if (creativeSizeVariantId) {
    params.push(creativeSizeVariantId);
    conditions.push(`creative_size_variant_id = $${params.length}`);
  }
}

export async function getTagDailyStats(pool, workspaceId, tagId, opts = {}) {
  const {
    dateFrom,
    dateTo,
    limit = 30,
    creativeId = '',
    creativeSizeVariantId = '',
  } = opts;

  // Verify tag belongs to workspace
  const { rows: tagCheck } = await pool.query(
    `SELECT id FROM ad_tags WHERE id = $1 AND workspace_id = $2`,
    [tagId, workspaceId],
  );
  if (!tagCheck.length) return null;

  const params = [tagId];
  const conditions = ['ds.tag_id = $1'];

  if (!creativeId && !creativeSizeVariantId) {
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
      `SELECT ds.date, ds.impressions, ds.clicks, ds.viewable_imps, ds.measured_imps, ds.undetermined_imps, ds.spend,
              CASE WHEN ds.impressions > 0
                   THEN ROUND(ds.clicks::NUMERIC / ds.impressions * 100, 4)
                   ELSE 0 END AS ctr,
              CASE WHEN ds.measured_imps > 0
                   THEN ROUND(ds.viewable_imps::NUMERIC / ds.measured_imps * 100, 4)
                   ELSE 0 END AS viewability_rate
       FROM tag_daily_stats ds
       WHERE ${conditions.join(' AND ')}
       ORDER BY ds.date DESC
       LIMIT $${params.length}`,
      params,
    );
    return rows;
  }

  const impressionParams = [tagId, workspaceId];
  const impressionConditions = ['tag_id = $1', 'workspace_id = $2'];
  addCreativeFilters(impressionParams, impressionConditions, creativeId, creativeSizeVariantId);
  addTimestampFilters(impressionParams, impressionConditions, dateFrom, dateTo);

  const clickParams = [tagId, workspaceId];
  const clickConditions = ['tag_id = $1', 'workspace_id = $2'];
  addCreativeFilters(clickParams, clickConditions, creativeId, creativeSizeVariantId);
  addTimestampFilters(clickParams, clickConditions, dateFrom, dateTo);

  const { rows } = await pool.query(
    `WITH impression_daily AS (
       SELECT DATE(timestamp) AS date, COUNT(*)::bigint AS impressions
       FROM impression_events
       WHERE ${impressionConditions.join(' AND ')}
       GROUP BY DATE(timestamp)
     ),
     click_daily AS (
       SELECT DATE(timestamp) AS date, COUNT(*)::bigint AS clicks
       FROM click_events
       WHERE ${clickConditions
         .map((condition, index) => condition.replace(/\$(\d+)/g, (_, num) => `$${Number(num) + impressionParams.length}`))
         .join(' AND ')}
       GROUP BY DATE(timestamp)
     )
     SELECT
       COALESCE(impression_daily.date, click_daily.date) AS date,
       COALESCE(impression_daily.impressions, 0)::bigint AS impressions,
       COALESCE(click_daily.clicks, 0)::bigint AS clicks,
       0::bigint AS viewable_imps,
       0::bigint AS measured_imps,
       0::bigint AS undetermined_imps,
       0::numeric AS spend,
       CASE WHEN COALESCE(impression_daily.impressions, 0) > 0
            THEN ROUND(COALESCE(click_daily.clicks, 0)::numeric / impression_daily.impressions * 100, 4)
            ELSE 0 END AS ctr,
       0::numeric AS viewability_rate
     FROM impression_daily
     FULL OUTER JOIN click_daily
       ON click_daily.date = impression_daily.date
     ORDER BY date DESC
     LIMIT $${impressionParams.length + clickParams.length + 1}`,
    [...impressionParams, ...clickParams, Math.min(Number(limit) || 30, 90)],
  );
  return rows;
}

export async function getTagSummaryStats(pool, workspaceId, tagId, opts = {}) {
  const {
    creativeId = '',
    creativeSizeVariantId = '',
  } = opts;
  const { rows: tagCheck } = await pool.query(
    `SELECT id, name, format, status FROM ad_tags WHERE id = $1 AND workspace_id = $2`,
    [tagId, workspaceId],
  );
  if (!tagCheck.length) return null;
  const tag = tagCheck[0];

  if (creativeId || creativeSizeVariantId) {
    const impressionParams = [tagId, workspaceId];
    const impressionConditions = ['tag_id = $1', 'workspace_id = $2'];
    addCreativeFilters(impressionParams, impressionConditions, creativeId, creativeSizeVariantId);

    const clickParams = [tagId, workspaceId];
    const clickConditions = ['tag_id = $1', 'workspace_id = $2'];
    addCreativeFilters(clickParams, clickConditions, creativeId, creativeSizeVariantId);

    const videoParams = [tagId, workspaceId];
    const videoConditions = ['tag_id = $1', 'workspace_id = $2'];
    addCreativeFilters(videoParams, videoConditions, creativeId, creativeSizeVariantId);

    const { rows: impressionRows } = await pool.query(
      `SELECT
         COUNT(*)::bigint AS total_impressions,
         COUNT(CASE WHEN viewable = TRUE THEN 1 END)::bigint AS total_viewable,
         MIN(DATE(timestamp)) AS first_date,
         MAX(DATE(timestamp)) AS last_date,
         COUNT(DISTINCT DATE(timestamp))::bigint AS active_days
       FROM impression_events
       WHERE ${impressionConditions.join(' AND ')}`,
      impressionParams,
    );

    const { rows: clickRows } = await pool.query(
      `SELECT COUNT(*)::bigint AS total_clicks
       FROM click_events
       WHERE ${clickConditions.join(' AND ')}`,
      clickParams,
    );

    const { rows: last7Rows } = await pool.query(
      `SELECT COUNT(*)::bigint AS impressions_7d
       FROM impression_events
       WHERE ${impressionConditions.join(' AND ')}
         AND timestamp >= CURRENT_DATE - INTERVAL '6 days'`,
      impressionParams,
    );

    const { rows: videoRows } = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN event_type = 'start' THEN 1 ELSE 0 END), 0)::bigint AS video_starts,
         COALESCE(SUM(CASE WHEN event_type = 'firstQuartile' THEN 1 ELSE 0 END), 0)::bigint AS video_first_quartile,
         COALESCE(SUM(CASE WHEN event_type = 'midpoint' THEN 1 ELSE 0 END), 0)::bigint AS video_midpoint,
         COALESCE(SUM(CASE WHEN event_type = 'thirdQuartile' THEN 1 ELSE 0 END), 0)::bigint AS video_third_quartile,
         COALESCE(SUM(CASE WHEN event_type = 'complete' THEN 1 ELSE 0 END), 0)::bigint AS video_completions
       FROM engagement_events
       WHERE ${videoConditions.join(' AND ')}`,
      videoParams,
    );

    const impressionSummary = impressionRows[0] ?? {};
    const clickSummary = clickRows[0] ?? {};
    const last7Summary = last7Rows[0] ?? {};
    const videoSummary = videoRows[0] ?? {};
    const totalImpressions = Number(impressionSummary.total_impressions ?? 0);
    const totalClicks = Number(clickSummary.total_clicks ?? 0);
    const videoStarts = Number(videoSummary.video_starts ?? 0);
    const videoCompletions = Number(videoSummary.video_completions ?? 0);

    return {
      tag,
      ...impressionSummary,
      ...clickSummary,
      ...last7Summary,
      ...videoSummary,
      total_measured: 0,
      total_undetermined: 0,
      total_spend: 0,
      overall_ctr: totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(4)) : 0,
      overall_viewability: 0,
      video_completion_rate: videoStarts > 0 ? Number(((videoCompletions / videoStarts) * 100).toFixed(4)) : 0,
    };
  }

  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(ds.impressions), 0)   AS total_impressions,
       COALESCE(SUM(ds.clicks), 0)        AS total_clicks,
       COALESCE(SUM(ds.viewable_imps), 0) AS total_viewable,
       COALESCE(SUM(ds.measured_imps), 0) AS total_measured,
       COALESCE(SUM(ds.undetermined_imps), 0) AS total_undetermined,
       COALESCE(SUM(ds.spend), 0)         AS total_spend,
       CASE WHEN SUM(ds.impressions) > 0
            THEN ROUND(SUM(ds.clicks)::NUMERIC / SUM(ds.impressions) * 100, 4)
            ELSE 0 END AS overall_ctr,
       CASE WHEN SUM(ds.measured_imps) > 0
            THEN ROUND(SUM(ds.viewable_imps)::NUMERIC / SUM(ds.measured_imps) * 100, 4)
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

  const { rows: videoRows } = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN event_type = 'start' THEN event_count ELSE 0 END), 0)::bigint AS video_starts,
       COALESCE(SUM(CASE WHEN event_type = 'firstQuartile' THEN event_count ELSE 0 END), 0)::bigint AS video_first_quartile,
       COALESCE(SUM(CASE WHEN event_type = 'midpoint' THEN event_count ELSE 0 END), 0)::bigint AS video_midpoint,
       COALESCE(SUM(CASE WHEN event_type = 'thirdQuartile' THEN event_count ELSE 0 END), 0)::bigint AS video_third_quartile,
       COALESCE(SUM(CASE WHEN event_type = 'complete' THEN event_count ELSE 0 END), 0)::bigint AS video_completions
     FROM tag_engagement_daily_stats
     WHERE tag_id = $1`,
    [tagId],
  );

  const videoSummary = videoRows[0] ?? {};
  const videoStarts = Number(videoSummary.video_starts ?? 0);
  const videoCompletions = Number(videoSummary.video_completions ?? 0);

  return {
    tag,
    ...rows[0],
    ...last7[0],
    ...videoSummary,
    video_completion_rate: videoStarts > 0 ? Number(((videoCompletions / videoStarts) * 100).toFixed(4)) : 0,
  };
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
