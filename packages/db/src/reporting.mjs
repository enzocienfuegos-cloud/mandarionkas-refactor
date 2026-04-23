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

function addDateJoinFilters(params, alias, dateFrom, dateTo) {
  const clauses = [];
  if (dateFrom) {
    params.push(dateFrom);
    clauses.push(`${alias}.date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    clauses.push(`${alias}.date <= $${params.length}`);
  }
  return clauses.length ? ` AND ${clauses.join(' AND ')}` : '';
}

export async function getTagStats(pool, workspaceId, tagId, opts = {}) {
  const { dateFrom, dateTo, limit = 30 } = opts;
  const params = [tagId];
  const conditions = ['ds.tag_id = $1'];

  const { rows: tagCheck } = await pool.query(
    `SELECT id FROM ad_tags WHERE id = $1 AND workspace_id = $2`,
    [tagId, workspaceId],
  );
  if (!tagCheck.length) return null;

  addDateFilters(params, conditions, 'ds', dateFrom, dateTo);
  params.push(Math.min(Number(limit) || 30, 90));

  const { rows } = await pool.query(
    `SELECT ds.date, ds.impressions, ds.clicks, ds.viewable_imps, ds.measured_imps, ds.undetermined_imps, ds.spend,
            CASE WHEN ds.impressions > 0 THEN ROUND(ds.clicks::NUMERIC / ds.impressions * 100, 4) ELSE 0 END AS ctr,
            CASE WHEN ds.measured_imps > 0 THEN ROUND(ds.viewable_imps::NUMERIC / ds.measured_imps * 100, 4) ELSE 0 END AS viewability_rate
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

  addDateFilters(params, conditions, 'ds', dateFrom, dateTo);

  const { rows } = await pool.query(
    `SELECT
       ds.date,
       COALESCE(SUM(ds.impressions), 0)::bigint AS impressions,
       COALESCE(SUM(ds.clicks), 0)::bigint AS clicks,
       COALESCE(SUM(ds.viewable_imps), 0)::bigint AS viewable_imps,
       COALESCE(SUM(ds.measured_imps), 0)::bigint AS measured_imps,
       COALESCE(SUM(ds.undetermined_imps), 0)::bigint AS undetermined_imps,
       COALESCE(SUM(ds.spend), 0) AS spend,
       CASE WHEN SUM(ds.impressions) > 0
            THEN ROUND(SUM(ds.clicks)::NUMERIC / SUM(ds.impressions) * 100, 4)
            ELSE 0 END AS ctr,
       CASE WHEN COALESCE(SUM(ds.measured_imps), 0) > 0
            THEN ROUND(COALESCE(SUM(ds.viewable_imps), 0)::NUMERIC / SUM(ds.measured_imps) * 100, 4)
            ELSE 0 END AS viewability_rate
     FROM tag_daily_stats ds
     JOIN ad_tags t ON t.id = ds.tag_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY ds.date
     ORDER BY ds.date DESC`,
    params,
  );
  return rows;
}

export async function getWorkspaceOverview(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, topLimit = 5 } = opts;
  const summaryParams = [workspaceId];
  const summaryConditions = ['t.workspace_id = $1'];

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
  addDateFilters(engagementParams, engagementConditions, 'ds', dateFrom, dateTo);
  const engagementQuery = pool.query(
    `SELECT
       COALESCE(SUM(ds.event_count), 0)::bigint AS total_engagements,
       COALESCE(SUM(CASE WHEN ds.event_type = 'hover_end' THEN ds.total_duration_ms ELSE 0 END), 0)::bigint AS total_hover_duration_ms
     FROM tag_engagement_daily_stats ds
     JOIN ad_tags t ON t.id = ds.tag_id
     WHERE ${engagementConditions.join(' AND ')}`,
    engagementParams,
  );

  const durationParams = [workspaceId];
  const durationConditions = ['ie.workspace_id = $1'];
  if (dateFrom) {
    durationParams.push(dateFrom);
    durationConditions.push(`ie.timestamp >= $${durationParams.length}::timestamptz`);
  }
  if (dateTo) {
    durationParams.push(`${dateTo}T23:59:59.999Z`);
    durationConditions.push(`ie.timestamp <= $${durationParams.length}::timestamptz`);
  }
  const durationQuery = pool.query(
    `SELECT
       COALESCE(SUM(COALESCE(ie.viewability_duration_ms, 0)), 0)::bigint AS total_in_view_duration_ms
     FROM impression_events ie
     WHERE ${durationConditions.join(' AND ')}`,
    durationParams,
  );

  const activeCampaignsQuery = pool.query(
    `SELECT COUNT(*)::int AS active_campaigns
     FROM campaigns
     WHERE workspace_id = $1 AND status = 'active'`,
    [workspaceId],
  );
  const activeTagsQuery = pool.query(
    `SELECT COUNT(*)::int AS active_tags
     FROM ad_tags
     WHERE workspace_id = $1 AND status = 'active'`,
    [workspaceId],
  );
  const creativesQuery = pool.query(
    `SELECT COUNT(*)::int AS total_creatives
     FROM creatives
     WHERE workspace_id = $1`,
    [workspaceId],
  );
  const identitySummaryParams = [workspaceId];
  const identitySummaryConditions = ['ds.workspace_id = $1'];
  addDateFilters(identitySummaryParams, identitySummaryConditions, 'ds', dateFrom, dateTo);
  const identitySummaryQuery = pool.query(
    `SELECT
       COUNT(DISTINCT ds.identity_profile_id)::bigint AS total_identities,
       COALESCE(SUM(ds.impressions), 0)::bigint AS identity_impressions,
       COALESCE(SUM(ds.clicks), 0)::bigint AS identity_clicks
     FROM identity_profile_daily_stats ds
     WHERE ${identitySummaryConditions.join(' AND ')}`,
    identitySummaryParams,
  );

  const topCampaignParams = [workspaceId];
  const topCampaignJoinFilter = addDateJoinFilters(topCampaignParams, 'ds', dateFrom, dateTo);
  topCampaignParams.push(Math.min(Number(topLimit) || 5, 20));
  const topCampaignsQuery = pool.query(
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
       CASE WHEN COALESCE(SUM(ds.impressions), 0) > 0
            THEN ROUND(COALESCE(SUM(ds.clicks), 0)::NUMERIC / SUM(ds.impressions) * 100, 4)
            ELSE 0 END AS ctr,
       CASE WHEN COALESCE(SUM(ds.measured_imps), 0) > 0
            THEN ROUND(COALESCE(SUM(ds.viewable_imps), 0)::NUMERIC / SUM(ds.measured_imps) * 100, 4)
            ELSE 0 END AS viewability_rate
     FROM campaigns c
     LEFT JOIN ad_tags t
       ON t.campaign_id = c.id
      AND t.workspace_id = c.workspace_id
     LEFT JOIN tag_daily_stats ds
       ON ds.tag_id = t.id${topCampaignJoinFilter}
     WHERE c.workspace_id = $1
     GROUP BY c.id, c.name, c.status
     ORDER BY COALESCE(SUM(ds.impressions), 0) DESC, c.name ASC
     LIMIT $${topCampaignParams.length}`,
    topCampaignParams,
  );

  const topTagParams = [workspaceId];
  const topTagConditions = ['t.workspace_id = $1'];
  addDateFilters(topTagParams, topTagConditions, 'ds', dateFrom, dateTo);
  topTagParams.push(Math.min(Number(topLimit) || 5, 20));
  const topTagsQuery = pool.query(
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
       CASE WHEN COALESCE(SUM(ds.impressions), 0) > 0
            THEN ROUND(COALESCE(SUM(ds.clicks), 0)::NUMERIC / SUM(ds.impressions) * 100, 4)
            ELSE 0 END AS ctr,
       CASE WHEN COALESCE(SUM(ds.measured_imps), 0) > 0
            THEN ROUND(COALESCE(SUM(ds.viewable_imps), 0)::NUMERIC / SUM(ds.measured_imps) * 100, 4)
            ELSE 0 END AS viewability_rate
     FROM ad_tags t
     LEFT JOIN tag_daily_stats ds ON ds.tag_id = t.id
     WHERE ${topTagConditions.join(' AND ')}
     GROUP BY t.id, t.name, t.format, t.status
     ORDER BY COALESCE(SUM(ds.impressions), 0) DESC, t.name ASC
     LIMIT $${topTagParams.length}`,
    topTagParams,
  );

  const [summaryRes, engagementRes, durationRes, activeCampaignsRes, activeTagsRes, creativesRes, identitySummaryRes, topCampaignsRes, topTagsRes] =
    await Promise.all([
      summaryQuery,
      engagementQuery,
      durationQuery,
      activeCampaignsQuery,
      activeTagsQuery,
      creativesQuery,
      identitySummaryQuery,
      topCampaignsQuery,
      topTagsQuery,
    ]);

  const summary = summaryRes.rows[0] ?? {};
  const engagement = engagementRes.rows[0] ?? {};
  const duration = durationRes.rows[0] ?? {};
  const identitySummary = identitySummaryRes.rows[0] ?? {};
  const totalIdentities = Number(identitySummary.total_identities ?? 0);
  const identityImpressions = Number(identitySummary.identity_impressions ?? 0);
  const identityClicks = Number(identitySummary.identity_clicks ?? 0);
  const totalImpressions = Number(summary.total_impressions ?? 0);
  const totalEngagements = Number(engagement.total_engagements ?? 0);

  return {
    total_impressions: totalImpressions,
    total_clicks: summary.total_clicks ?? 0,
    total_viewable_impressions: summary.total_viewable_impressions ?? 0,
    total_measured_impressions: summary.total_measured_impressions ?? 0,
    total_undetermined_impressions: summary.total_undetermined_impressions ?? 0,
    total_spend: summary.total_spend ?? 0,
    avg_ctr: summary.avg_ctr ?? 0,
    measurable_rate: summary.measurable_rate ?? 0,
    viewability_rate: summary.viewability_rate ?? 0,
    total_engagements: totalEngagements,
    engagement_rate: totalImpressions > 0 ? Number(((totalEngagements / totalImpressions) * 100).toFixed(4)) : 0,
    total_hover_duration_ms: engagement.total_hover_duration_ms ?? 0,
    total_in_view_duration_ms: duration.total_in_view_duration_ms ?? 0,
    total_identities: totalIdentities,
    avg_identity_frequency: totalIdentities > 0 ? Number((identityImpressions / totalIdentities).toFixed(4)) : 0,
    avg_identity_clicks: totalIdentities > 0 ? Number((identityClicks / totalIdentities).toFixed(4)) : 0,
    active_campaigns: activeCampaignsRes.rows[0]?.active_campaigns ?? 0,
    active_tags: activeTagsRes.rows[0]?.active_tags ?? 0,
    total_creatives: creativesRes.rows[0]?.total_creatives ?? 0,
    top_campaigns: topCampaignsRes.rows,
    top_tags: topTagsRes.rows,
  };
}

export async function getWorkspaceCampaignBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, limit = 25 } = opts;
  const params = [workspaceId];
  const joinFilter = addDateJoinFilters(params, 'ds', dateFrom, dateTo);
  const identityConditions = ['ie.workspace_id = c.workspace_id', 't2.campaign_id = c.id', "e.event_type = 'impression'", 'e.identity_profile_id IS NOT NULL'];
  const identityParams = [];
  if (dateFrom) {
    identityParams.push(dateFrom);
    identityConditions.push(`ie.timestamp >= $${params.length + identityParams.length}`);
  }
  if (dateTo) {
    identityParams.push(`${dateTo}T23:59:59.999Z`);
    identityConditions.push(`ie.timestamp <= $${params.length + identityParams.length}`);
  }
  params.push(...identityParams);
  params.push(Math.min(Number(limit) || 25, 100));

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
       (
         SELECT COUNT(DISTINCT e.identity_profile_id)::bigint
         FROM ad_tags t2
         JOIN impression_events ie ON ie.tag_id = t2.id
         JOIN event_identity_keys e ON e.event_id = ie.id
         WHERE ${identityConditions.join(' AND ')}
       ) AS unique_identities,
       (
         SELECT CASE
           WHEN COUNT(DISTINCT e.identity_profile_id) > 0
             THEN ROUND(COUNT(DISTINCT ie.id)::NUMERIC / COUNT(DISTINCT e.identity_profile_id), 4)
           ELSE 0
         END
         FROM ad_tags t2
         JOIN impression_events ie ON ie.tag_id = t2.id
         JOIN event_identity_keys e ON e.event_id = ie.id
         WHERE ${identityConditions.join(' AND ')}
       ) AS avg_frequency,
       CASE WHEN COALESCE(SUM(ds.impressions), 0) > 0
            THEN ROUND(COALESCE(SUM(ds.clicks), 0)::NUMERIC / SUM(ds.impressions) * 100, 4)
            ELSE 0 END AS ctr,
       CASE WHEN COALESCE(SUM(ds.measured_imps), 0) > 0
            THEN ROUND(COALESCE(SUM(ds.viewable_imps), 0)::NUMERIC / SUM(ds.measured_imps) * 100, 4)
            ELSE 0 END AS viewability_rate
     FROM campaigns c
     LEFT JOIN ad_tags t
       ON t.campaign_id = c.id
      AND t.workspace_id = c.workspace_id
     LEFT JOIN tag_daily_stats ds
       ON ds.tag_id = t.id${joinFilter}
     WHERE c.workspace_id = $1
     GROUP BY c.id, c.name, c.status
     ORDER BY COALESCE(SUM(ds.impressions), 0) DESC, c.name ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function getWorkspaceTagBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, limit = 25 } = opts;
  const params = [workspaceId];
  const conditions = ['t.workspace_id = $1'];
  const identityConditions = ['ie.tag_id = t.id', "e.event_type = 'impression'", 'e.identity_profile_id IS NOT NULL'];
  const identityParams = [];

  addDateFilters(params, conditions, 'ds', dateFrom, dateTo);
  if (dateFrom) {
    identityParams.push(dateFrom);
    identityConditions.push(`ie.timestamp >= $${params.length + identityParams.length}`);
  }
  if (dateTo) {
    identityParams.push(`${dateTo}T23:59:59.999Z`);
    identityConditions.push(`ie.timestamp <= $${params.length + identityParams.length}`);
  }
  params.push(...identityParams);
  params.push(Math.min(Number(limit) || 25, 100));

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
       (
         SELECT COUNT(DISTINCT e.identity_profile_id)::bigint
         FROM impression_events ie
         JOIN event_identity_keys e ON e.event_id = ie.id
         WHERE ${identityConditions.join(' AND ')}
       ) AS unique_identities,
       (
         SELECT CASE
           WHEN COUNT(DISTINCT e.identity_profile_id) > 0
             THEN ROUND(COUNT(DISTINCT ie.id)::NUMERIC / COUNT(DISTINCT e.identity_profile_id), 4)
           ELSE 0
         END
         FROM impression_events ie
         JOIN event_identity_keys e ON e.event_id = ie.id
         WHERE ${identityConditions.join(' AND ')}
       ) AS avg_frequency,
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

export async function getWorkspaceCreativeBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, limit = 25 } = opts;
  const params = [workspaceId];
  const joinFilter = addDateJoinFilters(params, 'cvds', dateFrom, dateTo);
  const identityConditions = ['ie.workspace_id = cv.workspace_id', 'ie.creative_id = c.id', "e.event_type = 'impression'", 'e.identity_profile_id IS NOT NULL'];
  const identityParams = [];
  if (dateFrom) {
    identityParams.push(dateFrom);
    identityConditions.push(`ie.timestamp >= $${params.length + identityParams.length}`);
  }
  if (dateTo) {
    identityParams.push(`${dateTo}T23:59:59.999Z`);
    identityConditions.push(`ie.timestamp <= $${params.length + identityParams.length}`);
  }
  params.push(...identityParams);
  params.push(Math.min(Number(limit) || 25, 100));

  const { rows } = await pool.query(
    `SELECT
       c.id,
       c.name,
       c.type,
       cv.id AS creative_version_id,
       cv.version_number,
       cv.status,
       cv.source_kind,
       cv.serving_format,
       COALESCE(SUM(cvds.impressions), 0)::bigint AS impressions,
       COALESCE(SUM(cvds.clicks), 0)::bigint AS clicks,
       (
         SELECT COUNT(DISTINCT e.identity_profile_id)::bigint
         FROM impression_events ie
         JOIN event_identity_keys e ON e.event_id = ie.id
         WHERE ${identityConditions.join(' AND ')}
       ) AS unique_identities,
       (
         SELECT CASE
           WHEN COUNT(DISTINCT e.identity_profile_id) > 0
             THEN ROUND(COUNT(DISTINCT ie.id)::NUMERIC / COUNT(DISTINCT e.identity_profile_id), 4)
           ELSE 0
         END
         FROM impression_events ie
         JOIN event_identity_keys e ON e.event_id = ie.id
         WHERE ${identityConditions.join(' AND ')}
       ) AS avg_frequency,
       CASE WHEN COALESCE(SUM(cvds.impressions), 0) > 0
            THEN ROUND(COALESCE(SUM(cvds.clicks), 0)::NUMERIC / SUM(cvds.impressions) * 100, 4)
            ELSE 0 END AS ctr
     FROM creative_versions cv
     JOIN creatives c
       ON c.id = cv.creative_id
      AND c.workspace_id = cv.workspace_id
     LEFT JOIN creative_size_variants csv
       ON csv.creative_version_id = cv.id
      AND csv.workspace_id = cv.workspace_id
     LEFT JOIN creative_variant_daily_stats cvds
       ON cvds.creative_size_variant_id = csv.id${joinFilter}
     WHERE cv.workspace_id = $1
     GROUP BY c.id, c.name, c.type, cv.id, cv.version_number, cv.status, cv.source_kind, cv.serving_format
     ORDER BY COALESCE(SUM(cvds.impressions), 0) DESC, c.name ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function getWorkspaceVariantBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, limit = 25 } = opts;
  const params = [workspaceId];
  const joinFilter = addDateJoinFilters(params, 'cvds', dateFrom, dateTo);
  const identityConditions = ['ie.workspace_id = csv.workspace_id', 'ie.creative_size_variant_id = csv.id', "e.event_type = 'impression'", 'e.identity_profile_id IS NOT NULL'];
  const identityParams = [];
  if (dateFrom) {
    identityParams.push(dateFrom);
    identityConditions.push(`ie.timestamp >= $${params.length + identityParams.length}`);
  }
  if (dateTo) {
    identityParams.push(`${dateTo}T23:59:59.999Z`);
    identityConditions.push(`ie.timestamp <= $${params.length + identityParams.length}`);
  }
  params.push(...identityParams);
  params.push(Math.min(Number(limit) || 25, 100));

  const { rows } = await pool.query(
    `SELECT
       csv.id,
       csv.creative_version_id,
       csv.label,
       csv.width,
       csv.height,
       csv.status,
       c.id AS creative_id,
       c.name AS creative_name,
       COALESCE(SUM(cvds.impressions), 0)::bigint AS impressions,
       COALESCE(SUM(cvds.clicks), 0)::bigint AS clicks,
       (
         SELECT COUNT(DISTINCT e.identity_profile_id)::bigint
         FROM impression_events ie
         JOIN event_identity_keys e ON e.event_id = ie.id
         WHERE ${identityConditions.join(' AND ')}
       ) AS unique_identities,
       (
         SELECT CASE
           WHEN COUNT(DISTINCT e.identity_profile_id) > 0
             THEN ROUND(COUNT(DISTINCT ie.id)::NUMERIC / COUNT(DISTINCT e.identity_profile_id), 4)
           ELSE 0
         END
         FROM impression_events ie
         JOIN event_identity_keys e ON e.event_id = ie.id
         WHERE ${identityConditions.join(' AND ')}
       ) AS avg_frequency,
       CASE WHEN COALESCE(SUM(cvds.impressions), 0) > 0
            THEN ROUND(COALESCE(SUM(cvds.clicks), 0)::NUMERIC / SUM(cvds.impressions) * 100, 4)
            ELSE 0 END AS ctr
     FROM creative_size_variants csv
     JOIN creative_versions cv
       ON cv.id = csv.creative_version_id
      AND cv.workspace_id = csv.workspace_id
     JOIN creatives c
       ON c.id = cv.creative_id
      AND c.workspace_id = cv.workspace_id
     LEFT JOIN creative_variant_daily_stats cvds
       ON cvds.creative_size_variant_id = csv.id${joinFilter}
     WHERE csv.workspace_id = $1
     GROUP BY csv.id, csv.creative_version_id, csv.label, csv.width, csv.height, csv.status, c.id, c.name
     ORDER BY COALESCE(SUM(cvds.impressions), 0) DESC, c.name ASC, csv.width ASC, csv.height ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function getCampaignStats(pool, workspaceId, campaignId, opts = {}) {
  const { dateFrom, dateTo, limit = 30 } = opts;
  const params = [campaignId, workspaceId];
  const conditions = ['t.campaign_id = $1', 't.workspace_id = $2'];

  addDateFilters(params, conditions, 'ds', dateFrom, dateTo);
  params.push(Math.min(Number(limit) || 30, 90));

  const { rows } = await pool.query(
    `SELECT
       ds.date,
       COALESCE(SUM(ds.impressions), 0)::bigint AS impressions,
       COALESCE(SUM(ds.clicks), 0)::bigint AS clicks,
       COALESCE(SUM(ds.viewable_imps), 0)::bigint AS viewable_imps,
       COALESCE(SUM(ds.measured_imps), 0)::bigint AS measured_imps,
       COALESCE(SUM(ds.undetermined_imps), 0)::bigint AS undetermined_imps,
       COALESCE(SUM(ds.spend), 0) AS spend,
       CASE WHEN SUM(ds.impressions) > 0
            THEN ROUND(SUM(ds.clicks)::NUMERIC / SUM(ds.impressions) * 100, 4)
            ELSE 0 END AS ctr,
       CASE WHEN COALESCE(SUM(ds.measured_imps), 0) > 0
            THEN ROUND(COALESCE(SUM(ds.viewable_imps), 0)::NUMERIC / SUM(ds.measured_imps) * 100, 4)
            ELSE 0 END AS viewability_rate
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
