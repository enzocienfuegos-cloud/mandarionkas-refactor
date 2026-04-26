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

function hasNonZeroDailyRows(rows = []) {
  return rows.some(row =>
    Number(row?.impressions ?? 0) > 0
    || Number(row?.clicks ?? 0) > 0
    || Number(row?.video_starts ?? 0) > 0
    || Number(row?.video_completions ?? 0) > 0,
  );
}

function hasSummaryActivity(summary = {}) {
  return [
    summary.total_impressions,
    summary.total_clicks,
    summary.total_viewable,
    summary.total_measured,
    summary.total_undetermined,
    summary.video_starts,
    summary.video_completions,
    summary.total_in_view_duration_ms,
    summary.total_attention_duration_ms ?? summary.total_hover_duration_ms,
  ].some(value => Number(value ?? 0) > 0);
}

function buildDailyVideoOverlayMap(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const date = String(row?.date ?? '');
    if (!date) continue;
    map.set(date, {
      impressions: Number(row?.impressions ?? 0),
      clicks: Number(row?.clicks ?? 0),
      video_starts: Number(row?.video_starts ?? 0),
      video_completions: Number(row?.video_completions ?? 0),
    });
  }
  return map;
}

function mergeDailyVideoMetrics(primaryRows = [], fallbackRows = []) {
  const overlay = buildDailyVideoOverlayMap(fallbackRows);
  const merged = primaryRows.map((row) => {
    const raw = overlay.get(String(row?.date ?? ''));
    const rollupImpressions = Number(row?.impressions ?? 0);
    const rollupClicks = Number(row?.clicks ?? 0);
    const rollupStarts = Number(row?.video_starts ?? 0);
    const rollupCompletions = Number(row?.video_completions ?? 0);
    const impressions = rollupImpressions > 0 ? rollupImpressions : Number(raw?.impressions ?? 0);
    const clicks = rollupClicks > 0 ? rollupClicks : Number(raw?.clicks ?? 0);
    const videoStarts = rollupStarts > 0 ? rollupStarts : Number(raw?.video_starts ?? 0);
    const videoCompletions = rollupCompletions > 0 ? rollupCompletions : Number(raw?.video_completions ?? 0);
    return {
      ...row,
      impressions,
      clicks,
      video_starts: videoStarts,
      video_completions: videoCompletions,
      ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(4)) : 0,
      video_start_rate: impressions > 0 ? Number(((videoStarts / impressions) * 100).toFixed(4)) : 0,
      video_completion_rate: videoStarts > 0 ? Number(((videoCompletions / videoStarts) * 100).toFixed(4)) : 0,
    };
  });

  const existingDates = new Set(merged.map((row) => String(row?.date ?? '')));
  for (const row of fallbackRows) {
    const date = String(row?.date ?? '');
    if (!date || existingDates.has(date)) continue;
    merged.push(row);
  }

  return merged.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

async function getRawTagDailyStats(pool, workspaceId, tagId, opts = {}) {
  const {
    dateFrom,
    dateTo,
    limit = 30,
    creativeId = '',
    creativeSizeVariantId = '',
  } = opts;

  const impressionParams = [tagId, workspaceId];
  const impressionConditions = ['tag_id = $1', 'workspace_id = $2'];
  addCreativeFilters(impressionParams, impressionConditions, creativeId, creativeSizeVariantId);
  addTimestampFilters(impressionParams, impressionConditions, dateFrom, dateTo);

  const clickParams = [tagId, workspaceId];
  const clickConditions = ['tag_id = $1', 'workspace_id = $2'];
  addCreativeFilters(clickParams, clickConditions, creativeId, creativeSizeVariantId);
  addTimestampFilters(clickParams, clickConditions, dateFrom, dateTo);

  const videoParams = [tagId, workspaceId];
  const videoConditions = ['tag_id = $1', 'workspace_id = $2'];
  addCreativeFilters(videoParams, videoConditions, creativeId, creativeSizeVariantId);
  addTimestampFilters(videoParams, videoConditions, dateFrom, dateTo);

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
         .map(condition => condition.replace(/\$(\d+)/g, (_, num) => `$${Number(num) + impressionParams.length}`))
         .join(' AND ')}
       GROUP BY DATE(timestamp)
     ),
     engagement_daily AS (
       SELECT
         DATE(timestamp) AS date,
         COALESCE(SUM(CASE WHEN event_type = 'start' THEN 1 ELSE 0 END), 0)::bigint AS video_starts,
         COALESCE(SUM(CASE WHEN event_type = 'complete' THEN 1 ELSE 0 END), 0)::bigint AS video_completions
       FROM engagement_events
       WHERE ${videoConditions
         .map(condition => condition.replace(/\$(\d+)/g, (_, num) => `$${Number(num) + impressionParams.length + clickParams.length}`))
         .join(' AND ')}
       GROUP BY DATE(timestamp)
     )
     SELECT
       COALESCE(impression_daily.date, click_daily.date, engagement_daily.date) AS date,
       COALESCE(impression_daily.impressions, 0)::bigint AS impressions,
       COALESCE(click_daily.clicks, 0)::bigint AS clicks,
       COALESCE(engagement_daily.video_starts, 0)::bigint AS video_starts,
       COALESCE(engagement_daily.video_completions, 0)::bigint AS video_completions,
       0::bigint AS viewable_imps,
       0::bigint AS measured_imps,
       0::bigint AS undetermined_imps,
       0::numeric AS spend,
       CASE WHEN COALESCE(impression_daily.impressions, 0) > 0
            THEN ROUND(COALESCE(click_daily.clicks, 0)::numeric / impression_daily.impressions * 100, 4)
            ELSE 0 END AS ctr,
       CASE WHEN COALESCE(impression_daily.impressions, 0) > 0
            THEN ROUND(COALESCE(engagement_daily.video_starts, 0)::numeric / impression_daily.impressions * 100, 4)
            ELSE 0 END AS video_start_rate,
       CASE WHEN COALESCE(engagement_daily.video_starts, 0) > 0
            THEN ROUND(COALESCE(engagement_daily.video_completions, 0)::numeric / engagement_daily.video_starts * 100, 4)
            ELSE 0 END AS video_completion_rate,
       0::numeric AS viewability_rate
     FROM impression_daily
     FULL OUTER JOIN click_daily
       ON click_daily.date = impression_daily.date
     FULL OUTER JOIN engagement_daily
       ON engagement_daily.date = COALESCE(impression_daily.date, click_daily.date)
     ORDER BY date DESC
     LIMIT $${impressionParams.length + clickParams.length + videoParams.length + 1}`,
    [...impressionParams, ...clickParams, ...videoParams, Math.min(Number(limit) || 30, 90)],
  );

  return rows;
}

async function getRawTagSummaryStats(pool, workspaceId, tagId, opts = {}) {
  const {
    dateFrom,
    dateTo,
    creativeId = '',
    creativeSizeVariantId = '',
  } = opts;

  const impressionParams = [tagId, workspaceId];
  const impressionConditions = ['tag_id = $1', 'workspace_id = $2'];
  addCreativeFilters(impressionParams, impressionConditions, creativeId, creativeSizeVariantId);
  addTimestampFilters(impressionParams, impressionConditions, dateFrom, dateTo);

  const clickParams = [tagId, workspaceId];
  const clickConditions = ['tag_id = $1', 'workspace_id = $2'];
  addCreativeFilters(clickParams, clickConditions, creativeId, creativeSizeVariantId);
  addTimestampFilters(clickParams, clickConditions, dateFrom, dateTo);

  const videoParams = [tagId, workspaceId];
  const videoConditions = ['tag_id = $1', 'workspace_id = $2'];
  addCreativeFilters(videoParams, videoConditions, creativeId, creativeSizeVariantId);
  addTimestampFilters(videoParams, videoConditions, dateFrom, dateTo);

  const { rows: impressionRows } = await pool.query(
    `SELECT
       COUNT(*)::bigint AS total_impressions,
       COUNT(CASE WHEN viewable = TRUE THEN 1 END)::bigint AS total_viewable,
       COUNT(CASE WHEN viewable IS NOT NULL THEN 1 END)::bigint AS total_measured,
       COUNT(CASE WHEN viewable IS NULL THEN 1 END)::bigint AS total_undetermined
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

  const { rows: attentionRows } = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN event_type IN ('attention', 'hover_end') THEN total_duration_ms ELSE 0 END), 0)::bigint AS total_attention_duration_ms
     FROM engagement_events
     WHERE ${videoConditions.join(' AND ')}`,
    videoParams,
  );

  const { rows: inViewRows } = await pool.query(
    `SELECT
       COALESCE(SUM(COALESCE(viewability_duration_ms, 0)), 0)::bigint AS total_in_view_duration_ms
     FROM impression_events
     WHERE ${impressionConditions.join(' AND ')}`,
    impressionParams,
  );

  const { rows: activityRows } = await pool.query(
    `WITH activity_dates AS (
       SELECT DATE(timestamp) AS date
       FROM impression_events
       WHERE ${impressionConditions.join(' AND ')}
       UNION
       SELECT DATE(timestamp) AS date
       FROM click_events
       WHERE ${clickConditions
         .map(condition => condition.replace(/\$(\d+)/g, (_, num) => `$${Number(num) + impressionParams.length}`))
         .join(' AND ')}
       UNION
       SELECT DATE(timestamp) AS date
       FROM engagement_events
       WHERE ${videoConditions
         .map(condition => condition.replace(/\$(\d+)/g, (_, num) => `$${Number(num) + impressionParams.length + clickParams.length}`))
         .join(' AND ')}
     )
     SELECT
       MIN(date) AS first_date,
       MAX(date) AS last_date,
       COUNT(*)::bigint AS active_days
     FROM activity_dates`,
    [...impressionParams, ...clickParams, ...videoParams],
  );

  const impressionSummary = impressionRows[0] ?? {};
  const clickSummary = clickRows[0] ?? {};
  const last7Summary = last7Rows[0] ?? {};
  const videoSummary = videoRows[0] ?? {};
  const attentionSummary = attentionRows[0] ?? {};
  const inViewSummary = inViewRows[0] ?? {};
  const activitySummary = activityRows[0] ?? {};
  const totalImpressions = Number(impressionSummary.total_impressions ?? 0);
  const totalClicks = Number(clickSummary.total_clicks ?? 0);
  const totalMeasured = Number(impressionSummary.total_measured ?? 0);
  const totalViewable = Number(impressionSummary.total_viewable ?? 0);
  const videoStarts = Number(videoSummary.video_starts ?? 0);
  const videoCompletions = Number(videoSummary.video_completions ?? 0);

  return {
    ...impressionSummary,
    ...clickSummary,
    ...last7Summary,
    ...videoSummary,
    ...attentionSummary,
    ...inViewSummary,
    ...activitySummary,
    total_spend: 0,
    overall_ctr: totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(4)) : 0,
    overall_viewability: totalMeasured > 0 ? Number(((totalViewable / totalMeasured) * 100).toFixed(4)) : 0,
    video_start_rate: totalImpressions > 0 ? Number(((videoStarts / totalImpressions) * 100).toFixed(4)) : 0,
    video_completion_rate: videoStarts > 0 ? Number(((videoCompletions / videoStarts) * 100).toFixed(4)) : 0,
  };
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

  if (!creativeId && !creativeSizeVariantId) {
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
      `SELECT ds.date, ds.impressions, ds.clicks, ds.viewable_imps, ds.measured_imps, ds.undetermined_imps, ds.spend,
              COALESCE(eng.video_starts, 0)::bigint AS video_starts,
              COALESCE(eng.video_completions, 0)::bigint AS video_completions,
              CASE WHEN ds.impressions > 0
                   THEN ROUND(ds.clicks::NUMERIC / ds.impressions * 100, 4)
                   ELSE 0 END AS ctr,
              CASE WHEN ds.impressions > 0
                   THEN ROUND(COALESCE(eng.video_starts, 0)::NUMERIC / ds.impressions * 100, 4)
                   ELSE 0 END AS video_start_rate,
              CASE WHEN COALESCE(eng.video_starts, 0) > 0
                   THEN ROUND(COALESCE(eng.video_completions, 0)::NUMERIC / eng.video_starts * 100, 4)
                   ELSE 0 END AS video_completion_rate,
              CASE WHEN ds.measured_imps > 0
                   THEN ROUND(ds.viewable_imps::NUMERIC / ds.measured_imps * 100, 4)
                   ELSE 0 END AS viewability_rate
       FROM tag_daily_stats ds
       LEFT JOIN (
         SELECT
           tag_id,
           date,
           COALESCE(SUM(CASE WHEN event_type = 'start' THEN event_count ELSE 0 END), 0)::bigint AS video_starts,
           COALESCE(SUM(CASE WHEN event_type = 'complete' THEN event_count ELSE 0 END), 0)::bigint AS video_completions
         FROM tag_engagement_daily_stats
         GROUP BY tag_id, date
       ) eng
         ON eng.tag_id = ds.tag_id
        AND eng.date = ds.date
       WHERE ${conditions.join(' AND ')}
       ORDER BY ds.date DESC
       LIMIT $${params.length}`,
      params,
    );
    if (rows.length && hasNonZeroDailyRows(rows)) {
      const rawRows = await getRawTagDailyStats(pool, workspaceId, tagId, opts);
      return mergeDailyVideoMetrics(rows, rawRows);
    }
    return getRawTagDailyStats(pool, workspaceId, tagId, opts);
  }

  return getRawTagDailyStats(pool, workspaceId, tagId, opts);
}

export async function getTagSummaryStats(pool, workspaceId, tagId, opts = {}) {
  const {
    dateFrom,
    dateTo,
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
    return {
      tag,
      ...(await getRawTagSummaryStats(pool, workspaceId, tagId, opts)),
    };
  }

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
     WHERE ${conditions.join(' AND ')}`,
    params,
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
  const totalImpressions = Number(rows[0]?.total_impressions ?? 0);

  const rollupSummary = {
    tag,
    ...rows[0],
    ...last7[0],
    ...videoSummary,
    video_start_rate: totalImpressions > 0 ? Number(((videoStarts / totalImpressions) * 100).toFixed(4)) : 0,
    video_completion_rate: videoStarts > 0 ? Number(((videoCompletions / videoStarts) * 100).toFixed(4)) : 0,
  };

  if (hasSummaryActivity(rollupSummary)) {
    const rawSummary = await getRawTagSummaryStats(pool, workspaceId, tagId, opts);
    const rawTotalImpressions = Number(rawSummary?.total_impressions ?? 0);
    const rawTotalClicks = Number(rawSummary?.total_clicks ?? 0);
    const rawImpressionsLast7d = Number(rawSummary?.impressions_7d ?? 0);
    const rawVideoStarts = Number(rawSummary?.video_starts ?? 0);
    const rawVideoCompletions = Number(rawSummary?.video_completions ?? 0);
    const nextTotalImpressions = totalImpressions > 0 ? totalImpressions : rawTotalImpressions;
    const nextTotalClicks = Number(rollupSummary.total_clicks ?? 0) > 0 ? Number(rollupSummary.total_clicks ?? 0) : rawTotalClicks;
    const nextVideoStarts = videoStarts > 0 ? videoStarts : rawVideoStarts;
    const nextVideoCompletions = videoCompletions > 0 ? videoCompletions : rawVideoCompletions;
    return {
      ...rollupSummary,
      total_impressions: nextTotalImpressions,
      total_clicks: nextTotalClicks,
      impressions_7d: Number(rollupSummary.impressions_7d ?? 0) > 0 ? Number(rollupSummary.impressions_7d ?? 0) : rawImpressionsLast7d,
      video_starts: nextVideoStarts,
      video_first_quartile: Number(rollupSummary.video_first_quartile ?? 0) > 0 ? rollupSummary.video_first_quartile : rawSummary?.video_first_quartile ?? 0,
      video_midpoint: Number(rollupSummary.video_midpoint ?? 0) > 0 ? rollupSummary.video_midpoint : rawSummary?.video_midpoint ?? 0,
      video_third_quartile: Number(rollupSummary.video_third_quartile ?? 0) > 0 ? rollupSummary.video_third_quartile : rawSummary?.video_third_quartile ?? 0,
      video_completions: nextVideoCompletions,
      total_attention_duration_ms: Number(rawSummary?.total_attention_duration_ms ?? rawSummary?.total_hover_duration_ms ?? 0),
      total_in_view_duration_ms: Number(rawSummary?.total_in_view_duration_ms ?? 0),
      overall_viewability: Number(rollupSummary.overall_viewability ?? 0) > 0
        ? Number(rollupSummary.overall_viewability ?? 0)
        : Number(rawSummary?.overall_viewability ?? 0),
      overall_ctr: nextTotalImpressions > 0 ? Number(((nextTotalClicks / nextTotalImpressions) * 100).toFixed(4)) : 0,
      video_start_rate: nextTotalImpressions > 0 ? Number(((nextVideoStarts / nextTotalImpressions) * 100).toFixed(4)) : 0,
      video_completion_rate: nextVideoStarts > 0 ? Number(((nextVideoCompletions / nextVideoStarts) * 100).toFixed(4)) : 0,
    };
  }

  return {
    tag,
    ...(await getRawTagSummaryStats(pool, workspaceId, tagId, opts)),
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
