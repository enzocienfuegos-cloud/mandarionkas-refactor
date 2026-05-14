import { parseBrowserFromUA, parseDeviceTypeFromUA, parseOsFromUA } from './ua-parser.mjs';
import { deriveSpendMetrics, normalizeCostMetadata } from './costing.mjs';

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

function addTimestampFilters(params, conditions, alias, dateFrom, dateTo, timezone = 'America/El_Salvador') {
  const normalizedTimezone = normalizeReportingTimezone(timezone);
  const needsTimezone = Boolean(dateFrom || dateTo);
  let timezoneRef = null;
  if (needsTimezone) {
    params.push(normalizedTimezone);
    timezoneRef = `$${params.length}`;
  }
  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`(${alias}.timestamp AT TIME ZONE ${timezoneRef})::date >= $${params.length}::date`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`(${alias}.timestamp AT TIME ZONE ${timezoneRef})::date <= $${params.length}::date`);
  }
}

function addZonedTimestampDateFilters(params, conditions, alias, dateFrom, dateTo, timezoneRef) {
  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`(${alias}.timestamp AT TIME ZONE ${timezoneRef})::date >= $${params.length}::date`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`(${alias}.timestamp AT TIME ZONE ${timezoneRef})::date <= $${params.length}::date`);
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

function addTagScopeFilters(params, conditions, alias, campaignId, tagIds, advertiserId = '') {
  if (campaignId) {
    params.push(campaignId);
    conditions.push(`${alias}.campaign_id = $${params.length}`);
  }
  if (advertiserId) {
    params.push(advertiserId);
    conditions.push(
      `EXISTS (
         SELECT 1
         FROM campaigns c_scope
         WHERE c_scope.id = ${alias}.campaign_id
           AND c_scope.workspace_id = ${alias}.workspace_id
           AND c_scope.advertiser_id = $${params.length}
       )`,
    );
  }
  if (tagIds.length === 1) {
    params.push(tagIds[0]);
    conditions.push(`${alias}.id = $${params.length}`);
  } else if (tagIds.length > 1) {
    params.push(tagIds);
    conditions.push(`${alias}.id = ANY($${params.length}::text[])`);
  }
}

function addImpressionScopeFilters(params, conditions, tagAlias, eventAlias, campaignId, tagIds, advertiserId = '') {
  conditions.push(`${tagAlias}.workspace_id = ${eventAlias}.workspace_id`);
  conditions.push(`${tagAlias}.id = ${eventAlias}.tag_id`);
  if (campaignId) {
    params.push(campaignId);
    conditions.push(`${tagAlias}.campaign_id = $${params.length}`);
  }
  if (advertiserId) {
    params.push(advertiserId);
    conditions.push(
      `EXISTS (
         SELECT 1
         FROM campaigns c_scope
         WHERE c_scope.id = ${tagAlias}.campaign_id
           AND c_scope.workspace_id = ${tagAlias}.workspace_id
           AND c_scope.advertiser_id = $${params.length}
       )`,
    );
  }
  if (tagIds.length === 1) {
    params.push(tagIds[0]);
    conditions.push(`${tagAlias}.id = $${params.length}`);
  } else if (tagIds.length > 1) {
    params.push(tagIds);
    conditions.push(`${tagAlias}.id = ANY($${params.length}::text[])`);
  }
}

function normalizeReportingChannel(channel) {
  const normalized = String(channel ?? '').trim().toLowerCase();
  if (normalized === 'display' || normalized === 'video') return normalized;
  return '';
}

function normalizeReportingTimeGranularity(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'hour' ? 'hour' : 'day';
}

function normalizeReportingTimezone(value) {
  const normalized = String(value ?? '').trim();
  const allowed = new Set([
    'America/El_Salvador',
    'America/Guatemala',
    'America/Tegucigalpa',
    'America/Managua',
    'America/Costa_Rica',
    'America/Mexico_City',
    'America/Bogota',
    'America/Lima',
    'America/New_York',
    'America/Chicago',
    'America/Los_Angeles',
    'UTC',
    'Europe/Madrid',
  ]);
  return allowed.has(normalized) ? normalized : 'America/El_Salvador';
}

function tagChannelPredicate(tagAlias, channel) {
  const normalized = normalizeReportingChannel(channel);
  if (normalized === 'video') return `${tagAlias}.format = 'VAST'`;
  if (normalized === 'display') return `${tagAlias}.format = 'display'`;
  return '';
}

function addTagChannelFilter(conditions, tagAlias, channel) {
  const predicate = tagChannelPredicate(tagAlias, channel);
  if (predicate) conditions.push(predicate);
}

function addEventTagChannelFilter(conditions, eventAlias, channel) {
  const predicate = tagChannelPredicate('t_channel', channel);
  if (!predicate) return;
  conditions.push(
    `EXISTS (
       SELECT 1
       FROM ad_tags t_channel
       WHERE t_channel.id = ${eventAlias}.tag_id
         AND t_channel.workspace_id = ${eventAlias}.workspace_id
         AND ${predicate}
     )`,
  );
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

function withSpendMetrics(row, {
  metadataField = 'campaign_metadata',
  impressionsField = 'impressions',
  recordedSpendField = 'spend',
  budgetField = 'budget',
  impressionGoalField = 'impression_goal',
} = {}) {
  const metadata = normalizeCostMetadata(row?.[metadataField]);
  const spendMetrics = deriveSpendMetrics({
    impressions: row?.[impressionsField],
    recordedSpend: row?.[recordedSpendField],
    metadata,
    fallbackBudget: row?.[budgetField],
    impressionGoal: row?.[impressionGoalField],
  });

  return {
    ...row,
    campaign_metadata: metadata,
    media_spend: spendMetrics.mediaSpend,
    serving_fee_spend: spendMetrics.servingFeeSpend,
    margin_spend: spendMetrics.marginSpend,
    spend_without_margin: spendMetrics.spendWithoutMargin,
    spend_with_margin: spendMetrics.spendWithMargin,
    spend: spendMetrics.spendWithoutMargin,
  };
}

function toFiniteNumber(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundMetric(value, digits = 4) {
  return Number(toFiniteNumber(value).toFixed(digits));
}

function mapCreativeReportingStatus(status) {
  if (status === 'approved' || status === 'active') return 'active';
  if (status === 'rejected' || status === 'archived') return 'archived';
  if (status === 'paused') return 'paused';
  if (status === 'pending_review') return 'limited';
  return 'draft';
}

function collapseAllocatedCreativeRows(rows = [], { limit = 25, variantMode = false } = {}) {
  const byId = new Map();

  for (const rawRow of rows.map((row) => withSpendMetrics(row))) {
    const entityId = variantMode
      ? (String(rawRow.variant_entity_id || '').trim() || String(rawRow.id || '').trim())
      : String(rawRow.id || '').trim();
    if (!entityId) continue;

    const current = byId.get(entityId) ?? {
      id: entityId,
      name: variantMode
        ? [rawRow.name, rawRow.variant_label].filter(Boolean).join(' · ')
        : rawRow.name,
      status: mapCreativeReportingStatus(rawRow.approval_status),
      approval_status: rawRow.approval_status || 'draft',
      creative_type: rawRow.creative_type || null,
      source_kind: rawRow.source_kind || null,
      serving_format: rawRow.serving_format || null,
      variant_id: rawRow.variant_id || null,
      variant_label: rawRow.variant_label || null,
      allocation_model: 'binding_weight',
      has_exact_attribution: false,
      impressions: 0,
      clicks: 0,
      viewable_imps: 0,
      measured_imps: 0,
      undetermined_imps: 0,
      media_spend: 0,
      serving_fee_spend: 0,
      margin_spend: 0,
      spend_without_margin: 0,
      spend_with_margin: 0,
    };

    current.impressions += toFiniteNumber(rawRow.impressions);
    current.clicks += toFiniteNumber(rawRow.clicks);
    current.viewable_imps += toFiniteNumber(rawRow.viewable_imps);
    current.measured_imps += toFiniteNumber(rawRow.measured_imps);
    current.undetermined_imps += toFiniteNumber(rawRow.undetermined_imps);
    current.media_spend += toFiniteNumber(rawRow.media_spend);
    current.serving_fee_spend += toFiniteNumber(rawRow.serving_fee_spend);
    current.margin_spend += toFiniteNumber(rawRow.margin_spend);
    current.spend_without_margin += toFiniteNumber(rawRow.spend_without_margin);
    current.spend_with_margin += toFiniteNumber(rawRow.spend_with_margin);
    current.has_exact_attribution = current.has_exact_attribution || Boolean(Number(rawRow.has_exact_attribution || 0));
    current.allocation_model = current.has_exact_attribution ? 'event_hybrid' : 'binding_weight';
    byId.set(entityId, current);
  }

  return Array.from(byId.values())
    .map((row) => {
      const impressions = roundMetric(row.impressions, 2);
      const clicks = roundMetric(row.clicks, 2);
      const measured = roundMetric(row.measured_imps, 2);
      const viewable = roundMetric(row.viewable_imps, 2);
      return {
        ...row,
        impressions,
        clicks,
        viewable_imps: viewable,
        measured_imps: measured,
        undetermined_imps: roundMetric(row.undetermined_imps, 2),
        media_spend: roundMetric(row.media_spend),
        serving_fee_spend: roundMetric(row.serving_fee_spend),
        margin_spend: roundMetric(row.margin_spend),
        spend_without_margin: roundMetric(row.spend_without_margin),
        spend_with_margin: roundMetric(row.spend_with_margin),
        spend: roundMetric(row.spend_without_margin),
        ctr: impressions > 0 ? roundMetric((clicks / impressions) * 100) : 0,
        viewability_rate: measured > 0 ? roundMetric((viewable / measured) * 100) : 0,
      };
    })
    .sort((left, right) => toFiniteNumber(right.impressions) - toFiniteNumber(left.impressions) || String(left.name || '').localeCompare(String(right.name || '')))
    .slice(0, normalizeLimit(limit, 25, 200));
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
  addTimestampFilters(durationParams, durationConditions, 'ie', dateFrom, dateTo, opts.timezone);
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
  addTimestampFilters(identityParams, identityConditions, 'ie', dateFrom, dateTo, opts.timezone);
  const identityFallbackQuery = pool.query(
    `SELECT COALESCE(COUNT(DISTINCT ie.device_id), 0)::bigint AS unique_device_ids
     FROM impression_events ie
     WHERE ${identityConditions.join(' AND ')}`,
    identityParams,
  );

  const summaryResult = await summaryQuery;
  const engagementResult = await engagementQuery;
  const durationResult = await durationQuery;
  const last7dResult = await last7dQuery;
  const frequencyResult = await frequencyQuery;
  const identityFallbackResult = await identityFallbackQuery;

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
  const { dateFrom, dateTo, advertiserId = '', campaignId = '', tagIds: rawTagIds = [], tagId = '', channel = '' } = opts;
  const granularity = normalizeReportingTimeGranularity(opts.granularity);
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  if (granularity === 'hour') {
    const timezone = normalizeReportingTimezone(opts.timezone);
    const params = [workspaceId, timezone];
    const timezoneRef = '$2';
    const impressionConditions = ['ie.workspace_id = $1'];
    addImpressionScopeFilters(params, impressionConditions, 't', 'ie', campaignId, tagIds, advertiserId);
    addTagChannelFilter(impressionConditions, 't', channel);
    addZonedTimestampDateFilters(params, impressionConditions, 'ie', dateFrom, dateTo, timezoneRef);

    params.push(workspaceId);
    const clickWorkspaceRef = `$${params.length}`;
    const clickConditions = [`ce.workspace_id = ${clickWorkspaceRef}`];
    addImpressionScopeFilters(params, clickConditions, 't_click', 'ce', campaignId, tagIds, advertiserId);
    addTagChannelFilter(clickConditions, 't_click', channel);
    addZonedTimestampDateFilters(params, clickConditions, 'ce', dateFrom, dateTo, timezoneRef);

    const { rows } = await pool.query(
      `WITH impressions AS (
         SELECT
           date_trunc('hour', ie.timestamp AT TIME ZONE ${timezoneRef}) AS bucket,
           COUNT(*)::bigint AS impressions,
           COALESCE(SUM(CASE WHEN COALESCE(ie.viewable, false) THEN 1 ELSE 0 END), 0)::bigint AS viewable_imps,
           COALESCE(SUM(CASE WHEN ie.viewable IS NOT NULL THEN 1 ELSE 0 END), 0)::bigint AS measured_imps,
           COALESCE(SUM(CASE WHEN ie.viewable IS NULL THEN 1 ELSE 0 END), 0)::bigint AS undetermined_imps
         FROM impression_events ie
         JOIN ad_tags t ON t.id = ie.tag_id
         WHERE ${impressionConditions.join(' AND ')}
         GROUP BY 1
       ),
       clicks AS (
         SELECT
           date_trunc('hour', ce.timestamp AT TIME ZONE ${timezoneRef}) AS bucket,
           COUNT(*)::bigint AS clicks
         FROM click_events ce
         JOIN ad_tags t_click ON t_click.id = ce.tag_id
         WHERE ${clickConditions.join(' AND ')}
         GROUP BY 1
       )
       SELECT
         to_char(COALESCE(i.bucket, c.bucket), 'YYYY-MM-DD HH24:00') AS date,
         COALESCE(i.impressions, 0)::bigint AS impressions,
         COALESCE(c.clicks, 0)::bigint AS clicks,
         COALESCE(i.viewable_imps, 0)::bigint AS viewable_imps,
         COALESCE(i.measured_imps, 0)::bigint AS measured_imps,
         COALESCE(i.undetermined_imps, 0)::bigint AS undetermined_imps,
         CASE WHEN COALESCE(i.impressions, 0) > 0
           THEN ROUND(COALESCE(c.clicks, 0)::NUMERIC / i.impressions * 100, 4)
           ELSE 0 END AS ctr,
         CASE WHEN COALESCE(i.measured_imps, 0) > 0
           THEN ROUND(COALESCE(i.viewable_imps, 0)::NUMERIC / i.measured_imps * 100, 4)
           ELSE 0 END AS viewability_rate
       FROM impressions i
       FULL OUTER JOIN clicks c ON c.bucket = i.bucket
       ORDER BY COALESCE(i.bucket, c.bucket) ASC`,
      params,
    );
    return rows;
  }

  const params = [workspaceId];
  const conditions = ['t.workspace_id = $1'];
  addTagScopeFilters(params, conditions, 't', campaignId, tagIds, advertiserId);
  addTagChannelFilter(conditions, 't', channel);
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
  const { dateFrom, dateTo, advertiserId = '', campaignId = '', tagIds: rawTagIds = [], tagId = '', channel = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const summaryParams = [workspaceId];
  const summaryConditions = ['t.workspace_id = $1'];
  addTagScopeFilters(summaryParams, summaryConditions, 't', campaignId, tagIds, advertiserId);
  addTagChannelFilter(summaryConditions, 't', channel);
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
  addTagScopeFilters(engagementParams, engagementConditions, 't', campaignId, tagIds, advertiserId);
  addTagChannelFilter(engagementConditions, 't', channel);
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
  addImpressionScopeFilters(durationParams, durationConditions, 't', 'ie', campaignId, tagIds, advertiserId);
  addTagChannelFilter(durationConditions, 't', channel);
  addTimestampFilters(durationParams, durationConditions, 'ie', dateFrom, dateTo, opts.timezone);
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
  addEventTagChannelFilter(frequencyConditions, 'f', channel);
  if (advertiserId) {
    frequencyParams.push(advertiserId);
    frequencyConditions.push(`EXISTS (SELECT 1 FROM ad_tags t2 JOIN campaigns c2 ON c2.id = t2.campaign_id AND c2.workspace_id = t2.workspace_id WHERE t2.id = f.tag_id AND t2.workspace_id = f.workspace_id AND c2.advertiser_id = $${frequencyParams.length})`);
  }
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
  if (advertiserId) {
    activeCampaignParams.push(advertiserId);
    activeCampaignConditions.push(`advertiser_id = $${activeCampaignParams.length}`);
  }
  if (campaignId) {
    activeCampaignParams.push(campaignId);
    activeCampaignConditions.push(`id = $${activeCampaignParams.length}`);
  }
  const activeCampaignChannelPredicate = tagChannelPredicate('t_channel', channel);
  if (activeCampaignChannelPredicate) {
    activeCampaignConditions.push(
      `EXISTS (
         SELECT 1
         FROM ad_tags t_channel
         WHERE t_channel.campaign_id = campaigns.id
           AND t_channel.workspace_id = campaigns.workspace_id
           AND ${activeCampaignChannelPredicate}
       )`,
    );
  }
  const activeCampaignsQuery = pool.query(
    `SELECT COUNT(*)::int AS active_campaigns FROM campaigns WHERE ${activeCampaignConditions.join(' AND ')}`,
    activeCampaignParams,
  );

  const activeTagParams = [workspaceId];
  const activeTagConditions = ['workspace_id = $1', "status = 'active'"];
  addTagScopeFilters(activeTagParams, activeTagConditions, 'ad_tags', campaignId, tagIds, advertiserId);
  addTagChannelFilter(activeTagConditions, 'ad_tags', channel);
  const activeTagsQuery = pool.query(
    `SELECT COUNT(*)::int AS active_tags FROM ad_tags WHERE ${activeTagConditions.join(' AND ')}`,
    activeTagParams,
  );

  const summaryRes = await summaryQuery;
  const engagementRes = await engagementQuery;
  const durationRes = await durationQuery;
  const frequencyRes = await frequencyQuery;
  const activeCampaignsRes = await activeCampaignsQuery;
  const activeTagsRes = await activeTagsQuery;
  const spendBreakdown = await getWorkspaceCampaignBreakdown(pool, workspaceId, { ...opts, limit: 500 });

  const summary = summaryRes.rows[0] ?? {};
  const engagement = engagementRes.rows[0] ?? {};
  const duration = durationRes.rows[0] ?? {};
  const frequency = frequencyRes.rows[0] ?? {};
  const activeCampaigns = activeCampaignsRes.rows[0] ?? {};
  const activeTags = activeTagsRes.rows[0] ?? {};
  const spendTotals = spendBreakdown.reduce((accumulator, row) => ({
    mediaSpend: accumulator.mediaSpend + Number(row.media_spend ?? 0),
    servingFeeSpend: accumulator.servingFeeSpend + Number(row.serving_fee_spend ?? 0),
    marginSpend: accumulator.marginSpend + Number(row.margin_spend ?? 0),
    spendWithoutMargin: accumulator.spendWithoutMargin + Number(row.spend_without_margin ?? row.spend ?? 0),
    spendWithMargin: accumulator.spendWithMargin + Number(row.spend_with_margin ?? row.spend ?? 0),
  }), {
    mediaSpend: 0,
    servingFeeSpend: 0,
    marginSpend: 0,
    spendWithoutMargin: 0,
    spendWithMargin: 0,
  });
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
    total_spend: Number(spendTotals.spendWithoutMargin.toFixed(4)),
    total_media_spend: Number(spendTotals.mediaSpend.toFixed(4)),
    total_serving_fees: Number(spendTotals.servingFeeSpend.toFixed(4)),
    total_margin: Number(spendTotals.marginSpend.toFixed(4)),
    total_spend_without_margin: Number(spendTotals.spendWithoutMargin.toFixed(4)),
    total_spend_with_margin: Number(spendTotals.spendWithMargin.toFixed(4)),
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
  const { dateFrom, dateTo, limit = 25, advertiserId = '', campaignId = '', tagIds: rawTagIds = [], tagId = '', channel = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const conditions = ['c.workspace_id = $1'];
  if (advertiserId) {
    params.push(advertiserId);
    conditions.push(`c.advertiser_id = $${params.length}`);
  }
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
  addTagChannelFilter(conditions, 't', channel);
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
       c.budget,
       c.impression_goal,
       c.metadata AS campaign_metadata,
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
     GROUP BY c.id, c.name, c.status, c.budget, c.impression_goal, c.metadata
     ORDER BY COALESCE(SUM(ds.impressions), 0) DESC, c.name ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows.map((row) => withSpendMetrics(row));
}

export async function getWorkspaceTagBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, limit = 25, advertiserId = '', campaignId = '', tagIds: rawTagIds = [], tagId = '', channel = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const conditions = ['t.workspace_id = $1'];
  addTagScopeFilters(params, conditions, 't', campaignId, tagIds, advertiserId);
  addTagChannelFilter(conditions, 't', channel);
  addDateFilters(params, conditions, 'ds', dateFrom, dateTo);
  params.push(normalizeLimit(limit));

  const { rows } = await pool.query(
    `SELECT
       t.id,
       t.campaign_id,
       t.name,
       t.format,
       t.status,
       c.name AS campaign_name,
       c.budget,
       c.impression_goal,
       c.metadata AS campaign_metadata,
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
     LEFT JOIN campaigns c ON c.id = t.campaign_id AND c.workspace_id = t.workspace_id
     LEFT JOIN tag_daily_stats ds ON ds.tag_id = t.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY t.id, t.campaign_id, t.name, t.format, t.status, c.name, c.budget, c.impression_goal, c.metadata
     ORDER BY COALESCE(SUM(ds.impressions), 0) DESC, t.name ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows.map((row) => withSpendMetrics(row));
}

async function getImpressionGroupedBreakdown(pool, workspaceId, groupSql, labelAlias, opts = {}) {
  const { dateFrom, dateTo, limit = 25, advertiserId = '', campaignId = '', tagIds: rawTagIds = [], tagId = '', channel = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const conditions = ['ie.workspace_id = $1'];
  addImpressionScopeFilters(params, conditions, 't', 'ie', campaignId, tagIds, advertiserId);
  addTagChannelFilter(conditions, 't', channel);
  addTimestampFilters(params, conditions, 'ie', dateFrom, dateTo, opts.timezone);
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

export async function getWorkspaceSiteBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, limit = 25, advertiserId = '', campaignId = '', tagIds: rawTagIds = [], tagId = '', channel = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const impressionConditions = ['ie.workspace_id = $1'];
  addImpressionScopeFilters(params, impressionConditions, 't', 'ie', campaignId, tagIds, advertiserId);
  addTagChannelFilter(impressionConditions, 't', channel);
  addTimestampFilters(params, impressionConditions, 'ie', dateFrom, dateTo, opts.timezone);

  params.push(workspaceId);
  const clickConditions = [`ce.workspace_id = $${params.length}`];
  addImpressionScopeFilters(params, clickConditions, 't_click', 'ce', campaignId, tagIds, advertiserId);
  addTagChannelFilter(clickConditions, 't_click', channel);
  addTimestampFilters(params, clickConditions, 'ce', dateFrom, dateTo, opts.timezone);

  params.push(normalizeLimit(limit));
  const { rows } = await pool.query(
    `WITH impressions AS (
       SELECT
         COALESCE(NULLIF(ie.site_domain, ''), 'Unknown') AS site_domain,
         COUNT(*)::bigint AS impressions,
         COALESCE(SUM(CASE WHEN COALESCE(ie.viewable, false) THEN 1 ELSE 0 END), 0)::bigint AS viewable_imps,
         COALESCE(SUM(CASE WHEN ie.viewable IS NOT NULL THEN 1 ELSE 0 END), 0)::bigint AS measured_imps,
         COALESCE(SUM(CASE WHEN ie.viewable IS NULL THEN 1 ELSE 0 END), 0)::bigint AS undetermined_imps
       FROM impression_events ie
       JOIN ad_tags t ON t.id = ie.tag_id
       WHERE ${impressionConditions.join(' AND ')}
       GROUP BY 1
     ),
     clicks AS (
       SELECT
         COALESCE(NULLIF(ce.site_domain, ''), 'Unknown') AS site_domain,
         COUNT(*)::bigint AS clicks
       FROM click_events ce
       JOIN ad_tags t_click ON t_click.id = ce.tag_id
       WHERE ${clickConditions.join(' AND ')}
       GROUP BY 1
     )
     SELECT
       COALESCE(i.site_domain, c.site_domain, 'Unknown') AS site_domain,
       COALESCE(i.impressions, 0)::bigint AS impressions,
       COALESCE(c.clicks, 0)::bigint AS clicks,
       COALESCE(i.viewable_imps, 0)::bigint AS viewable_imps,
       COALESCE(i.measured_imps, 0)::bigint AS measured_imps,
       COALESCE(i.undetermined_imps, 0)::bigint AS undetermined_imps,
       0::bigint AS unique_identities,
       0::numeric AS avg_frequency,
       CASE WHEN COALESCE(i.impressions, 0) > 0
         THEN ROUND(COALESCE(c.clicks, 0)::NUMERIC / i.impressions * 100, 4)
         ELSE 0 END AS ctr,
       CASE WHEN COALESCE(i.measured_imps, 0) > 0
         THEN ROUND(COALESCE(i.viewable_imps, 0)::NUMERIC / i.measured_imps * 100, 4)
         ELSE 0 END AS viewability_rate
     FROM impressions i
     FULL OUTER JOIN clicks c ON c.site_domain = i.site_domain
     ORDER BY impressions DESC, clicks DESC, site_domain ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows.filter((row) => String(row.site_domain ?? '').trim());
}

export async function getWorkspaceAppBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, limit = 25, advertiserId = '', campaignId = '', tagIds: rawTagIds = [], tagId = '', channel = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const impressionConditions = ['ie.workspace_id = $1'];
  addImpressionScopeFilters(params, impressionConditions, 't', 'ie', campaignId, tagIds, advertiserId);
  addTagChannelFilter(impressionConditions, 't', channel);
  addTimestampFilters(params, impressionConditions, 'ie', dateFrom, dateTo, opts.timezone);
  impressionConditions.push(`(COALESCE(ie.app_name, '') <> '' OR COALESCE(ie.app_bundle, '') <> '' OR COALESCE(ie.app_id, '') <> '')`);

  const clickColumnResult = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'click_events'
       AND column_name IN ('app_id', 'app_bundle', 'app_name')`,
  );
  const clickColumns = new Set(clickColumnResult.rows.map((row) => row.column_name));
  const hasClickAppContext = ['app_id', 'app_bundle', 'app_name'].every((column) => clickColumns.has(column));

  let clickConditions = [];
  if (hasClickAppContext) {
    params.push(workspaceId);
    clickConditions = [`ce.workspace_id = $${params.length}`];
    addImpressionScopeFilters(params, clickConditions, 't_click', 'ce', campaignId, tagIds, advertiserId);
    addTagChannelFilter(clickConditions, 't_click', channel);
    addTimestampFilters(params, clickConditions, 'ce', dateFrom, dateTo, opts.timezone);
    clickConditions.push(`(COALESCE(ce.app_name, '') <> '' OR COALESCE(ce.app_bundle, '') <> '' OR COALESCE(ce.app_id, '') <> '')`);
  }
  params.push(normalizeLimit(limit));

  const { rows } = await pool.query(
    `WITH impressions AS (
       SELECT
         COALESCE(NULLIF(ie.app_name, ''), NULLIF(ie.app_bundle, ''), NULLIF(ie.app_id, ''), 'Unknown app') AS app_name,
         MAX(NULLIF(ie.app_bundle, '')) AS app_bundle,
         MAX(NULLIF(ie.app_id, '')) AS app_id,
         COUNT(*)::bigint AS impressions,
         COALESCE(SUM(CASE WHEN COALESCE(ie.viewable, false) THEN 1 ELSE 0 END), 0)::bigint AS viewable_imps,
         COALESCE(SUM(CASE WHEN ie.viewable IS NOT NULL THEN 1 ELSE 0 END), 0)::bigint AS measured_imps,
         COALESCE(SUM(CASE WHEN ie.viewable IS NULL THEN 1 ELSE 0 END), 0)::bigint AS undetermined_imps
       FROM impression_events ie
       JOIN ad_tags t ON t.id = ie.tag_id
       WHERE ${impressionConditions.join(' AND ')}
       GROUP BY 1
     ),
     clicks AS (
       ${hasClickAppContext
        ? `SELECT
             COALESCE(NULLIF(ce.app_name, ''), NULLIF(ce.app_bundle, ''), NULLIF(ce.app_id, ''), 'Unknown app') AS app_name,
             MAX(NULLIF(ce.app_bundle, '')) AS app_bundle,
             MAX(NULLIF(ce.app_id, '')) AS app_id,
             COUNT(*)::bigint AS clicks
           FROM click_events ce
           JOIN ad_tags t_click ON t_click.id = ce.tag_id
           WHERE ${clickConditions.join(' AND ')}
           GROUP BY 1`
        : `SELECT NULL::text AS app_name, NULL::text AS app_bundle, NULL::text AS app_id, 0::bigint AS clicks WHERE false`}
     )
     SELECT
       COALESCE(i.app_name, c.app_name, 'Unknown app') AS app_name,
       COALESCE(i.app_bundle, c.app_bundle) AS app_bundle,
       COALESCE(i.app_id, c.app_id) AS app_id,
       COALESCE(i.impressions, 0)::bigint AS impressions,
       COALESCE(c.clicks, 0)::bigint AS clicks,
       COALESCE(i.viewable_imps, 0)::bigint AS viewable_imps,
       COALESCE(i.measured_imps, 0)::bigint AS measured_imps,
       COALESCE(i.undetermined_imps, 0)::bigint AS undetermined_imps,
       0::bigint AS unique_identities,
       0::numeric AS avg_frequency,
       CASE WHEN COALESCE(i.impressions, 0) > 0
         THEN ROUND(COALESCE(c.clicks, 0)::NUMERIC / i.impressions * 100, 4)
         ELSE 0 END AS ctr,
       CASE WHEN COALESCE(i.measured_imps, 0) > 0
         THEN ROUND(COALESCE(i.viewable_imps, 0)::NUMERIC / i.measured_imps * 100, 4)
         ELSE 0 END AS viewability_rate
     FROM impressions i
     FULL OUTER JOIN clicks c ON c.app_name = i.app_name
     ORDER BY impressions DESC, clicks DESC, app_name ASC
     LIMIT $${params.length}`,
    params,
  );

  return rows.filter((row) => String(row.app_name ?? '').trim());
}

export function getWorkspaceCountryBreakdown(pool, workspaceId, opts = {}) {
  return getImpressionGroupedBreakdown(pool, workspaceId, `COALESCE(NULLIF(ie.country, ''), 'Unknown')`, 'country', opts);
}

export function getWorkspaceRegionBreakdown(pool, workspaceId, opts = {}) {
  return getImpressionGroupedBreakdown(pool, workspaceId, `COALESCE(NULLIF(
    CASE
      WHEN UPPER(COALESCE(ie.country, '')) = 'SV' THEN
        CASE UPPER(COALESCE(ie.region, ''))
          WHEN 'AH' THEN 'Ahuachapan'
          WHEN 'CA' THEN 'Cabanas'
          WHEN 'CH' THEN 'Chalatenango'
          WHEN 'CU' THEN 'Cuscatlan'
          WHEN 'LI' THEN 'La Libertad'
          WHEN 'MO' THEN 'Morazan'
          WHEN 'PA' THEN 'La Paz'
          WHEN 'SA' THEN 'Santa Ana'
          WHEN 'SM' THEN 'San Miguel'
          WHEN 'SO' THEN 'Sonsonate'
          WHEN 'SS' THEN 'San Salvador'
          WHEN 'SV' THEN 'San Vicente'
          WHEN 'UN' THEN 'La Union'
          WHEN 'US' THEN 'Usulutan'
          ELSE NULLIF(ie.region, '')
        END
      ELSE NULLIF(ie.region, '')
    END,
    ''
  ), 'Unknown')`, 'region', opts);
}

export function getWorkspaceCityBreakdown(pool, workspaceId, opts = {}) {
  return getImpressionGroupedBreakdown(pool, workspaceId, `COALESCE(NULLIF(ie.city, ''), 'Unknown')`, 'city', opts);
}

export async function getWorkspaceTrackerBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, limit = 25, advertiserId = '', campaignId = '', tagIds: rawTagIds = [], tagId = '', channel = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const conditions = ['t.workspace_id = $1'];
  addTagScopeFilters(params, conditions, 't', campaignId, tagIds, advertiserId);
  addTagChannelFilter(conditions, 't', channel);
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
  const { dateFrom, dateTo, limit = 25, advertiserId = '', campaignId = '', tagIds: rawTagIds = [], tagId = '', channel = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const conditions = ['t.workspace_id = $1'];
  addTagScopeFilters(params, conditions, 't', campaignId, tagIds, advertiserId);
  addTagChannelFilter(conditions, 't', channel);
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

async function getWorkspaceAllocatedCreativeRows(pool, workspaceId, opts = {}) {
  const {
    dateFrom,
    dateTo,
    advertiserId = '',
    campaignId = '',
    tagIds: rawTagIds = [],
    tagId = '',
    creativeId = '',
    variantId = '',
    channel = '',
  } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const conditions = ['t.workspace_id = $1'];
  const postAllocationConditions = [];
  addTagScopeFilters(params, conditions, 't', campaignId, tagIds, advertiserId);
  addTagChannelFilter(conditions, 't', channel);
  addDateFilters(params, conditions, 'ds', dateFrom, dateTo);
  if (creativeId) {
    params.push(creativeId);
    postAllocationConditions.push(`id = $${params.length}`);
  }
  if (variantId) {
    params.push(variantId);
    postAllocationConditions.push(`variant_id = $${params.length}`);
  }

  const { rows } = await pool.query(
    `WITH tag_daily AS (
       SELECT
         ds.tag_id,
         ds.date,
         COALESCE(ds.impressions, 0)::numeric AS tag_impressions,
         COALESCE(ds.clicks, 0)::numeric AS tag_clicks,
         COALESCE(ds.viewable_imps, 0)::numeric AS tag_viewable_imps,
         COALESCE(ds.measured_imps, 0)::numeric AS tag_measured_imps,
         COALESCE(ds.undetermined_imps, 0)::numeric AS tag_undetermined_imps,
         COALESCE(ds.spend, 0)::numeric AS tag_spend,
         camp.budget,
         camp.impression_goal,
         camp.metadata AS campaign_metadata
       FROM tag_daily_stats ds
       JOIN ad_tags t ON t.id = ds.tag_id
       LEFT JOIN campaigns camp ON camp.id = t.campaign_id AND camp.workspace_id = t.workspace_id
       WHERE ${conditions.join(' AND ')}
     ),
     binding_roster AS (
       SELECT
         td.tag_id,
         td.date,
         cv.creative_id AS id,
         c.name,
         c.approval_status,
         c.type AS creative_type,
         cv.source_kind,
         cv.serving_format,
         COALESCE(b.creative_size_variant_id, '') AS variant_id,
         COALESCE(
           NULLIF(v.label, ''),
           CASE
             WHEN COALESCE(v.width, 0) > 0 AND COALESCE(v.height, 0) > 0 THEN CONCAT(v.width, 'x', v.height)
             ELSE 'Default'
           END
         ) AS variant_label,
         td.budget,
         td.impression_goal,
         td.campaign_metadata,
         GREATEST(COALESCE(b.weight, 1), 1)::numeric AS binding_weight,
         SUM(GREATEST(COALESCE(b.weight, 1), 1)::numeric) OVER (PARTITION BY td.tag_id, td.date) AS total_binding_weight,
         td.tag_impressions,
         td.tag_clicks,
         td.tag_viewable_imps,
         td.tag_measured_imps,
         td.tag_undetermined_imps,
         td.tag_spend
       FROM tag_daily td
       JOIN ad_tags t ON t.id = td.tag_id
       JOIN creative_tag_bindings b
         ON b.tag_id = t.id
        AND b.workspace_id = t.workspace_id
        AND b.status <> 'draft'
        AND (b.start_at IS NULL OR b.start_at::date <= td.date)
        AND (
          COALESCE(
            b.end_at::date,
            CASE WHEN b.status IN ('paused', 'archived') THEN b.updated_at::date ELSE NULL END
          ) IS NULL
          OR COALESCE(
            b.end_at::date,
            CASE WHEN b.status IN ('paused', 'archived') THEN b.updated_at::date ELSE NULL END
          ) >= td.date
        )
       JOIN creative_versions cv
         ON cv.id = b.creative_version_id
        AND cv.workspace_id = b.workspace_id
       JOIN creatives c
         ON c.id = cv.creative_id
        AND c.workspace_id = cv.workspace_id
       LEFT JOIN creative_size_variants v ON v.id = b.creative_size_variant_id
     ),
     scoped_days AS (
       SELECT DISTINCT tag_id, date
       FROM tag_daily
     ),
     exact_impression_counts AS (
       SELECT
         ie.tag_id,
         ie.timestamp::date AS date,
         ie.creative_id AS id,
         COALESCE(ie.creative_size_variant_id, '') AS variant_id,
         COUNT(*)::numeric AS exact_impressions,
         COALESCE(SUM(CASE WHEN COALESCE(ie.viewable, false) THEN 1 ELSE 0 END), 0)::numeric AS exact_viewable_imps,
         COALESCE(SUM(CASE WHEN ie.viewable IS NOT NULL THEN 1 ELSE 0 END), 0)::numeric AS exact_measured_imps,
         COALESCE(SUM(CASE WHEN ie.viewable IS NULL THEN 1 ELSE 0 END), 0)::numeric AS exact_undetermined_imps
       FROM impression_events ie
       JOIN scoped_days sd
         ON sd.tag_id = ie.tag_id
        AND sd.date = ie.timestamp::date
       WHERE ie.workspace_id = $1
         AND COALESCE(ie.creative_id, '') <> ''
       GROUP BY ie.tag_id, ie.timestamp::date, ie.creative_id, COALESCE(ie.creative_size_variant_id, '')
     ),
     exact_impression_totals AS (
       SELECT
         tag_id,
         date,
         COALESCE(SUM(exact_impressions), 0)::numeric AS tag_exact_impressions,
         COALESCE(SUM(exact_viewable_imps), 0)::numeric AS tag_exact_viewable_imps,
         COALESCE(SUM(exact_measured_imps), 0)::numeric AS tag_exact_measured_imps,
         COALESCE(SUM(exact_undetermined_imps), 0)::numeric AS tag_exact_undetermined_imps
       FROM exact_impression_counts
       GROUP BY tag_id, date
     ),
     exact_click_counts AS (
       SELECT
         ce.tag_id,
         ce.timestamp::date AS date,
         ce.creative_id AS id,
         COALESCE(ce.creative_size_variant_id, '') AS variant_id,
         COUNT(*)::numeric AS exact_clicks
       FROM click_events ce
       JOIN scoped_days sd
         ON sd.tag_id = ce.tag_id
        AND sd.date = ce.timestamp::date
       WHERE ce.workspace_id = $1
         AND COALESCE(ce.creative_id, '') <> ''
       GROUP BY ce.tag_id, ce.timestamp::date, ce.creative_id, COALESCE(ce.creative_size_variant_id, '')
     ),
     exact_click_totals AS (
       SELECT
         tag_id,
         date,
         COALESCE(SUM(exact_clicks), 0)::numeric AS tag_exact_clicks
       FROM exact_click_counts
       GROUP BY tag_id, date
     ),
     resolved_binding_day AS (
       SELECT
         br.*,
         COALESCE(ei.exact_impressions, 0)::numeric AS exact_impressions,
         COALESCE(ei.exact_viewable_imps, 0)::numeric AS exact_viewable_imps,
         COALESCE(ei.exact_measured_imps, 0)::numeric AS exact_measured_imps,
         COALESCE(ei.exact_undetermined_imps, 0)::numeric AS exact_undetermined_imps,
         COALESCE(ec.exact_clicks, 0)::numeric AS exact_clicks,
         COALESCE(eit.tag_exact_impressions, 0)::numeric AS tag_exact_impressions,
         COALESCE(eit.tag_exact_viewable_imps, 0)::numeric AS tag_exact_viewable_imps,
         COALESCE(eit.tag_exact_measured_imps, 0)::numeric AS tag_exact_measured_imps,
         COALESCE(eit.tag_exact_undetermined_imps, 0)::numeric AS tag_exact_undetermined_imps,
         COALESCE(ect.tag_exact_clicks, 0)::numeric AS tag_exact_clicks,
         CASE
           WHEN br.tag_impressions > 0 AND COALESCE(eit.tag_exact_impressions, 0) > br.tag_impressions AND COALESCE(eit.tag_exact_impressions, 0) > 0
             THEN COALESCE(ei.exact_impressions, 0)::numeric * (br.tag_impressions / eit.tag_exact_impressions)
           ELSE COALESCE(ei.exact_impressions, 0)::numeric
             + GREATEST(br.tag_impressions - COALESCE(eit.tag_exact_impressions, 0), 0)
               * CASE WHEN br.total_binding_weight > 0 THEN br.binding_weight / br.total_binding_weight ELSE 0 END
         END AS resolved_impressions,
         CASE
           WHEN br.tag_clicks > 0 AND COALESCE(ect.tag_exact_clicks, 0) > br.tag_clicks AND COALESCE(ect.tag_exact_clicks, 0) > 0
             THEN COALESCE(ec.exact_clicks, 0)::numeric * (br.tag_clicks / ect.tag_exact_clicks)
           ELSE COALESCE(ec.exact_clicks, 0)::numeric
             + GREATEST(br.tag_clicks - COALESCE(ect.tag_exact_clicks, 0), 0)
               * CASE WHEN br.total_binding_weight > 0 THEN br.binding_weight / br.total_binding_weight ELSE 0 END
         END AS resolved_clicks,
         CASE
           WHEN br.tag_viewable_imps > 0 AND COALESCE(eit.tag_exact_viewable_imps, 0) > br.tag_viewable_imps AND COALESCE(eit.tag_exact_viewable_imps, 0) > 0
             THEN COALESCE(ei.exact_viewable_imps, 0)::numeric * (br.tag_viewable_imps / eit.tag_exact_viewable_imps)
           ELSE COALESCE(ei.exact_viewable_imps, 0)::numeric
             + GREATEST(br.tag_viewable_imps - COALESCE(eit.tag_exact_viewable_imps, 0), 0)
               * CASE WHEN br.total_binding_weight > 0 THEN br.binding_weight / br.total_binding_weight ELSE 0 END
         END AS resolved_viewable_imps,
         CASE
           WHEN br.tag_measured_imps > 0 AND COALESCE(eit.tag_exact_measured_imps, 0) > br.tag_measured_imps AND COALESCE(eit.tag_exact_measured_imps, 0) > 0
             THEN COALESCE(ei.exact_measured_imps, 0)::numeric * (br.tag_measured_imps / eit.tag_exact_measured_imps)
           ELSE COALESCE(ei.exact_measured_imps, 0)::numeric
             + GREATEST(br.tag_measured_imps - COALESCE(eit.tag_exact_measured_imps, 0), 0)
               * CASE WHEN br.total_binding_weight > 0 THEN br.binding_weight / br.total_binding_weight ELSE 0 END
         END AS resolved_measured_imps,
         CASE
           WHEN br.tag_undetermined_imps > 0 AND COALESCE(eit.tag_exact_undetermined_imps, 0) > br.tag_undetermined_imps AND COALESCE(eit.tag_exact_undetermined_imps, 0) > 0
             THEN COALESCE(ei.exact_undetermined_imps, 0)::numeric * (br.tag_undetermined_imps / eit.tag_exact_undetermined_imps)
           ELSE COALESCE(ei.exact_undetermined_imps, 0)::numeric
             + GREATEST(br.tag_undetermined_imps - COALESCE(eit.tag_exact_undetermined_imps, 0), 0)
               * CASE WHEN br.total_binding_weight > 0 THEN br.binding_weight / br.total_binding_weight ELSE 0 END
         END AS resolved_undetermined_imps
       FROM binding_roster br
       LEFT JOIN exact_impression_counts ei
         ON ei.tag_id = br.tag_id
        AND ei.date = br.date
        AND ei.id = br.id
        AND ei.variant_id = br.variant_id
       LEFT JOIN exact_click_counts ec
         ON ec.tag_id = br.tag_id
        AND ec.date = br.date
        AND ec.id = br.id
        AND ec.variant_id = br.variant_id
       LEFT JOIN exact_impression_totals eit
         ON eit.tag_id = br.tag_id
        AND eit.date = br.date
       LEFT JOIN exact_click_totals ect
         ON ect.tag_id = br.tag_id
        AND ect.date = br.date
     )
     SELECT
       id,
       name,
       approval_status,
       creative_type,
       source_kind,
       serving_format,
       variant_id,
       variant_label,
       budget,
       impression_goal,
       campaign_metadata,
       COALESCE(SUM(resolved_impressions), 0) AS impressions,
       COALESCE(SUM(resolved_clicks), 0) AS clicks,
       COALESCE(SUM(resolved_viewable_imps), 0) AS viewable_imps,
       COALESCE(SUM(resolved_measured_imps), 0) AS measured_imps,
       COALESCE(SUM(resolved_undetermined_imps), 0) AS undetermined_imps,
       COALESCE(SUM(
         CASE
           WHEN tag_impressions > 0 THEN tag_spend * (resolved_impressions / tag_impressions)
           WHEN total_binding_weight > 0 THEN tag_spend * (binding_weight / total_binding_weight)
           ELSE 0
         END
       ), 0) AS spend,
       MAX(CASE WHEN exact_impressions > 0 OR exact_clicks > 0 THEN 1 ELSE 0 END) AS has_exact_attribution
     FROM resolved_binding_day
     ${postAllocationConditions.length ? `WHERE ${postAllocationConditions.join(' AND ')}` : ''}
     GROUP BY
       id,
       name,
       approval_status,
       creative_type,
       source_kind,
       serving_format,
       variant_id,
       variant_label,
       budget,
       impression_goal,
       campaign_metadata`,
    params,
  );

  return rows;
}

export async function getWorkspaceCreativeBreakdown(pool, workspaceId, opts = {}) {
  const rows = await getWorkspaceAllocatedCreativeRows(pool, workspaceId, opts);
  return collapseAllocatedCreativeRows(rows, { limit: opts.limit, variantMode: false });
}

export async function getWorkspaceVariantBreakdown(pool, workspaceId, opts = {}) {
  const rows = await getWorkspaceAllocatedCreativeRows(pool, workspaceId, opts);
  const enrichedRows = rows.map((row) => ({
    ...row,
    variant_entity_id: row.variant_id || `${row.id}:default`,
  }));
  return collapseAllocatedCreativeRows(enrichedRows, { limit: opts.limit, variantMode: true });
}

export async function getWorkspaceContextSnapshot(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, advertiserId = '', campaignId = '', tagIds: rawTagIds = [], tagId = '', channel = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const latestParams = [workspaceId];
  const latestConditions = ['ie.workspace_id = $1'];
  addImpressionScopeFilters(latestParams, latestConditions, 't', 'ie', campaignId, tagIds, advertiserId);
  addTagChannelFilter(latestConditions, 't', channel);
  addTimestampFilters(latestParams, latestConditions, 'ie', dateFrom, dateTo, opts.timezone);
  const connectionColumnResult = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'impression_events'
       AND column_name IN (
         'connection_type',
         'effective_connection_type',
         'connection_downlink_mbps',
         'connection_rtt_ms',
         'connection_save_data'
       )`,
  );
  const connectionColumns = new Set(connectionColumnResult.rows.map((row) => row.column_name));
  const connectionTypeExpression = connectionColumns.has('connection_type') ? 'ie.connection_type' : 'NULL::text';
  const effectiveConnectionTypeExpression = connectionColumns.has('effective_connection_type') ? 'ie.effective_connection_type' : 'NULL::text';
  const connectionDownlinkExpression = connectionColumns.has('connection_downlink_mbps') ? 'ie.connection_downlink_mbps' : 'NULL::numeric';
  const connectionRttExpression = connectionColumns.has('connection_rtt_ms') ? 'ie.connection_rtt_ms' : 'NULL::integer';
  const connectionSaveDataExpression = connectionColumns.has('connection_save_data') ? 'ie.connection_save_data' : 'NULL::boolean';
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
       ie.content_genre,
       ${connectionTypeExpression} AS connection_type,
       ${effectiveConnectionTypeExpression} AS effective_connection_type,
       ${connectionDownlinkExpression} AS connection_downlink_mbps,
       ${connectionRttExpression} AS connection_rtt_ms,
       ${connectionSaveDataExpression} AS connection_save_data
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

  const osParams = [...latestParams];
  const osQuery = pool.query(
    `SELECT COALESCE(NULLIF(ie.os, ''), 'Unknown') AS label,
            COUNT(*)::bigint AS value
     FROM impression_events ie
     JOIN ad_tags t ON t.id = ie.tag_id
     WHERE ${latestConditions.join(' AND ')}
     GROUP BY 1
     ORDER BY value DESC, label ASC
     LIMIT 10`,
    osParams,
  );

  const browserParams = [...latestParams];
  const browserQuery = pool.query(
    `SELECT COALESCE(NULLIF(ie.browser, ''), 'Unknown') AS label,
            COUNT(*)::bigint AS value
     FROM impression_events ie
     JOIN ad_tags t ON t.id = ie.tag_id
     WHERE ${latestConditions.join(' AND ')}
     GROUP BY 1
     ORDER BY value DESC, label ASC
     LIMIT 10`,
    browserParams,
  );

  const carrierParams = [...latestParams];
  const carrierQuery = pool.query(
    `SELECT COALESCE(NULLIF(ie.carrier, ''), 'Unknown') AS label,
            COUNT(*)::bigint AS value
     FROM impression_events ie
     JOIN ad_tags t ON t.id = ie.tag_id
     WHERE ${latestConditions.join(' AND ')}
     GROUP BY 1
     ORDER BY value DESC, label ASC
     LIMIT 10`,
    carrierParams,
  );

  const networkParams = [...latestParams];
  const networkQuery = pool.query(
    `SELECT COALESCE(NULLIF(ie.network_id, ''), 'Unknown') AS label,
            COUNT(*)::bigint AS value
     FROM impression_events ie
     JOIN ad_tags t ON t.id = ie.tag_id
     WHERE ${latestConditions.join(' AND ')}
     GROUP BY 1
     ORDER BY value DESC, label ASC
     LIMIT 10`,
    networkParams,
  );

  const connectionTypeParams = [...latestParams];
  const connectionTypeQuery = pool.query(
    `SELECT COALESCE(NULLIF(${connectionTypeExpression}, ''), 'Unknown') AS label,
            COUNT(*)::bigint AS value
     FROM impression_events ie
     JOIN ad_tags t ON t.id = ie.tag_id
     WHERE ${latestConditions.join(' AND ')}
     GROUP BY 1
     ORDER BY value DESC, label ASC
     LIMIT 10`,
    connectionTypeParams,
  );

  const effectiveConnectionTypeParams = [...latestParams];
  const effectiveConnectionTypeQuery = pool.query(
    `SELECT COALESCE(NULLIF(${effectiveConnectionTypeExpression}, ''), 'Unknown') AS label,
            COUNT(*)::bigint AS value
     FROM impression_events ie
     JOIN ad_tags t ON t.id = ie.tag_id
     WHERE ${latestConditions.join(' AND ')}
     GROUP BY 1
     ORDER BY value DESC, label ASC
     LIMIT 10`,
    effectiveConnectionTypeParams,
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

  const latestResult = await latestQuery;
  const deviceTypeResult = await deviceTypeQuery;
  const deviceModelResult = await deviceModelQuery;
  const osResult = await osQuery;
  const browserResult = await browserQuery;
  const carrierResult = await carrierQuery;
  const networkResult = await networkQuery;
  const connectionTypeResult = await connectionTypeQuery;
  const effectiveConnectionTypeResult = await effectiveConnectionTypeQuery;
  const inventoryResult = await inventoryQuery;

  return {
    latest_context: latestResult.rows[0] ?? null,
    device_types: deviceTypeResult.rows,
    device_models: deviceModelResult.rows,
    operating_systems: osResult.rows,
    browsers: browserResult.rows,
    carriers: carrierResult.rows,
    networks: networkResult.rows,
    connection_types: connectionTypeResult.rows,
    effective_connection_types: effectiveConnectionTypeResult.rows,
    inventory_environments: inventoryResult.rows,
  };
}

export async function getWorkspaceContextBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, advertiserId = '', tagId = '', campaignId = '', channel = '' } = opts;
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
  if (advertiserId) {
    params.push(advertiserId);
    conditions.push(`EXISTS (SELECT 1 FROM campaigns c_scope WHERE c_scope.id = t.campaign_id AND c_scope.workspace_id = t.workspace_id AND c_scope.advertiser_id = $${params.length})`);
  }
  addTagChannelFilter(conditions, 't', channel);
  addTimestampFilters(params, conditions, 'ie', dateFrom, dateTo, opts.timezone);

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
  const { dateFrom, dateTo, limit = 25, advertiserId = '', campaignId = '', tagIds: rawTagIds = [], tagId = '', minImpressions = 1, minClicks = 0, canonicalType = '', channel = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const impressionConditions = ['ie.workspace_id = $1'];
  addImpressionScopeFilters(params, impressionConditions, 't', 'ie', campaignId, tagIds, advertiserId);
  addTagChannelFilter(impressionConditions, 't', channel);
  addTimestampFilters(params, impressionConditions, 'ie', dateFrom, dateTo, opts.timezone);
  addIdentityBreakdownFilters(params, impressionConditions, 'ie', opts);

  const clickConditions = ['ce.workspace_id = $1'];
  addImpressionScopeFilters(params, clickConditions, 't_click', 'ce', campaignId, tagIds, advertiserId);
  addTagChannelFilter(clickConditions, 't_click', channel);
  addTimestampFilters(params, clickConditions, 'ce', dateFrom, dateTo, opts.timezone);
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
  const { dateFrom, dateTo, advertiserId = '', campaignId = '', tagIds: rawTagIds = [], tagId = '', channel = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const impressionConditions = ['ie.workspace_id = $1'];
  addImpressionScopeFilters(params, impressionConditions, 't', 'ie', campaignId, tagIds, advertiserId);
  addTagChannelFilter(impressionConditions, 't', channel);
  addTimestampFilters(params, impressionConditions, 'ie', dateFrom, dateTo, opts.timezone);
  addIdentityBreakdownFilters(params, impressionConditions, 'ie', opts);

  const clickConditions = ['ce.workspace_id = $1'];
  addImpressionScopeFilters(params, clickConditions, 't_click', 'ce', campaignId, tagIds, advertiserId);
  addTagChannelFilter(clickConditions, 't_click', channel);
  addTimestampFilters(params, clickConditions, 'ce', dateFrom, dateTo, opts.timezone);
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
  const { dateFrom, dateTo, advertiserId = '', campaignId = '', tagIds: rawTagIds = [], tagId = '', channel = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const impressionConditions = ['ie.workspace_id = $1'];
  addImpressionScopeFilters(params, impressionConditions, 't', 'ie', campaignId, tagIds, advertiserId);
  addTagChannelFilter(impressionConditions, 't', channel);
  addTimestampFilters(params, impressionConditions, 'ie', dateFrom, dateTo, opts.timezone);
  addIdentityBreakdownFilters(params, impressionConditions, 'ie', opts);

  const clickConditions = ['ce.workspace_id = $1'];
  addImpressionScopeFilters(params, clickConditions, 't_click', 'ce', campaignId, tagIds, advertiserId);
  addTagChannelFilter(clickConditions, 't_click', channel);
  addTimestampFilters(params, clickConditions, 'ce', dateFrom, dateTo, opts.timezone);
  addIdentityBreakdownFilters(params, clickConditions, 'ce', opts);

  const { rows } = await pool.query(
    `WITH impressions AS (
       SELECT
         ${resolvedIdentityExpression('ie', 'e')} AS identity_key,
         COUNT(*)::bigint AS impressions
       FROM impression_events ie
       JOIN ad_tags t ON t.id = ie.tag_id
       LEFT JOIN identity_edges e
         ON e.workspace_id = ie.workspace_id
        AND e.aliased_id = ie.device_id
       WHERE ${impressionConditions.join(' AND ')}
       GROUP BY 1
     ),
     clicks AS (
       SELECT
         ${resolvedIdentityExpression('ce', 'e_click')} AS identity_key,
         COUNT(*)::bigint AS clicks
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
     ),
     per_identity AS (
       SELECT
         ids.identity_key,
         COALESCE(i.impressions, 0)::bigint AS impressions,
         COALESCE(c.clicks, 0)::bigint AS clicks
       FROM identities ids
       LEFT JOIN impressions i ON i.identity_key = ids.identity_key
       LEFT JOIN clicks c ON c.identity_key = ids.identity_key
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
  const { dateFrom, dateTo, limit = 25, advertiserId = '', campaignId = '', tagIds: rawTagIds = [], tagId = '', channel = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const conditions = ['ie.workspace_id = $1'];
  addImpressionScopeFilters(params, conditions, 't', 'ie', campaignId, tagIds, advertiserId);
  addTagChannelFilter(conditions, 't', channel);
  addTimestampFilters(params, conditions, 'ie', dateFrom, dateTo, opts.timezone);
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
  const { dateFrom, dateTo, advertiserId = '', campaignId = '', tagIds: rawTagIds = [], tagId = '', channel = '' } = opts;
  const tagIds = normalizeIdList(rawTagIds.length ? rawTagIds : tagId);
  const params = [workspaceId];
  const impressionConditions = ['ie.workspace_id = $1'];
  addImpressionScopeFilters(params, impressionConditions, 't', 'ie', campaignId, tagIds, advertiserId);
  addTagChannelFilter(impressionConditions, 't', channel);
  addTimestampFilters(params, impressionConditions, 'ie', dateFrom, dateTo, opts.timezone);
  addIdentityBreakdownFilters(params, impressionConditions, 'ie', opts);

  const clickConditions = ['ce.workspace_id = $1'];
  addImpressionScopeFilters(params, clickConditions, 't_click', 'ce', campaignId, tagIds, advertiserId);
  addTagChannelFilter(clickConditions, 't_click', channel);
  addTimestampFilters(params, clickConditions, 'ce', dateFrom, dateTo, opts.timezone);
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
