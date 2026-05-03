import { parseBrowserFromUA, parseDeviceTypeFromUA, parseOsFromUA } from './ua-parser.mjs';

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

function addEventDateFilters(params, conditions, alias, dateFrom, dateTo) {
  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`${alias}.event_date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`${alias}.event_date <= $${params.length}`);
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

function normalizeNonNegativeInt(value) {
  return Math.max(Number.parseInt(String(value ?? '0'), 10) || 0, 0);
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
    conditions.push(`${alias}.id = ANY($${params.length}::text[])`);
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
    conditions.push(`${tagAlias}.id = ANY($${params.length}::text[])`);
  }
}

function addIdentityBreakdownFilters(params, conditions, alias, opts = {}) {
  const {
    canonicalType = '',
    siteDomain = '',
    country = '',
    region = '',
    city = '',
    creativeId = '',
    variantId = '',
  } = opts;

  if (canonicalType === 'external_user_id') {
    conditions.push('1 = 0');
    return;
  }

  conditions.push(`${identityKeyExpression(alias)} <> ''`);

  if (siteDomain) {
    params.push(siteDomain.trim().toLowerCase());
    conditions.push(`LOWER(COALESCE(${alias}.site_domain, '')) = $${params.length}`);
  }
  if (country) {
    params.push(country.trim().toUpperCase());
    conditions.push(`UPPER(COALESCE(${alias}.country, '')) = $${params.length}`);
  }
  if (region) {
    params.push(region.trim().toLowerCase());
    conditions.push(`LOWER(COALESCE(${alias}.region, '')) = $${params.length}`);
  }
  if (city) {
    params.push(city.trim().toLowerCase());
    conditions.push(`LOWER(COALESCE(${alias}.city, '')) = $${params.length}`);
  }

  if (creativeId || variantId) {
    const creativeConditions = [
      `b.workspace_id = ${alias}.workspace_id`,
      `b.tag_id = ${alias}.tag_id`,
      "b.status = 'active'",
      '(b.start_at IS NULL OR b.start_at <= NOW())',
      '(b.end_at IS NULL OR b.end_at >= NOW())',
      'cv.id = b.creative_version_id',
    ];
    if (creativeId) {
      params.push(creativeId);
      creativeConditions.push(`cv.creative_id = $${params.length}`);
    }
    if (variantId) {
      params.push(variantId);
      creativeConditions.push(`COALESCE(b.creative_size_variant_id, '') = $${params.length}`);
    }
    conditions.push(
      `EXISTS (
         SELECT 1
         FROM creative_tag_bindings b
         JOIN creative_versions cv ON cv.id = b.creative_version_id
         WHERE ${creativeConditions.join(' AND ')}
       )`,
    );
  }
}

function identityKeyExpression(alias) {
  return `COALESCE(
    NULLIF(
      CASE
        WHEN COALESCE(${alias}.ip::text, '') <> '' AND COALESCE(${alias}.user_agent, '') <> ''
          THEN md5(COALESCE(${alias}.ip::text, '') || '|' || COALESCE(${alias}.user_agent, ''))
        ELSE ''
      END,
      ''
    ),
    NULLIF(${alias}.device_id, ''),
    ''
  )`;
}

function resolvedIdentityExpression(alias, edgeAlias) {
  return `COALESCE(NULLIF(${edgeAlias}.canonical_id, ''), NULLIF(${alias}.device_id, ''), ${identityKeyExpression(alias)})`;
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
       COALESCE(SUM(CASE WHEN event_type = 'viewable' THEN event_count ELSE 0 END), 0)::bigint AS viewable_count,
       COALESCE(SUM(CASE WHEN event_type = 'viewable' THEN total_duration_ms ELSE 0 END), 0)::bigint AS total_in_view_duration_ms,
       COALESCE(SUM(CASE WHEN event_type = 'start' THEN event_count ELSE 0 END), 0)::bigint AS video_starts,
       COALESCE(SUM(CASE WHEN event_type = 'complete' THEN event_count ELSE 0 END), 0)::bigint AS video_completions
     FROM tag_engagement_daily_stats
     WHERE tag_id = $1
       ${dateFrom ? `AND date >= $2` : ''}
       ${dateTo ? `AND date <= $${dateFrom ? 3 : 2}` : ''}`,
    statParams,
  );

  // Identity signals now come from impression_events.
  const durationParams = [workspaceId, tagId];
  const durationConditions = ['ie.workspace_id = $1', 'ie.tag_id = $2'];
  addTimestampFilters(durationParams, durationConditions, 'ie', dateFrom, dateTo);
  const durationQuery = pool.query(
    `SELECT
       ie.site_domain,
       ie.region,
       ie.city,
       ie.country,
       ie.referer,
       ie.device_type,
       ie.device_model,
       ie.browser,
       ie.os,
       ie.contextual_ids,
       ie.network_id,
       ie.source_publisher_id,
       ie.app_id,
       ie.site_id,
       ie.exchange_id,
       ie.exchange_publisher_id,
       ie.exchange_site_id_or_domain,
       ie.app_bundle,
       ie.app_name,
       ie.page_position,
       ie.content_language,
       ie.content_title,
       ie.content_series,
       ie.carrier,
       ie.app_store_name,
       ie.content_genre,
       ie.user_agent
     FROM impression_events ie
     WHERE ${durationConditions.join(' AND ')}
     ORDER BY ie.timestamp DESC
     LIMIT 1`,
    durationParams,
  );

  const last7dQuery = pool.query(
    `SELECT COALESCE(SUM(impressions), 0)::bigint AS impressions_7d
     FROM tag_daily_stats
     WHERE tag_id = $1
       AND date >= CURRENT_DATE - INTERVAL '6 days'`,
    [tagId],
  );

  const frequencyParams = [workspaceId, tagId];
  const frequencyConditions = ['f.workspace_id = $1', 'f.tag_id = $2'];
  addEventDateFilters(frequencyParams, frequencyConditions, 'f', dateFrom, dateTo);
  const frequencyQuery = pool.query(
    `SELECT
       COALESCE(COUNT(*), 0)::bigint AS unique_identities,
       COALESCE(AVG(freq.device_impressions), 0)::numeric AS avg_frequency
     FROM (
       SELECT f.device_id, SUM(f.impressions)::numeric AS device_impressions
       FROM tag_frequency_cap_events f
       WHERE ${frequencyConditions.join(' AND ')}
       GROUP BY f.device_id
     ) freq`,
    frequencyParams,
  );

  const identityParams = [workspaceId, tagId];
  const identityConditions = ['ie.workspace_id = $1', 'ie.tag_id = $2', "COALESCE(ie.device_id, '') <> ''"];
  addTimestampFilters(identityParams, identityConditions, 'ie', dateFrom, dateTo);
  const identityFallbackQuery = pool.query(
    `SELECT COALESCE(COUNT(DISTINCT ie.device_id), 0)::bigint AS unique_device_ids
     FROM impression_events ie
     WHERE ${identityConditions.join(' AND ')}`,
    identityParams,
  );

  const [summaryResult, engagementResult, durationResult, last7dResult, frequencyResult, identityFallbackResult] = await Promise.all([
    summaryQuery,
    engagementQuery,
    durationQuery,
    last7dQuery,
    frequencyQuery,
    identityFallbackQuery,
  ]);

  const summary = summaryResult.rows[0] ?? {};
  const engagement = engagementResult.rows[0] ?? {};
  const duration = durationResult.rows[0] ?? {};
  const last7d = last7dResult.rows[0] ?? {};
  const frequency = frequencyResult.rows[0] ?? {};
  const identityFallback = identityFallbackResult.rows[0] ?? {};

  const videoStarts = Number(engagement.video_starts || 0);
  const videoCompletions = Number(engagement.video_completions || 0);
  const totalImpressions = Number(summary.total_impressions || 0);
  const viewableCount = Math.min(Number(engagement.viewable_count || 0), totalImpressions);
  const totalEngagements = Number(engagement.total_engagements || 0);
  const uniqueIdentityCount = Math.max(
    Number(frequency.unique_identities || 0),
    Number(identityFallback.unique_device_ids || 0),
  );
  const avgFrequency = Number(frequency.avg_frequency || 0) > 0
    ? Number(frequency.avg_frequency || 0)
    : uniqueIdentityCount > 0
      ? Number((totalImpressions / uniqueIdentityCount).toFixed(4))
      : 0;

  return {
    totalImpressions,
    totalClicks: Number(summary.total_clicks || 0),
    ctr: Number(summary.ctr || 0),
    viewabilityRate: totalImpressions > 0
      ? Number(((viewableCount / totalImpressions) * 100).toFixed(4))
      : 0,
    engagementRate: totalImpressions > 0
      ? Number(((totalEngagements / totalImpressions) * 100).toFixed(4))
      : 0,
    totalInViewDurationMs: Number(engagement.total_in_view_duration_ms || 0),
    totalAttentionDurationMs: Number(engagement.total_attention_duration_ms || 0),
    impressionsLast7d: Number(last7d.impressions_7d || 0),
    uniqueIdentities: uniqueIdentityCount,
    avgFrequency,
    videoStarts,
    videoStartRate: totalImpressions > 0 ? Number(((videoStarts / totalImpressions) * 100).toFixed(4)) : 0,
    videoCompletions,
    videoCompletionRate: videoStarts > 0 ? Number(((videoCompletions / videoStarts) * 100).toFixed(4)) : 0,
    latestContext: {
      siteDomain: duration.site_domain || '',
      pageUrl: duration.referer || '',
      deviceType: duration.device_type || parseDeviceTypeFromUA(duration.user_agent || ''),
      deviceModel: duration.device_model || '',
      browser: duration.browser || parseBrowserFromUA(duration.user_agent || ''),
      os: duration.os || parseOsFromUA(duration.user_agent || ''),
      contextualIds: duration.contextual_ids || '',
      networkId: duration.network_id || '',
      sourcePublisherId: duration.source_publisher_id || '',
      appId: duration.app_id || '',
      siteId: duration.site_id || '',
      exchangeId: duration.exchange_id || '',
      exchangePublisherId: duration.exchange_publisher_id || '',
      exchangeSiteIdOrDomain: duration.exchange_site_id_or_domain || '',
      appBundle: duration.app_bundle || '',
      appName: duration.app_name || '',
      pagePosition: duration.page_position || '',
      contentLanguage: duration.content_language || '',
      contentTitle: duration.content_title || '',
      contentSeries: duration.content_series || '',
      carrier: duration.carrier || '',
      appStoreName: duration.app_store_name || '',
      contentGenre: duration.content_genre || '',
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
       COALESCE(SUM(ds.spend), 0) AS total_spend,
       CASE WHEN COALESCE(SUM(ds.impressions), 0) > 0
         THEN ROUND(COALESCE(SUM(ds.clicks), 0)::NUMERIC / SUM(ds.impressions) * 100, 4)
         ELSE 0 END AS avg_ctr,
       CASE WHEN COALESCE(SUM(ds.impressions), 0) > 0
         THEN 100
         ELSE 0 END AS measurable_rate
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
       COALESCE(SUM(CASE WHEN es.event_type = 'hover_end' THEN es.event_count ELSE 0 END), 0)::bigint AS total_engagements,
       COALESCE(SUM(CASE WHEN es.event_type = 'hover_end' THEN es.total_duration_ms ELSE 0 END), 0)::bigint AS total_hover_duration_ms,
       COALESCE(SUM(CASE WHEN es.event_type = 'viewable' THEN es.event_count ELSE 0 END), 0)::bigint AS viewable_count,
       COALESCE(SUM(CASE WHEN es.event_type = 'viewable' THEN es.total_duration_ms ELSE 0 END), 0)::bigint AS total_in_view_duration_ms,
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
    `SELECT
       COALESCE(COUNT(DISTINCT ie.device_id), 0)::bigint AS unique_device_ids
     FROM impression_events ie
     JOIN ad_tags t ON t.id = ie.tag_id
     WHERE ${durationConditions.join(' AND ')}`,
    durationParams,
  );

  const frequencyParams = [workspaceId];
  const frequencyConditions = ['f.workspace_id = $1'];
  if (campaignId) {
    frequencyParams.push(campaignId);
    frequencyConditions.push(`EXISTS (SELECT 1 FROM ad_tags t2 WHERE t2.id = f.tag_id AND t2.workspace_id = f.workspace_id AND t2.campaign_id = $${frequencyParams.length})`);
  }
  if (tagIds.length === 1) {
    frequencyParams.push(tagIds[0]);
    frequencyConditions.push(`f.tag_id = $${frequencyParams.length}`);
  } else if (tagIds.length > 1) {
    frequencyParams.push(tagIds);
    frequencyConditions.push(`f.tag_id = ANY($${frequencyParams.length}::text[])`);
  }
  addEventDateFilters(frequencyParams, frequencyConditions, 'f', dateFrom, dateTo);
  const frequencyQuery = pool.query(
    `SELECT
       COALESCE(COUNT(*), 0)::bigint AS unique_identities,
       COALESCE(AVG(freq.device_impressions), 0)::numeric AS avg_frequency
     FROM (
       SELECT f.device_id, SUM(f.impressions)::numeric AS device_impressions
       FROM tag_frequency_cap_events f
       WHERE ${frequencyConditions.join(' AND ')}
       GROUP BY f.device_id
     ) freq`,
    frequencyParams,
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

  const [summaryRes, engagementRes, durationRes, frequencyRes, activeCampaignsRes, activeTagsRes] = await Promise.all([
    summaryQuery,
    engagementQuery,
    durationQuery,
    frequencyQuery,
    activeCampaignsQuery,
    activeTagsQuery,
  ]);

  const summary = summaryRes.rows[0] ?? {};
  const engagement = engagementRes.rows[0] ?? {};
  const duration = durationRes.rows[0] ?? {};
  const frequency = frequencyRes.rows[0] ?? {};
  const activeCampaigns = activeCampaignsRes.rows[0] ?? {};
  const activeTags = activeTagsRes.rows[0] ?? {};
  const totalImpressions = Number(summary.total_impressions ?? 0);
  const videoStarts = Number(engagement.video_starts ?? 0);
  const videoCompletions = Number(engagement.video_completions ?? 0);
  const viewableCount = Math.min(Number(engagement.viewable_count ?? 0), totalImpressions);
  const uniqueIdentityCount = Math.max(
    Number(frequency.unique_identities ?? 0),
    Number(duration.unique_device_ids ?? 0),
  );
  const avgIdentityFrequency = Number(frequency.avg_frequency ?? 0) > 0
    ? Number(frequency.avg_frequency ?? 0)
    : uniqueIdentityCount > 0
      ? Number((totalImpressions / uniqueIdentityCount).toFixed(4))
      : 0;

  return {
    total_impressions: totalImpressions,
    total_clicks: Number(summary.total_clicks ?? 0),
    total_spend: Number(summary.total_spend ?? 0),
    total_viewable_impressions: viewableCount,
    total_measured_impressions: totalImpressions,
    total_undetermined_impressions: 0,
    measurable_rate: Number(summary.measurable_rate ?? 0),
    viewability_rate: totalImpressions > 0 ? Number(((viewableCount / totalImpressions) * 100).toFixed(4)) : 0,
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
    total_in_view_duration_ms: Number(engagement.total_in_view_duration_ms ?? 0),
    total_identities: uniqueIdentityCount,
    avg_identity_frequency: avgIdentityFrequency,
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
    conditions.push(`EXISTS (SELECT 1 FROM ad_tags t3 WHERE t3.campaign_id = c.id AND t3.workspace_id = c.workspace_id AND t3.id = ANY($${params.length}::text[]))`);
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
       0::bigint AS clicks,
       COALESCE(SUM(CASE WHEN COALESCE(ie.viewable, false) THEN 1 ELSE 0 END), 0)::bigint AS viewable_imps,
       COALESCE(SUM(CASE WHEN ie.viewable IS NOT NULL THEN 1 ELSE 0 END), 0)::bigint AS measured_imps,
       COALESCE(SUM(CASE WHEN ie.viewable IS NULL THEN 1 ELSE 0 END), 0)::bigint AS undetermined_imps,
       0::bigint AS unique_identities,
       0::numeric AS avg_frequency,
       0::numeric AS ctr,
       CASE WHEN COALESCE(SUM(CASE WHEN ie.viewable IS NOT NULL THEN 1 ELSE 0 END), 0) > 0
         THEN ROUND(COALESCE(SUM(CASE WHEN COALESCE(ie.viewable, false) THEN 1 ELSE 0 END), 0)::NUMERIC / SUM(CASE WHEN ie.viewable IS NOT NULL THEN 1 ELSE 0 END) * 100, 4)
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
       ie.referer AS page_url,
       ie.country,
       ie.region,
       ie.city,
       ie.device_type,
       ie.device_model,
       ie.browser,
       ie.os,
       ie.app_bundle,
       ie.app_name,
       ie.app_id,
       ie.site_id,
       ie.source_publisher_id,
       ie.exchange_id,
       ie.exchange_publisher_id,
       ie.exchange_site_id_or_domain,
       ie.contextual_ids,
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

  const deviceTypeParams = [...latestParams];
  const deviceTypeQuery = pool.query(
    `SELECT COALESCE(NULLIF(ie.device_type, ''), 'Unknown') AS label,
            COUNT(*)::bigint AS value
     FROM impression_events ie
     JOIN ad_tags t ON t.id = ie.tag_id
     WHERE ${latestConditions.join(' AND ')}
     GROUP BY 1
     ORDER BY value DESC, label ASC
     LIMIT 10`,
    deviceTypeParams,
  );

  const deviceModelParams = [...latestParams];
  const deviceModelQuery = pool.query(
    `SELECT COALESCE(NULLIF(ie.device_model, ''), 'Unknown') AS label,
            COUNT(*)::bigint AS value
     FROM impression_events ie
     JOIN ad_tags t ON t.id = ie.tag_id
     WHERE ${latestConditions.join(' AND ')}
     GROUP BY 1
     ORDER BY value DESC, label ASC
     LIMIT 10`,
    deviceModelParams,
  );

  const inventoryParams = [...latestParams];
  const inventoryQuery = pool.query(
    `SELECT
       CASE
         WHEN COALESCE(ie.app_id, '') <> '' OR COALESCE(ie.app_bundle, '') <> '' OR COALESCE(ie.app_name, '') <> '' THEN
           CASE WHEN COALESCE(ie.device_type, '') = 'tv' THEN 'ctv_app' ELSE 'app' END
         WHEN COALESCE(ie.device_type, '') = 'tv' THEN 'ctv'
         WHEN COALESCE(ie.site_domain, '') <> '' OR COALESCE(ie.referer, '') <> '' THEN 'web'
         ELSE 'unknown'
       END AS label,
       COUNT(*)::bigint AS value
     FROM impression_events ie
     JOIN ad_tags t ON t.id = ie.tag_id
     WHERE ${latestConditions.join(' AND ')}
     GROUP BY 1
     ORDER BY value DESC, label ASC`,
    inventoryParams,
  );

  const [latestResult, deviceTypeResult, deviceModelResult, inventoryResult] = await Promise.all([
    latestQuery,
    deviceTypeQuery,
    deviceModelQuery,
    inventoryQuery,
  ]);

  return {
    latest_context: latestResult.rows[0] ?? null,
    device_types: deviceTypeResult.rows,
    device_models: deviceModelResult.rows,
    inventory_environments: inventoryResult.rows,
  };
}

export async function getWorkspaceContextBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, tagId = '', campaignId = '' } = opts;
  const params = [workspaceId];
  const conditions = ['ie.workspace_id = $1'];
  if (tagId) {
    params.push(tagId);
    conditions.push(`ie.tag_id = $${params.length}`);
  }
  if (campaignId) {
    params.push(campaignId);
    conditions.push(`t.campaign_id = $${params.length}`);
  }
  addTimestampFilters(params, conditions, 'ie', dateFrom, dateTo);

  const { rows } = await pool.query(
    `SELECT
       COALESCE(ie.inferred_context, 'unknown') AS context_type,
       COUNT(*)::bigint AS impressions,
       COUNT(DISTINCT ie.device_id)::bigint AS unique_devices,
       ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 2) AS share_pct
     FROM impression_events ie
     JOIN ad_tags t ON t.id = ie.tag_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY 1
     ORDER BY impressions DESC`,
    params,
  );
  return rows;
}

export async function getWorkspaceIdentityBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, limit = 25, campaignId = '', tagIds: rawTagIds = [], tagId = '', minImpressions = 1, minClicks = 0, canonicalType = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const impressionConditions = ['ie.workspace_id = $1'];
  addImpressionScopeFilters(params, impressionConditions, 't', 'ie', campaignId, tagIds);
  addTimestampFilters(params, impressionConditions, 'ie', dateFrom, dateTo);
  addIdentityBreakdownFilters(params, impressionConditions, 'ie', opts);

  const clickConditions = ['ce.workspace_id = $1'];
  addImpressionScopeFilters(params, clickConditions, 't_click', 'ce', campaignId, tagIds);
  addTimestampFilters(params, clickConditions, 'ce', dateFrom, dateTo);
  addIdentityBreakdownFilters(params, clickConditions, 'ce', opts);

  const minimumImpressions = Math.max(normalizeNonNegativeInt(minImpressions), 1);
  const minimumClicks = normalizeNonNegativeInt(minClicks);
  params.push(minimumImpressions);
  const havingClauses = [`COALESCE(i.impressions, 0) >= $${params.length}`];
  if (minimumClicks > 0) {
    params.push(minimumClicks);
    havingClauses.push(`COALESCE(c.clicks, 0) >= $${params.length}`);
  }
  params.push(normalizeLimit(limit, 25, 250));

  const { rows } = await pool.query(
    `WITH impressions AS (
       SELECT
         ${resolvedIdentityExpression('ie', 'e')} AS identity_key,
         COUNT(*)::bigint AS impressions,
         (ARRAY_AGG(NULLIF(ie.city, '') ORDER BY ie.timestamp DESC) FILTER (WHERE COALESCE(ie.city, '') <> ''))[1] AS last_city,
         (ARRAY_AGG(NULLIF(ie.region, '') ORDER BY ie.timestamp DESC) FILTER (WHERE COALESCE(ie.region, '') <> ''))[1] AS last_region,
         (ARRAY_AGG(NULLIF(ie.country, '') ORDER BY ie.timestamp DESC) FILTER (WHERE COALESCE(ie.country, '') <> ''))[1] AS last_country
       FROM impression_events ie
       JOIN ad_tags t ON t.id = ie.tag_id
       LEFT JOIN identity_edges e
         ON e.workspace_id = ie.workspace_id
        AND e.aliased_id = ie.device_id
       WHERE ${impressionConditions.join(' AND ')}
       GROUP BY 1
     ),
     clicks AS (
       SELECT ${resolvedIdentityExpression('ce', 'e_click')} AS identity_key, COUNT(*)::bigint AS clicks
       FROM click_events ce
       JOIN ad_tags t_click ON t_click.id = ce.tag_id
       LEFT JOIN identity_edges e_click
         ON e_click.workspace_id = ce.workspace_id
        AND e_click.aliased_id = ce.device_id
       WHERE ${clickConditions.join(' AND ')}
       GROUP BY 1
     ),
     identities AS (
       SELECT identity_key FROM impressions
       UNION
       SELECT identity_key FROM clicks
     )
     SELECT
       ids.identity_key AS canonical_value,
       ${canonicalType === 'cookie_id' ? "'cookie_id'" : "'device_id'"} AS canonical_type,
       COALESCE(i.impressions, 0)::bigint AS impressions,
       COALESCE(c.clicks, 0)::bigint AS clicks,
       CASE WHEN COALESCE(i.impressions, 0) > 0
         THEN ROUND(COALESCE(c.clicks, 0)::numeric / i.impressions * 100, 4)
         ELSE 0 END AS ctr,
       i.last_city,
       i.last_region,
       i.last_country
     FROM identities ids
     LEFT JOIN impressions i ON i.identity_key = ids.identity_key
     LEFT JOIN clicks c ON c.identity_key = ids.identity_key
     WHERE ${havingClauses.join(' AND ')}
     ORDER BY impressions DESC, clicks DESC, canonical_value ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function getWorkspaceIdentityFrequencyBuckets(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, campaignId = '', tagIds: rawTagIds = [], tagId = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const impressionConditions = ['ie.workspace_id = $1'];
  addImpressionScopeFilters(params, impressionConditions, 't', 'ie', campaignId, tagIds);
  addTimestampFilters(params, impressionConditions, 'ie', dateFrom, dateTo);
  addIdentityBreakdownFilters(params, impressionConditions, 'ie', opts);

  const clickConditions = ['ce.workspace_id = $1'];
  addImpressionScopeFilters(params, clickConditions, 't_click', 'ce', campaignId, tagIds);
  addTimestampFilters(params, clickConditions, 'ce', dateFrom, dateTo);
  addIdentityBreakdownFilters(params, clickConditions, 'ce', opts);

  const { rows } = await pool.query(
    `WITH impressions AS (
       SELECT ${resolvedIdentityExpression('ie', 'e')} AS identity_key, COUNT(*)::bigint AS impressions
       FROM impression_events ie
       JOIN ad_tags t ON t.id = ie.tag_id
       LEFT JOIN identity_edges e
         ON e.workspace_id = ie.workspace_id
        AND e.aliased_id = ie.device_id
       WHERE ${impressionConditions.join(' AND ')}
       GROUP BY 1
     ),
     clicks AS (
       SELECT ${resolvedIdentityExpression('ce', 'e_click')} AS identity_key, COUNT(*)::bigint AS clicks
       FROM click_events ce
       JOIN ad_tags t_click ON t_click.id = ce.tag_id
       LEFT JOIN identity_edges e_click
         ON e_click.workspace_id = ce.workspace_id
        AND e_click.aliased_id = ce.device_id
       WHERE ${clickConditions.join(' AND ')}
       GROUP BY 1
     ),
     per_identity AS (
       SELECT
         i.identity_key,
         i.impressions,
         COALESCE(c.clicks, 0)::bigint AS clicks
       FROM impressions i
       LEFT JOIN clicks c ON c.identity_key = i.identity_key
     )
     SELECT
       CASE
         WHEN impressions = 1 THEN '1 impression'
         WHEN impressions BETWEEN 2 AND 3 THEN '2-3 impressions'
         WHEN impressions BETWEEN 4 AND 5 THEN '4-5 impressions'
         WHEN impressions BETWEEN 6 AND 10 THEN '6-10 impressions'
         WHEN impressions BETWEEN 11 AND 20 THEN '11-20 impressions'
         ELSE '21+ impressions'
       END AS bucket_label,
       COUNT(*)::bigint AS identity_count,
       SUM(impressions)::bigint AS impressions,
       SUM(clicks)::bigint AS clicks,
       CASE WHEN SUM(impressions) > 0
         THEN ROUND(SUM(clicks)::numeric / SUM(impressions) * 100, 4)
         ELSE 0 END AS ctr
     FROM per_identity
     GROUP BY 1
     ORDER BY MIN(impressions) ASC`,
    params,
  );
  return rows;
}

export async function getWorkspaceIdentitySegmentPresets(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, campaignId = '', tagIds: rawTagIds = [], tagId = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const impressionConditions = ['ie.workspace_id = $1'];
  addImpressionScopeFilters(params, impressionConditions, 't', 'ie', campaignId, tagIds);
  addTimestampFilters(params, impressionConditions, 'ie', dateFrom, dateTo);
  addIdentityBreakdownFilters(params, impressionConditions, 'ie', opts);

  const clickConditions = ['ce.workspace_id = $1'];
  addImpressionScopeFilters(params, clickConditions, 't_click', 'ce', campaignId, tagIds);
  addTimestampFilters(params, clickConditions, 'ce', dateFrom, dateTo);
  addIdentityBreakdownFilters(params, clickConditions, 'ce', opts);

  const { rows } = await pool.query(
    `WITH per_identity AS (
       SELECT
         ${resolvedIdentityExpression('ie', 'e')} AS identity_key,
         COUNT(*)::bigint AS impressions,
         COALESCE(c.clicks, 0)::bigint AS clicks
       FROM impression_events ie
       JOIN ad_tags t ON t.id = ie.tag_id
       LEFT JOIN identity_edges e
         ON e.workspace_id = ie.workspace_id
        AND e.aliased_id = ie.device_id
       LEFT JOIN (
         SELECT ${resolvedIdentityExpression('ce', 'e_click')} AS identity_key, COUNT(*)::bigint AS clicks
         FROM click_events ce
         JOIN ad_tags t_click ON t_click.id = ce.tag_id
         LEFT JOIN identity_edges e_click
           ON e_click.workspace_id = ce.workspace_id
          AND e_click.aliased_id = ce.device_id
         WHERE ${clickConditions.join(' AND ')}
         GROUP BY 1
       ) c ON c.identity_key = ${resolvedIdentityExpression('ie', 'e')}
       WHERE ${impressionConditions.join(' AND ')}
       GROUP BY 1
              , c.clicks
     ),
     summary AS (
       SELECT
         COUNT(*) FILTER (WHERE impressions >= 5)::bigint AS high_frequency_identity_count,
         COALESCE(SUM(impressions) FILTER (WHERE impressions >= 5), 0)::bigint AS high_frequency_impressions,
         COALESCE(SUM(clicks) FILTER (WHERE impressions >= 5), 0)::bigint AS high_frequency_clicks,
         COUNT(*) FILTER (WHERE clicks > 0)::bigint AS clicked_identity_count,
         COALESCE(SUM(impressions) FILTER (WHERE clicks > 0), 0)::bigint AS clicked_impressions,
         COALESCE(SUM(clicks) FILTER (WHERE clicks > 0), 0)::bigint AS clicked_clicks
       FROM per_identity
     )
     SELECT *
     FROM (
       SELECT
         'high_frequency_exposed' AS preset,
         'High-frequency exposed' AS label,
         high_frequency_identity_count AS identity_count,
         high_frequency_impressions AS impressions,
         high_frequency_clicks AS clicks,
         0::bigint AS engagements
       FROM summary
       UNION ALL
       SELECT
         'clicked_users' AS preset,
         'Clicked users' AS label,
         clicked_identity_count AS identity_count,
         clicked_impressions AS impressions,
         clicked_clicks AS clicks,
         0::bigint AS engagements
       FROM summary
       UNION ALL
       SELECT
         'engaged_non_clickers' AS preset,
         'Engaged non-clickers' AS label,
         0::bigint AS identity_count,
         0::bigint AS impressions,
         0::bigint AS clicks,
         0::bigint AS engagements
       FROM summary
     ) presets
     ORDER BY label ASC`,
    params,
  );
  return rows;
}

export async function getWorkspaceIdentityKeyBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, limit = 25, campaignId = '', tagIds: rawTagIds = [], tagId = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const conditions = ['ie.workspace_id = $1'];
  addImpressionScopeFilters(params, conditions, 't', 'ie', campaignId, tagIds);
  addTimestampFilters(params, conditions, 'ie', dateFrom, dateTo);
  addIdentityBreakdownFilters(params, conditions, 'ie', opts);
  params.push(normalizeLimit(limit, 25, 100));
  const sharedWhere = conditions.join(' AND ');

  const { rows } = await pool.query(
    `SELECT *
     FROM (
       SELECT 'device_id' AS key_type, 'impression' AS event_type, COUNT(*)::bigint AS key_observations, COUNT(DISTINCT ie.device_id)::bigint AS unique_values, COUNT(DISTINCT ie.device_id)::bigint AS identity_count
       FROM impression_events ie JOIN ad_tags t ON t.id = ie.tag_id
       WHERE ${sharedWhere}
       UNION ALL
       SELECT 'device_type', 'impression', COUNT(*)::bigint, COUNT(DISTINCT ie.device_type)::bigint, COUNT(DISTINCT ie.device_id)::bigint
       FROM impression_events ie JOIN ad_tags t ON t.id = ie.tag_id
       WHERE ${sharedWhere} AND COALESCE(ie.device_type, '') <> ''
       UNION ALL
       SELECT 'device_model', 'impression', COUNT(*)::bigint, COUNT(DISTINCT ie.device_model)::bigint, COUNT(DISTINCT ie.device_id)::bigint
       FROM impression_events ie JOIN ad_tags t ON t.id = ie.tag_id
       WHERE ${sharedWhere} AND COALESCE(ie.device_model, '') <> ''
       UNION ALL
       SELECT 'browser', 'impression', COUNT(*)::bigint, COUNT(DISTINCT ie.browser)::bigint, COUNT(DISTINCT ie.device_id)::bigint
       FROM impression_events ie JOIN ad_tags t ON t.id = ie.tag_id
       WHERE ${sharedWhere} AND COALESCE(ie.browser, '') <> ''
       UNION ALL
       SELECT 'os', 'impression', COUNT(*)::bigint, COUNT(DISTINCT ie.os)::bigint, COUNT(DISTINCT ie.device_id)::bigint
       FROM impression_events ie JOIN ad_tags t ON t.id = ie.tag_id
       WHERE ${sharedWhere} AND COALESCE(ie.os, '') <> ''
       UNION ALL
       SELECT 'site_domain', 'impression', COUNT(*)::bigint, COUNT(DISTINCT ie.site_domain)::bigint, COUNT(DISTINCT ie.device_id)::bigint
       FROM impression_events ie JOIN ad_tags t ON t.id = ie.tag_id
       WHERE ${sharedWhere} AND COALESCE(ie.site_domain, '') <> ''
       UNION ALL
       SELECT 'app_id', 'impression', COUNT(*)::bigint, COUNT(DISTINCT ie.app_id)::bigint, COUNT(DISTINCT ie.device_id)::bigint
       FROM impression_events ie JOIN ad_tags t ON t.id = ie.tag_id
       WHERE ${sharedWhere} AND COALESCE(ie.app_id, '') <> ''
       UNION ALL
       SELECT 'app_bundle', 'impression', COUNT(*)::bigint, COUNT(DISTINCT ie.app_bundle)::bigint, COUNT(DISTINCT ie.device_id)::bigint
       FROM impression_events ie JOIN ad_tags t ON t.id = ie.tag_id
       WHERE ${sharedWhere} AND COALESCE(ie.app_bundle, '') <> ''
       UNION ALL
       SELECT 'exchange_id', 'impression', COUNT(*)::bigint, COUNT(DISTINCT ie.exchange_id)::bigint, COUNT(DISTINCT ie.device_id)::bigint
       FROM impression_events ie JOIN ad_tags t ON t.id = ie.tag_id
       WHERE ${sharedWhere} AND COALESCE(ie.exchange_id, '') <> ''
       UNION ALL
       SELECT 'network_id', 'impression', COUNT(*)::bigint, COUNT(DISTINCT ie.network_id)::bigint, COUNT(DISTINCT ie.device_id)::bigint
       FROM impression_events ie JOIN ad_tags t ON t.id = ie.tag_id
       WHERE ${sharedWhere} AND COALESCE(ie.network_id, '') <> ''
       UNION ALL
       SELECT 'carrier', 'impression', COUNT(*)::bigint, COUNT(DISTINCT ie.carrier)::bigint, COUNT(DISTINCT ie.device_id)::bigint
       FROM impression_events ie JOIN ad_tags t ON t.id = ie.tag_id
       WHERE ${sharedWhere} AND COALESCE(ie.carrier, '') <> ''
       UNION ALL
       SELECT 'contextual_ids', 'impression', COUNT(*)::bigint, COUNT(DISTINCT ie.contextual_ids)::bigint, COUNT(DISTINCT ie.device_id)::bigint
       FROM impression_events ie JOIN ad_tags t ON t.id = ie.tag_id
       WHERE ${sharedWhere} AND COALESCE(ie.contextual_ids, '') <> ''
     ) keyed
     WHERE key_observations > 0
     ORDER BY key_observations DESC, key_type ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function getWorkspaceIdentityAttributionWindows(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, campaignId = '', tagIds: rawTagIds = [], tagId = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const impressionConditions = ['ie.workspace_id = $1'];
  addImpressionScopeFilters(params, impressionConditions, 't', 'ie', campaignId, tagIds);
  addTimestampFilters(params, impressionConditions, 'ie', dateFrom, dateTo);
  addIdentityBreakdownFilters(params, impressionConditions, 'ie', opts);

  const clickConditions = ['ce.workspace_id = $1'];
  addImpressionScopeFilters(params, clickConditions, 't_click', 'ce', campaignId, tagIds);
  addTimestampFilters(params, clickConditions, 'ce', dateFrom, dateTo);
  addIdentityBreakdownFilters(params, clickConditions, 'ce', opts);

  const { rows } = await pool.query(
    `WITH latest_seen AS (
       SELECT ${resolvedIdentityExpression('ie', 'e')} AS identity_key, MAX(ie.timestamp) AS last_seen_at
       FROM impression_events ie
       JOIN ad_tags t ON t.id = ie.tag_id
       LEFT JOIN identity_edges e
         ON e.workspace_id = ie.workspace_id
        AND e.aliased_id = ie.device_id
       WHERE ${impressionConditions.join(' AND ')}
       GROUP BY 1
     ),
     clickers AS (
       SELECT DISTINCT ${resolvedIdentityExpression('ce', 'e_click')} AS identity_key
       FROM click_events ce
       JOIN ad_tags t_click ON t_click.id = ce.tag_id
       LEFT JOIN identity_edges e_click
         ON e_click.workspace_id = ce.workspace_id
        AND e_click.aliased_id = ce.device_id
       WHERE ${clickConditions.join(' AND ')}
     )
     SELECT *
     FROM (
       SELECT
         CASE
           WHEN last_seen_at >= NOW() - INTERVAL '1 day' THEN '0-1 days'
           WHEN last_seen_at >= NOW() - INTERVAL '7 days' THEN '2-7 days'
           WHEN last_seen_at >= NOW() - INTERVAL '30 days' THEN '8-30 days'
           ELSE '31+ days'
         END AS label,
         COUNT(*)::bigint AS exposed_identities,
         COUNT(*) FILTER (WHERE c.identity_key IS NOT NULL)::bigint AS clicked_identities,
         0::bigint AS engaged_identities,
         CASE WHEN COUNT(*) > 0
           THEN ROUND((COUNT(*) FILTER (WHERE c.identity_key IS NOT NULL))::numeric / COUNT(*) * 100, 4)
           ELSE 0 END AS click_through_rate,
         0::numeric AS engagement_through_rate
       FROM latest_seen ls
       LEFT JOIN clickers c ON c.identity_key = ls.identity_key
       GROUP BY 1
     ) buckets
     ORDER BY
       CASE buckets.label
         WHEN '0-1 days' THEN 1
         WHEN '2-7 days' THEN 2
         WHEN '8-30 days' THEN 3
         ELSE 4
       END`,
    params,
  );
  return rows;
}

export async function listSavedAudiences(pool, workspaceId) {
  const { rows } = await pool.query(
    `SELECT *
     FROM saved_audiences
     WHERE workspace_id = $1
     ORDER BY created_at DESC`,
    [workspaceId],
  );
  return rows;
}

export async function createSavedAudience(pool, workspaceId, createdBy, payload = {}) {
  const { rows } = await pool.query(
    `INSERT INTO saved_audiences (
       workspace_id,
       created_by,
       name,
       canonical_type,
       country,
       site_domain,
       region,
       city,
       segment_preset,
       activation_template,
       campaign_id,
       tag_id,
       creative_id,
       creative_size_variant_id,
       min_impressions,
       min_clicks
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
     )
     RETURNING *`,
    [
      workspaceId,
      createdBy || null,
      String(payload.name || '').trim(),
      payload.canonicalType || null,
      payload.country || null,
      payload.siteDomain || null,
      payload.region || null,
      payload.city || null,
      payload.segmentPreset || null,
      payload.activationTemplate || 'full',
      payload.campaignId || null,
      payload.tagId || null,
      payload.creativeId || null,
      payload.variantId || null,
      normalizeNonNegativeInt(payload.minImpressions),
      normalizeNonNegativeInt(payload.minClicks),
    ],
  );
  return rows[0] ?? null;
}

export async function deleteSavedAudience(pool, workspaceId, id) {
  const { rowCount } = await pool.query(
    `DELETE FROM saved_audiences
     WHERE workspace_id = $1
       AND id = $2`,
    [workspaceId, id],
  );
  return rowCount > 0;
}
