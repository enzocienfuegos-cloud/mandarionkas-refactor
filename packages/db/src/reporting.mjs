function addDateFilters(params, conditions, alias, dateFrom, dateTo) {
  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`${alias}.date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`${alias}.date <= $${params.length}`);
  }
}

function addTimestampFilters(params, conditions, alias, dateFrom, dateTo) {
  if (dateFrom) {
    params.push(`${dateFrom}T00:00:00.000Z`);
    conditions.push(`${alias}.timestamp >= $${params.length}::timestamptz`);
  }
  if (dateTo) {
    params.push(`${dateTo}T23:59:59.999Z`);
    conditions.push(`${alias}.timestamp <= $${params.length}::timestamptz`);
  }
}

function normalizeIdList(value) {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item ?? '').split(','))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeLimit(limit, fallback = 25, max = 100) {
  return Math.min(Math.max(Number(limit) || fallback, 1), max);
}

function addTagScopeFilters(params, conditions, alias, campaignId, tagIds) {
  if (campaignId) {
    params.push(campaignId);
    conditions.push(`${alias}.campaign_id = $${params.length}`);
  }
  if (tagIds.length === 1) {
    params.push(tagIds[0]);
    conditions.push(`${alias}.id = $${params.length}`);
  } else if (tagIds.length > 1) {
    params.push(tagIds);
    conditions.push(`${alias}.id = ANY($${params.length}::uuid[])`);
  }
}

function addImpressionScopeFilters(params, conditions, tagAlias, eventAlias, campaignId, tagIds) {
  conditions.push(`${tagAlias}.workspace_id = ${eventAlias}.workspace_id`);
  conditions.push(`${tagAlias}.id = ${eventAlias}.tag_id`);
  if (campaignId) {
    params.push(campaignId);
    conditions.push(`${tagAlias}.campaign_id = $${params.length}`);
  }
  if (tagIds.length === 1) {
    params.push(tagIds[0]);
    conditions.push(`${tagAlias}.id = $${params.length}`);
  } else if (tagIds.length > 1) {
    params.push(tagIds);
    conditions.push(`${tagAlias}.id = ANY($${params.length}::uuid[])`);
  }
}

export async function getTagStats(pool, workspaceId, tagId, opts = {}) {
  const { dateFrom, dateTo, limit = 30 } = opts;
  const { rows: tagRows } = await pool.query(
    `SELECT id FROM ad_tags WHERE id = $1 AND workspace_id = $2`,
    [tagId, workspaceId],
  );
  if (!tagRows.length) return null;

  const params = [tagId];
  const conditions = ['ds.tag_id = $1'];
  addDateFilters(params, conditions, 'ds', dateFrom, dateTo);
  params.push(Math.min(Number(limit) || 30, 90));

  const { rows } = await pool.query(
    `SELECT ds.date,
            ds.impressions,
            ds.clicks,
            ds.viewable_imps,
            ds.measured_imps,
            ds.undetermined_imps,
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

export async function getTagSummary(pool, workspaceId, tagId, opts = {}) {
  const { dateFrom, dateTo } = opts;
  const { rows: tagRows } = await pool.query(
    `SELECT id FROM ad_tags WHERE id = $1 AND workspace_id = $2`,
    [tagId, workspaceId],
  );
  if (!tagRows.length) return null;

  const statParams = [tagId];
  const statConditions = ['ds.tag_id = $1'];
  addDateFilters(statParams, statConditions, 'ds', dateFrom, dateTo);

  const summaryQuery = pool.query(
    `SELECT
       COALESCE(SUM(ds.impressions), 0)::bigint AS total_impressions,
       COALESCE(SUM(ds.clicks), 0)::bigint AS total_clicks,
       CASE WHEN COALESCE(SUM(ds.impressions), 0) > 0
         THEN ROUND(COALESCE(SUM(ds.clicks), 0)::NUMERIC / SUM(ds.impressions) * 100, 4)
         ELSE 0 END AS ctr,
       CASE WHEN COALESCE(SUM(ds.measured_imps), 0) > 0
         THEN ROUND(COALESCE(SUM(ds.viewable_imps), 0)::NUMERIC / SUM(ds.measured_imps) * 100, 4)
         ELSE 0 END AS viewability_rate,
       COALESCE(SUM(ds.viewable_imps), 0)::bigint AS total_viewable_impressions,
       COALESCE(SUM(ds.measured_imps), 0)::bigint AS total_measured_impressions,
       COALESCE(SUM(ds.undetermined_imps), 0)::bigint AS total_undetermined_impressions
     FROM tag_daily_stats ds
     WHERE ${statConditions.join(' AND ')}`,
    statParams,
  );

  const engagementQuery = pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN event_type = 'hover_end' THEN event_count ELSE 0 END), 0)::bigint AS total_engagements,
       COALESCE(SUM(CASE WHEN event_type = 'hover_end' THEN total_duration_ms ELSE 0 END), 0)::bigint AS total_attention_duration_ms,
       COALESCE(SUM(CASE WHEN event_type = 'start' THEN event_count ELSE 0 END), 0)::bigint AS video_starts,
       COALESCE(SUM(CASE WHEN event_type = 'complete' THEN event_count ELSE 0 END), 0)::bigint AS video_completions
     FROM tag_engagement_daily_stats
     WHERE tag_id = $1
       ${dateFrom ? `AND date >= $2` : ''}
       ${dateTo ? `AND date <= $${dateFrom ? 3 : 2}` : ''}`,
    statParams,
  );

  const durationParams = [workspaceId, tagId];
  const durationConditions = ['ie.workspace_id = $1', 'ie.tag_id = $2'];
  addTimestampFilters(durationParams, durationConditions, 'ie', dateFrom, dateTo);
  const durationQuery = pool.query(
    `SELECT
       COALESCE(SUM(COALESCE(ie.viewability_duration_ms, 0)), 0)::bigint AS total_in_view_duration_ms,
       MAX(ie.timestamp) AS latest_timestamp,
       MAX(ie.site_domain) FILTER (WHERE COALESCE(ie.site_domain, '') <> '') AS site_domain,
       MAX(ie.country) FILTER (WHERE COALESCE(ie.country, '') <> '') AS country,
       MAX(ie.region) FILTER (WHERE COALESCE(ie.region, '') <> '') AS region,
       MAX(ie.city) FILTER (WHERE COALESCE(ie.city, '') <> '') AS city,
       MAX(ie.device_type) FILTER (WHERE COALESCE(ie.device_type, '') <> '') AS device_type,
       MAX(ie.device_model) FILTER (WHERE COALESCE(ie.device_model, '') <> '') AS device_model,
       MAX(ie.browser) FILTER (WHERE COALESCE(ie.browser, '') <> '') AS browser,
       MAX(ie.os) FILTER (WHERE COALESCE(ie.os, '') <> '') AS os
     FROM impression_events ie
     WHERE ${durationConditions.join(' AND ')}`,
    durationParams,
  );

  const last7dQuery = pool.query(
    `SELECT COALESCE(SUM(impressions), 0)::bigint AS impressions_7d
     FROM tag_daily_stats
     WHERE tag_id = $1
       AND date >= CURRENT_DATE - INTERVAL '6 days'`,
    [tagId],
  );

  const [summaryResult, engagementResult, durationResult, last7dResult] = await Promise.all([
    summaryQuery,
    engagementQuery,
    durationQuery,
    last7dQuery,
  ]);

  const summary = summaryResult.rows[0] ?? {};
  const engagement = engagementResult.rows[0] ?? {};
  const duration = durationResult.rows[0] ?? {};
  const last7d = last7dResult.rows[0] ?? {};

  const videoStarts = Number(engagement.video_starts || 0);
  const videoCompletions = Number(engagement.video_completions || 0);
  const totalImpressions = Number(summary.total_impressions || 0);

  return {
    totalImpressions,
    totalClicks: Number(summary.total_clicks || 0),
    ctr: Number(summary.ctr || 0),
    viewabilityRate: Number(summary.viewability_rate || 0),
    totalInViewDurationMs: Number(duration.total_in_view_duration_ms || 0),
    totalAttentionDurationMs: Number(engagement.total_attention_duration_ms || 0),
    impressionsLast7d: Number(last7d.impressions_7d || 0),
    videoStarts,
    videoStartRate: totalImpressions > 0 ? Number(((videoStarts / totalImpressions) * 100).toFixed(4)) : 0,
    videoCompletions,
    videoCompletionRate: videoStarts > 0 ? Number(((videoCompletions / videoStarts) * 100).toFixed(4)) : 0,
    latestContext: {
      siteDomain: duration.site_domain || '',
      pageUrl: '',
      deviceType: duration.device_type || '',
      deviceModel: duration.device_model || '',
      browser: duration.browser || '',
      os: duration.os || '',
      contextualIds: '',
      networkId: '',
      sourcePublisherId: '',
      appId: '',
      siteId: '',
      exchangeId: '',
      exchangePublisherId: '',
      exchangeSiteIdOrDomain: '',
      appBundle: '',
      appName: '',
      pagePosition: '',
      contentLanguage: '',
      contentTitle: '',
      contentSeries: '',
      carrier: '',
      appStoreName: '',
      contentGenre: '',
      country: duration.country || '',
      region: duration.region || '',
      city: duration.city || '',
    },
  };
}

export async function getWorkspaceTimeline(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, campaignId = '', tagIds: rawTagIds = [], tagId = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const conditions = ['t.workspace_id = $1'];
  addTagScopeFilters(params, conditions, 't', campaignId, tagIds);
  addDateFilters(params, conditions, 'ds', dateFrom, dateTo);
  const { rows } = await pool.query(
    `SELECT
       ds.date,
       COALESCE(SUM(ds.impressions), 0)::bigint AS impressions,
       COALESCE(SUM(ds.clicks), 0)::bigint AS clicks,
       COALESCE(SUM(ds.viewable_imps), 0)::bigint AS viewable_imps,
       COALESCE(SUM(ds.measured_imps), 0)::bigint AS measured_imps,
       COALESCE(SUM(ds.undetermined_imps), 0)::bigint AS undetermined_imps,
       CASE WHEN COALESCE(SUM(ds.impressions), 0) > 0
         THEN ROUND(COALESCE(SUM(ds.clicks), 0)::NUMERIC / SUM(ds.impressions) * 100, 4)
         ELSE 0 END AS ctr,
       CASE WHEN COALESCE(SUM(ds.measured_imps), 0) > 0
         THEN ROUND(COALESCE(SUM(ds.viewable_imps), 0)::NUMERIC / SUM(ds.measured_imps) * 100, 4)
         ELSE 0 END AS viewability_rate
     FROM tag_daily_stats ds
     JOIN ad_tags t ON t.id = ds.tag_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY ds.date
     ORDER BY ds.date ASC`,
    params,
  );
  return rows;
}

export async function getWorkspaceOverview(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, campaignId = '', tagIds: rawTagIds = [], tagId = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const summaryParams = [workspaceId];
  const summaryConditions = ['t.workspace_id = $1'];
  addTagScopeFilters(summaryParams, summaryConditions, 't', campaignId, tagIds);
  addDateFilters(summaryParams, summaryConditions, 'ds', dateFrom, dateTo);

  const summaryQuery = pool.query(
    `SELECT
       COALESCE(SUM(ds.impressions), 0)::bigint AS total_impressions,
       COALESCE(SUM(ds.clicks), 0)::bigint AS total_clicks,
       COALESCE(SUM(ds.viewable_imps), 0)::bigint AS total_viewable_impressions,
       COALESCE(SUM(ds.measured_imps), 0)::bigint AS total_measured_impressions,
       COALESCE(SUM(ds.undetermined_imps), 0)::bigint AS total_undetermined_impressions,
       COALESCE(SUM(ds.spend), 0) AS total_spend,
       CASE WHEN COALESCE(SUM(ds.impressions), 0) > 0
         THEN ROUND(COALESCE(SUM(ds.clicks), 0)::NUMERIC / SUM(ds.impressions) * 100, 4)
         ELSE 0 END AS avg_ctr,
       CASE WHEN COALESCE(SUM(ds.impressions), 0) > 0
         THEN ROUND(COALESCE(SUM(ds.measured_imps), 0)::NUMERIC / SUM(ds.impressions) * 100, 4)
         ELSE 0 END AS measurable_rate,
       CASE WHEN COALESCE(SUM(ds.measured_imps), 0) > 0
         THEN ROUND(COALESCE(SUM(ds.viewable_imps), 0)::NUMERIC / SUM(ds.measured_imps) * 100, 4)
         ELSE 0 END AS viewability_rate
     FROM tag_daily_stats ds
     JOIN ad_tags t ON t.id = ds.tag_id
     WHERE ${summaryConditions.join(' AND ')}`,
    summaryParams,
  );

  const engagementParams = [workspaceId];
  const engagementConditions = ['t.workspace_id = $1'];
  addTagScopeFilters(engagementParams, engagementConditions, 't', campaignId, tagIds);
  addDateFilters(engagementParams, engagementConditions, 'es', dateFrom, dateTo);
  const engagementQuery = pool.query(
    `SELECT
       COALESCE(SUM(es.event_count), 0)::bigint AS total_engagements,
       COALESCE(SUM(CASE WHEN es.event_type = 'hover_end' THEN es.total_duration_ms ELSE 0 END), 0)::bigint AS total_hover_duration_ms,
       COALESCE(SUM(CASE WHEN es.event_type = 'start' THEN es.event_count ELSE 0 END), 0)::bigint AS video_starts,
       COALESCE(SUM(CASE WHEN es.event_type = 'firstQuartile' THEN es.event_count ELSE 0 END), 0)::bigint AS video_first_quartile,
       COALESCE(SUM(CASE WHEN es.event_type = 'midpoint' THEN es.event_count ELSE 0 END), 0)::bigint AS video_midpoint,
       COALESCE(SUM(CASE WHEN es.event_type = 'thirdQuartile' THEN es.event_count ELSE 0 END), 0)::bigint AS video_third_quartile,
       COALESCE(SUM(CASE WHEN es.event_type = 'complete' THEN es.event_count ELSE 0 END), 0)::bigint AS video_completions
     FROM tag_engagement_daily_stats es
     JOIN ad_tags t ON t.id = es.tag_id
     WHERE ${engagementConditions.join(' AND ')}`,
    engagementParams,
  );

  const durationParams = [workspaceId];
  const durationConditions = ['ie.workspace_id = $1'];
  addImpressionScopeFilters(durationParams, durationConditions, 't', 'ie', campaignId, tagIds);
  addTimestampFilters(durationParams, durationConditions, 'ie', dateFrom, dateTo);
  const durationQuery = pool.query(
    `SELECT COALESCE(SUM(COALESCE(ie.viewability_duration_ms, 0)), 0)::bigint AS total_in_view_duration_ms
     FROM impression_events ie
     JOIN ad_tags t ON t.id = ie.tag_id
     WHERE ${durationConditions.join(' AND ')}`,
    durationParams,
  );

  const activeCampaignParams = [workspaceId];
  const activeCampaignConditions = ['workspace_id = $1', "status = 'active'"];
  if (campaignId) {
    activeCampaignParams.push(campaignId);
    activeCampaignConditions.push(`id = $${activeCampaignParams.length}`);
  }
  const activeCampaignsQuery = pool.query(
    `SELECT COUNT(*)::int AS active_campaigns FROM campaigns WHERE ${activeCampaignConditions.join(' AND ')}`,
    activeCampaignParams,
  );

  const activeTagParams = [workspaceId];
  const activeTagConditions = ['workspace_id = $1', "status = 'active'"];
  addTagScopeFilters(activeTagParams, activeTagConditions, 'ad_tags', campaignId, tagIds);
  const activeTagsQuery = pool.query(
    `SELECT COUNT(*)::int AS active_tags FROM ad_tags WHERE ${activeTagConditions.join(' AND ')}`,
    activeTagParams,
  );

  const [summaryRes, engagementRes, durationRes, activeCampaignsRes, activeTagsRes] = await Promise.all([
    summaryQuery,
    engagementQuery,
    durationQuery,
    activeCampaignsQuery,
    activeTagsQuery,
  ]);

  const summary = summaryRes.rows[0] ?? {};
  const engagement = engagementRes.rows[0] ?? {};
  const duration = durationRes.rows[0] ?? {};
  const activeCampaigns = activeCampaignsRes.rows[0] ?? {};
  const activeTags = activeTagsRes.rows[0] ?? {};
  const totalImpressions = Number(summary.total_impressions ?? 0);
  const videoStarts = Number(engagement.video_starts ?? 0);
  const videoCompletions = Number(engagement.video_completions ?? 0);

  return {
    total_impressions: totalImpressions,
    total_clicks: Number(summary.total_clicks ?? 0),
    total_spend: Number(summary.total_spend ?? 0),
    total_viewable_impressions: Number(summary.total_viewable_impressions ?? 0),
    total_measured_impressions: Number(summary.total_measured_impressions ?? 0),
    total_undetermined_impressions: Number(summary.total_undetermined_impressions ?? 0),
    measurable_rate: Number(summary.measurable_rate ?? 0),
    viewability_rate: Number(summary.viewability_rate ?? 0),
    avg_ctr: Number(summary.avg_ctr ?? 0),
    total_engagements: Number(engagement.total_engagements ?? 0),
    engagement_rate: totalImpressions > 0 ? Number(((Number(engagement.total_engagements ?? 0) / totalImpressions) * 100).toFixed(4)) : 0,
    total_hover_duration_ms: Number(engagement.total_hover_duration_ms ?? 0),
    video_starts: videoStarts,
    video_first_quartile: Number(engagement.video_first_quartile ?? 0),
    video_midpoint: Number(engagement.video_midpoint ?? 0),
    video_third_quartile: Number(engagement.video_third_quartile ?? 0),
    video_completions: videoCompletions,
    video_completion_rate: videoStarts > 0 ? Number(((videoCompletions / videoStarts) * 100).toFixed(4)) : 0,
    total_in_view_duration_ms: Number(duration.total_in_view_duration_ms ?? 0),
    total_identities: 0,
    avg_identity_frequency: 0,
    avg_identity_clicks: 0,
    active_campaigns: Number(activeCampaigns.active_campaigns ?? 0),
    active_tags: Number(activeTags.active_tags ?? 0),
    total_creatives: 0,
  };
}

export async function getWorkspaceCampaignBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, limit = 25, campaignId = '', tagIds: rawTagIds = [], tagId = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const conditions = ['c.workspace_id = $1'];
  if (campaignId) {
    params.push(campaignId);
    conditions.push(`c.id = $${params.length}`);
  }
  if (tagIds.length === 1) {
    params.push(tagIds[0]);
    conditions.push(`EXISTS (SELECT 1 FROM ad_tags t3 WHERE t3.campaign_id = c.id AND t3.workspace_id = c.workspace_id AND t3.id = $${params.length})`);
  } else if (tagIds.length > 1) {
    params.push(tagIds);
    conditions.push(`EXISTS (SELECT 1 FROM ad_tags t3 WHERE t3.campaign_id = c.id AND t3.workspace_id = c.workspace_id AND t3.id = ANY($${params.length}::uuid[]))`);
  }
  const dateClauses = [];
  if (dateFrom) {
    params.push(dateFrom);
    dateClauses.push(`ds.date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    dateClauses.push(`ds.date <= $${params.length}`);
  }
  const joinDateFilter = dateClauses.length ? ` AND ${dateClauses.join(' AND ')}` : '';
  params.push(normalizeLimit(limit));

  const { rows } = await pool.query(
    `SELECT
       c.id,
       c.name,
       c.status,
       COALESCE(SUM(ds.impressions), 0)::bigint AS impressions,
       COALESCE(SUM(ds.clicks), 0)::bigint AS clicks,
       COALESCE(SUM(ds.viewable_imps), 0)::bigint AS viewable_imps,
       COALESCE(SUM(ds.measured_imps), 0)::bigint AS measured_imps,
       COALESCE(SUM(ds.undetermined_imps), 0)::bigint AS undetermined_imps,
       COALESCE(SUM(ds.spend), 0) AS spend,
       0::bigint AS unique_identities,
       0::numeric AS avg_frequency,
       CASE WHEN COALESCE(SUM(ds.impressions), 0) > 0
         THEN ROUND(COALESCE(SUM(ds.clicks), 0)::NUMERIC / SUM(ds.impressions) * 100, 4)
         ELSE 0 END AS ctr,
       CASE WHEN COALESCE(SUM(ds.measured_imps), 0) > 0
         THEN ROUND(COALESCE(SUM(ds.viewable_imps), 0)::NUMERIC / SUM(ds.measured_imps) * 100, 4)
         ELSE 0 END AS viewability_rate
     FROM campaigns c
     LEFT JOIN ad_tags t ON t.campaign_id = c.id AND t.workspace_id = c.workspace_id
     LEFT JOIN tag_daily_stats ds ON ds.tag_id = t.id${joinDateFilter}
     WHERE ${conditions.join(' AND ')}
     GROUP BY c.id, c.name, c.status
     ORDER BY COALESCE(SUM(ds.impressions), 0) DESC, c.name ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function getWorkspaceTagBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, limit = 25, campaignId = '', tagIds: rawTagIds = [], tagId = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const conditions = ['t.workspace_id = $1'];
  addTagScopeFilters(params, conditions, 't', campaignId, tagIds);
  addDateFilters(params, conditions, 'ds', dateFrom, dateTo);
  params.push(normalizeLimit(limit));

  const { rows } = await pool.query(
    `SELECT
       t.id,
       t.name,
       t.format,
       t.status,
       COALESCE(SUM(ds.impressions), 0)::bigint AS impressions,
       COALESCE(SUM(ds.clicks), 0)::bigint AS clicks,
       COALESCE(SUM(ds.viewable_imps), 0)::bigint AS viewable_imps,
       COALESCE(SUM(ds.measured_imps), 0)::bigint AS measured_imps,
       COALESCE(SUM(ds.undetermined_imps), 0)::bigint AS undetermined_imps,
       COALESCE(SUM(ds.spend), 0) AS spend,
       0::bigint AS unique_identities,
       0::numeric AS avg_frequency,
       CASE WHEN COALESCE(SUM(ds.impressions), 0) > 0
         THEN ROUND(COALESCE(SUM(ds.clicks), 0)::NUMERIC / SUM(ds.impressions) * 100, 4)
         ELSE 0 END AS ctr,
       CASE WHEN COALESCE(SUM(ds.measured_imps), 0) > 0
         THEN ROUND(COALESCE(SUM(ds.viewable_imps), 0)::NUMERIC / SUM(ds.measured_imps) * 100, 4)
         ELSE 0 END AS viewability_rate
     FROM ad_tags t
     LEFT JOIN tag_daily_stats ds ON ds.tag_id = t.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY t.id, t.name, t.format, t.status
     ORDER BY COALESCE(SUM(ds.impressions), 0) DESC, t.name ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

async function getImpressionGroupedBreakdown(pool, workspaceId, groupSql, labelAlias, opts = {}) {
  const { dateFrom, dateTo, limit = 25, campaignId = '', tagIds: rawTagIds = [], tagId = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const conditions = ['ie.workspace_id = $1'];
  addImpressionScopeFilters(params, conditions, 't', 'ie', campaignId, tagIds);
  addTimestampFilters(params, conditions, 'ie', dateFrom, dateTo);
  params.push(normalizeLimit(limit));
  const { rows } = await pool.query(
    `SELECT
       ${groupSql} AS ${labelAlias},
       COUNT(*)::bigint AS impressions,
       COALESCE(SUM(CASE WHEN COALESCE(ie.click_count, 0) > 0 THEN 1 ELSE 0 END), 0)::bigint AS clicks,
       COALESCE(SUM(CASE WHEN COALESCE(ie.is_viewable, false) THEN 1 ELSE 0 END), 0)::bigint AS viewable_imps,
       COALESCE(SUM(CASE WHEN ie.measured IS NOT NULL THEN 1 ELSE 0 END), 0)::bigint AS measured_imps,
       COALESCE(SUM(CASE WHEN ie.measured IS NULL THEN 1 ELSE 0 END), 0)::bigint AS undetermined_imps,
       0::bigint AS unique_identities,
       0::numeric AS avg_frequency,
       CASE WHEN COUNT(*) > 0
         THEN ROUND(COALESCE(SUM(CASE WHEN COALESCE(ie.click_count, 0) > 0 THEN 1 ELSE 0 END), 0)::NUMERIC / COUNT(*) * 100, 4)
         ELSE 0 END AS ctr,
       CASE WHEN COALESCE(SUM(CASE WHEN ie.measured IS NOT NULL THEN 1 ELSE 0 END), 0) > 0
         THEN ROUND(COALESCE(SUM(CASE WHEN COALESCE(ie.is_viewable, false) THEN 1 ELSE 0 END), 0)::NUMERIC / SUM(CASE WHEN ie.measured IS NOT NULL THEN 1 ELSE 0 END) * 100, 4)
         ELSE 0 END AS viewability_rate
     FROM impression_events ie
     JOIN ad_tags t ON t.id = ie.tag_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY 1
     ORDER BY impressions DESC, 1 ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows.filter((row) => String(row[labelAlias] ?? '').trim());
}

export function getWorkspaceSiteBreakdown(pool, workspaceId, opts = {}) {
  return getImpressionGroupedBreakdown(pool, workspaceId, `COALESCE(NULLIF(ie.site_domain, ''), 'Unknown')`, 'site_domain', opts);
}

export function getWorkspaceCountryBreakdown(pool, workspaceId, opts = {}) {
  return getImpressionGroupedBreakdown(pool, workspaceId, `COALESCE(NULLIF(ie.country, ''), 'Unknown')`, 'country', opts);
}

export function getWorkspaceRegionBreakdown(pool, workspaceId, opts = {}) {
  return getImpressionGroupedBreakdown(pool, workspaceId, `COALESCE(NULLIF(ie.region, ''), 'Unknown')`, 'region', opts);
}

export function getWorkspaceCityBreakdown(pool, workspaceId, opts = {}) {
  return getImpressionGroupedBreakdown(pool, workspaceId, `COALESCE(NULLIF(ie.city, ''), 'Unknown')`, 'city', opts);
}

export async function getWorkspaceTrackerBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, limit = 25, campaignId = '', tagIds: rawTagIds = [], tagId = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const conditions = ['t.workspace_id = $1'];
  addTagScopeFilters(params, conditions, 't', campaignId, tagIds);
  addDateFilters(params, conditions, 'ds', dateFrom, dateTo);
  params.push(normalizeLimit(limit));
  const { rows } = await pool.query(
    `SELECT
       COALESCE(NULLIF(tfc.tracker_type, ''), 'measurement') AS name,
       COALESCE(NULLIF(tfc.tracker_type, ''), 'measurement') AS tracker_type,
       COALESCE(SUM(ds.impressions), 0)::bigint AS impressions,
       COALESCE(SUM(ds.clicks), 0)::bigint AS clicks,
       0::bigint AS unique_identities,
       0::numeric AS avg_frequency,
       CASE WHEN COALESCE(SUM(ds.impressions), 0) > 0
         THEN ROUND(COALESCE(SUM(ds.clicks), 0)::NUMERIC / SUM(ds.impressions) * 100, 4)
         ELSE 0 END AS ctr,
       MAX(c.name) AS campaign_name
     FROM ad_tags t
     LEFT JOIN tag_format_configs tfc ON tfc.tag_id = t.id
     LEFT JOIN campaigns c ON c.id = t.campaign_id
     LEFT JOIN tag_daily_stats ds ON ds.tag_id = t.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY 1, 2
     ORDER BY clicks DESC, impressions DESC, 1 ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function getWorkspaceEngagementBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, limit = 25, campaignId = '', tagIds: rawTagIds = [], tagId = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const conditions = ['t.workspace_id = $1'];
  addTagScopeFilters(params, conditions, 't', campaignId, tagIds);
  addDateFilters(params, conditions, 'es', dateFrom, dateTo);
  params.push(normalizeLimit(limit));
  const { rows } = await pool.query(
    `SELECT
       es.event_type,
       COALESCE(SUM(es.event_count), 0)::bigint AS event_count,
       COALESCE(SUM(es.total_duration_ms), 0)::bigint AS total_duration_ms
     FROM tag_engagement_daily_stats es
     JOIN ad_tags t ON t.id = es.tag_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY es.event_type
     ORDER BY event_count DESC, es.event_type ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function getWorkspaceCreativeBreakdown() {
  return [];
}

export async function getWorkspaceVariantBreakdown() {
  return [];
}

export async function getWorkspaceContextSnapshot(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, campaignId = '', tagIds: rawTagIds = [], tagId = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const latestParams = [workspaceId];
  const latestConditions = ['ie.workspace_id = $1'];
  addImpressionScopeFilters(latestParams, latestConditions, 't', 'ie', campaignId, tagIds);
  addTimestampFilters(latestParams, latestConditions, 'ie', dateFrom, dateTo);
  const latestQuery = pool.query(
    `SELECT
       ie.site_domain,
       ie.page_url,
       ie.device_type,
       ie.device_model,
       ie.browser,
       ie.os,
       ie.country,
       ie.region,
       ie.city,
       ie.app_bundle,
       ie.app_name,
       ie.app_id,
       ie.exchange_id,
       ie.network_id,
       ie.page_position,
       ie.content_language,
       ie.content_title,
       ie.content_series,
       ie.carrier,
       ie.app_store_name,
       ie.content_genre
     FROM impression_events ie
     JOIN ad_tags t ON t.id = ie.tag_id
     WHERE ${latestConditions.join(' AND ')}
     ORDER BY ie.timestamp DESC
     LIMIT 1`,
    latestParams,
  );

  const deviceTypeBreakdown = getImpressionGroupedBreakdown(pool, workspaceId, `COALESCE(NULLIF(ie.device_type, ''), 'Unknown')`, 'label', opts);
  const deviceModelBreakdown = getImpressionGroupedBreakdown(pool, workspaceId, `COALESCE(NULLIF(ie.device_model, ''), 'Unknown')`, 'label', opts);
  const inventoryBreakdown = getImpressionGroupedBreakdown(
    pool,
    workspaceId,
    `CASE WHEN COALESCE(ie.app_id, '') <> '' OR COALESCE(ie.app_bundle, '') <> '' OR COALESCE(ie.app_name, '') <> '' THEN 'app' ELSE 'web' END`,
    'label',
    opts,
  );

  const [latestResult, deviceTypes, deviceModels, inventoryEnvironments] = await Promise.all([
    latestQuery,
    deviceTypeBreakdown,
    deviceModelBreakdown,
    inventoryBreakdown,
  ]);

  return {
    latest_context: latestResult.rows[0] ?? null,
    device_types: deviceTypes.map((item) => ({ label: item.label, value: Number(item.impressions || 0) })),
    device_models: deviceModels.map((item) => ({ label: item.label, value: Number(item.impressions || 0) })),
    inventory_environments: inventoryEnvironments.map((item) => ({ label: item.label, value: Number(item.impressions || 0) })),
  };
}
