const IDENTITY_PRIORITY = ['external_user_id', 'device_id', 'cookie_id'];
const IDENTITY_CONFIDENCE = {
  external_user_id: 1,
  device_id: 0.8,
  cookie_id: 0.65,
};

function normalizeAudienceName(value = '') {
  return String(value ?? '').trim();
}

function appendIdentityScopeExistsCondition(params, conditions, opts = {}, profileAlias = 'p') {
  const {
    dateFrom,
    dateTo,
    campaignId = '',
    tagId = '',
    creativeId = '',
    variantId = '',
    siteDomain = '',
    region = '',
    city = '',
  } = opts;

  if (!campaignId && !tagId && !creativeId && !variantId && !siteDomain && !region && !city) return;

  const scopeConditions = [
    'e.workspace_id = $1',
    `e.identity_profile_id = ${profileAlias}.id`,
  ];

  if (dateFrom) {
    params.push(dateFrom);
    scopeConditions.push(`COALESCE(ie.timestamp, ce.timestamp, ge.timestamp) >= $${params.length}`);
  }
  if (dateTo) {
    params.push(`${dateTo}T23:59:59.999Z`);
    scopeConditions.push(`COALESCE(ie.timestamp, ce.timestamp, ge.timestamp) <= $${params.length}`);
  }
  if (campaignId) {
    params.push(campaignId);
    scopeConditions.push(`at.campaign_id = $${params.length}`);
  }
  if (tagId) {
    params.push(tagId);
    scopeConditions.push(`COALESCE(ie.tag_id, ce.tag_id, ge.tag_id) = $${params.length}`);
  }
  if (creativeId) {
    params.push(creativeId);
    scopeConditions.push(`COALESCE(ie.creative_id, ce.creative_id, ge.creative_id) = $${params.length}`);
  }
  if (variantId) {
    params.push(variantId);
    scopeConditions.push(`COALESCE(ie.creative_size_variant_id, ce.creative_size_variant_id, ge.creative_size_variant_id) = $${params.length}`);
  }
  if (siteDomain) {
    params.push(siteDomain);
    scopeConditions.push(`COALESCE(ie.site_domain, ce.site_domain, ge.site_domain) = $${params.length}`);
  }
  if (region) {
    params.push(region);
    scopeConditions.push(`COALESCE(ie.region, ce.region, ge.region) = $${params.length}`);
  }
  if (city) {
    params.push(city);
    scopeConditions.push(`COALESCE(ie.city, ce.city, ge.city) = $${params.length}`);
  }

  conditions.push(`EXISTS (
    SELECT 1
    FROM event_identity_keys e
    LEFT JOIN impression_events ie ON e.event_type = 'impression' AND ie.id = e.event_id
    LEFT JOIN click_events ce ON e.event_type = 'click' AND ce.id = e.event_id
    LEFT JOIN engagement_events ge ON e.event_type = 'engagement' AND ge.id = e.event_id
    LEFT JOIN ad_tags at ON at.id = COALESCE(ie.tag_id, ce.tag_id, ge.tag_id)
    WHERE ${scopeConditions.join(' AND ')}
  )`);
}

async function findIdentityProfileByKey(pool, workspace_id, key_type, key_value) {
  const { rows } = await pool.query(
    `SELECT p.id, p.workspace_id, p.canonical_type, p.canonical_value
     FROM identity_profile_keys k
     JOIN identity_profiles p ON p.id = k.identity_profile_id
     WHERE k.workspace_id = $1
       AND k.key_type = $2
       AND k.key_value = $3
     ORDER BY p.last_seen_at DESC
     LIMIT 1`,
    [workspace_id, key_type, key_value],
  );
  return rows[0] ?? null;
}

async function resolveIdentityProfile(pool, {
  workspace_id,
  identity_keys = [],
  country = null,
  region = null,
  city = null,
  timestamp = new Date(),
}) {
  if (!workspace_id || !Array.isArray(identity_keys) || !identity_keys.length) return null;

  const normalizedKeys = identity_keys.filter((item) => item && item.key_type && item.key_value);
  if (!normalizedKeys.length) return null;

  let profile = null;
  for (const keyType of IDENTITY_PRIORITY) {
    const matchingKeys = normalizedKeys.filter((item) => item.key_type === keyType);
    for (const item of matchingKeys) {
      profile = await findIdentityProfileByKey(pool, workspace_id, item.key_type, item.key_value);
      if (profile) break;
    }
    if (profile) break;
  }

  const canonicalKey = IDENTITY_PRIORITY
    .map((keyType) => normalizedKeys.find((item) => item.key_type === keyType))
    .find(Boolean) ?? null;

  if (!profile && canonicalKey) {
    const { rows } = await pool.query(
      `INSERT INTO identity_profiles
         (workspace_id, canonical_type, canonical_value, first_seen_at, last_seen_at, last_country, last_region, last_city, confidence)
       VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8)
       ON CONFLICT (workspace_id, canonical_type, canonical_value)
       DO UPDATE SET
         last_seen_at = GREATEST(identity_profiles.last_seen_at, EXCLUDED.last_seen_at),
         last_country = COALESCE(EXCLUDED.last_country, identity_profiles.last_country),
         last_region = COALESCE(EXCLUDED.last_region, identity_profiles.last_region),
         last_city = COALESCE(EXCLUDED.last_city, identity_profiles.last_city),
         confidence = GREATEST(identity_profiles.confidence, EXCLUDED.confidence),
         updated_at = NOW()
       RETURNING id, workspace_id, canonical_type, canonical_value`,
      [
        workspace_id,
        canonicalKey.key_type,
        canonicalKey.key_value,
        timestamp,
        country,
        region,
        city,
        IDENTITY_CONFIDENCE[canonicalKey.key_type] ?? 0.5,
      ],
    );
    profile = rows[0] ?? null;
  }

  if (!profile) return null;

  await pool.query(
    `UPDATE identity_profiles
     SET last_seen_at = GREATEST(last_seen_at, $2),
         last_country = COALESCE($3, last_country),
         last_region = COALESCE($4, last_region),
         last_city = COALESCE($5, last_city),
         updated_at = NOW()
     WHERE id = $1`,
    [profile.id, timestamp, country, region, city],
  );

  for (const item of normalizedKeys) {
    await pool.query(
      `INSERT INTO identity_profile_keys
         (identity_profile_id, workspace_id, key_type, key_value, source, is_first_party, consent_status, metadata, first_seen_at, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $9)
       ON CONFLICT (identity_profile_id, key_type, key_value)
       DO UPDATE SET
         source = COALESCE(EXCLUDED.source, identity_profile_keys.source),
         is_first_party = EXCLUDED.is_first_party,
         consent_status = COALESCE(EXCLUDED.consent_status, identity_profile_keys.consent_status),
         metadata = CASE
           WHEN identity_profile_keys.metadata = '{}'::jsonb THEN EXCLUDED.metadata
           ELSE identity_profile_keys.metadata || EXCLUDED.metadata
         END,
         last_seen_at = GREATEST(identity_profile_keys.last_seen_at, EXCLUDED.last_seen_at),
         updated_at = NOW()`,
      [
        profile.id,
        workspace_id,
        item.key_type,
        item.key_value,
        item.source ?? null,
        Boolean(item.is_first_party),
        item.consent_status ?? 'unknown',
        JSON.stringify(item.metadata ?? {}),
        timestamp,
      ],
    );
  }

  return profile.id;
}

async function upsertIdentityProfileDailyStats(pool, {
  identity_profile_id,
  workspace_id,
  timestamp = new Date(),
  impressions = 0,
  clicks = 0,
  engagements = 0,
}) {
  if (!identity_profile_id || !workspace_id) return;
  const date = new Date(timestamp).toISOString().slice(0, 10);
  await pool.query(
    `INSERT INTO identity_profile_daily_stats
       (identity_profile_id, workspace_id, date, impressions, clicks, engagements)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (identity_profile_id, date)
     DO UPDATE SET
       impressions = identity_profile_daily_stats.impressions + EXCLUDED.impressions,
       clicks = identity_profile_daily_stats.clicks + EXCLUDED.clicks,
       engagements = identity_profile_daily_stats.engagements + EXCLUDED.engagements,
       updated_at = NOW()`,
    [identity_profile_id, workspace_id, date, impressions, clicks, engagements],
  );
}

async function recordEventIdentityKeys(pool, {
  workspace_id,
  event_type,
  event_id,
  identity_keys = [],
  country = null,
  region = null,
  city = null,
  timestamp = new Date(),
}) {
  const keys = Array.isArray(identity_keys)
    ? identity_keys.filter((item) => item && item.key_type && item.key_value)
    : [];
  if (!workspace_id || !event_type || !event_id || !keys.length) return;

  const identityProfileId = await resolveIdentityProfile(pool, {
    workspace_id,
    identity_keys: keys,
    country,
    region,
    city,
    timestamp,
  });

  if (identityProfileId) {
    await upsertIdentityProfileDailyStats(pool, {
      identity_profile_id: identityProfileId,
      workspace_id,
      timestamp,
      impressions: event_type === 'impression' ? 1 : 0,
      clicks: event_type === 'click' ? 1 : 0,
      engagements: event_type === 'engagement' ? 1 : 0,
    });
  }

  for (const item of keys) {
    await pool.query(
      `INSERT INTO event_identity_keys
         (workspace_id, event_type, event_id, identity_profile_id, key_type, key_value, source, is_first_party, consent_status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       ON CONFLICT (event_type, event_id, key_type, key_value)
       DO UPDATE SET
         identity_profile_id = COALESCE(EXCLUDED.identity_profile_id, event_identity_keys.identity_profile_id),
         source = COALESCE(EXCLUDED.source, event_identity_keys.source),
         is_first_party = EXCLUDED.is_first_party,
         consent_status = COALESCE(EXCLUDED.consent_status, event_identity_keys.consent_status),
         metadata = CASE
           WHEN event_identity_keys.metadata = '{}'::jsonb THEN EXCLUDED.metadata
           ELSE event_identity_keys.metadata || EXCLUDED.metadata
         END`,
      [
        workspace_id,
        event_type,
        event_id,
        identityProfileId,
        item.key_type,
        item.key_value,
        item.source ?? null,
        Boolean(item.is_first_party),
        item.consent_status ?? 'unknown',
        JSON.stringify(item.metadata ?? {}),
      ],
    );
  }
}

export async function getWorkspaceIdentityBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, canonicalType = '', limit = 25 } = opts;
  const params = [workspaceId];
  const conditions = ['ds.workspace_id = $1'];

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`ds.date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`ds.date <= $${params.length}`);
  }
  if (canonicalType) {
    params.push(canonicalType);
    conditions.push(`p.canonical_type = $${params.length}`);
  }
  appendIdentityScopeExistsCondition(params, conditions, opts);
  params.push(Math.min(Number(limit) || 25, 100));

  const { rows } = await pool.query(
    `SELECT
       p.id,
       p.canonical_type,
       p.canonical_value,
       p.last_country,
       p.last_region,
       p.last_city,
       p.confidence,
       COALESCE(SUM(ds.impressions), 0)::bigint AS impressions,
       COALESCE(SUM(ds.clicks), 0)::bigint AS clicks,
       COALESCE(SUM(ds.engagements), 0)::bigint AS engagements,
       CASE WHEN COALESCE(SUM(ds.impressions), 0) > 0
            THEN ROUND(COALESCE(SUM(ds.clicks), 0)::NUMERIC / SUM(ds.impressions) * 100, 4)
            ELSE 0 END AS ctr
     FROM identity_profile_daily_stats ds
     JOIN identity_profiles p ON p.id = ds.identity_profile_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY p.id, p.canonical_type, p.canonical_value, p.last_country, p.last_region, p.last_city, p.confidence
     ORDER BY COALESCE(SUM(ds.impressions), 0) DESC, p.last_seen_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function getWorkspaceIdentityExport(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, canonicalType = '' } = opts;
  const params = [workspaceId];
  const conditions = ['ds.workspace_id = $1'];

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`ds.date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`ds.date <= $${params.length}`);
  }
  if (canonicalType) {
    params.push(canonicalType);
    conditions.push(`p.canonical_type = $${params.length}`);
  }
  appendIdentityScopeExistsCondition(params, conditions, opts);

  const { rows } = await pool.query(
    `SELECT
       p.id,
       p.canonical_type,
       p.canonical_value,
       p.last_country,
       p.last_region,
       p.last_city,
       p.confidence,
       p.first_seen_at,
       p.last_seen_at,
       COALESCE(SUM(ds.impressions), 0)::bigint AS impressions,
       COALESCE(SUM(ds.clicks), 0)::bigint AS clicks,
       COALESCE(SUM(ds.engagements), 0)::bigint AS engagements,
       CASE WHEN COALESCE(SUM(ds.impressions), 0) > 0
            THEN ROUND(COALESCE(SUM(ds.clicks), 0)::NUMERIC / SUM(ds.impressions) * 100, 4)
            ELSE 0 END AS ctr,
       COALESCE(COUNT(DISTINCT k.key_type), 0)::int AS key_type_count,
       COALESCE(COUNT(DISTINCT k.key_value), 0)::int AS key_count,
       COALESCE(string_agg(DISTINCT k.key_type, '|' ORDER BY k.key_type), '') AS key_types,
       COALESCE(string_agg(DISTINCT COALESCE(k.source, 'unknown'), '|' ORDER BY COALESCE(k.source, 'unknown')), '') AS sources,
       COALESCE(string_agg(DISTINCT k.key_value, '|' ORDER BY k.key_value) FILTER (WHERE k.key_type = 'device_id'), '') AS device_ids,
       COALESCE(string_agg(DISTINCT k.key_value, '|' ORDER BY k.key_value) FILTER (WHERE k.key_type = 'cookie_id'), '') AS cookie_ids,
       COALESCE(string_agg(DISTINCT k.key_value, '|' ORDER BY k.key_value) FILTER (WHERE k.key_type = 'external_user_id'), '') AS external_user_ids,
       COALESCE(string_agg(DISTINCT k.key_value, '|' ORDER BY k.key_value) FILTER (WHERE k.key_type = 'gclid'), '') AS gclids,
       COALESCE(string_agg(DISTINCT k.key_value, '|' ORDER BY k.key_value) FILTER (WHERE k.key_type = 'fbclid'), '') AS fbclids,
       COALESCE(string_agg(DISTINCT k.key_value, '|' ORDER BY k.key_value) FILTER (WHERE k.key_type = 'ttclid'), '') AS ttclids,
       COALESCE(string_agg(DISTINCT k.key_value, '|' ORDER BY k.key_value) FILTER (WHERE k.key_type = 'msclkid'), '') AS msclkids
     FROM identity_profile_daily_stats ds
     JOIN identity_profiles p ON p.id = ds.identity_profile_id
     LEFT JOIN identity_profile_keys k ON k.identity_profile_id = p.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY p.id, p.canonical_type, p.canonical_value, p.last_country, p.last_region, p.last_city, p.confidence, p.first_seen_at, p.last_seen_at
     ORDER BY COALESCE(SUM(ds.impressions), 0) DESC, p.last_seen_at DESC`,
    params,
  );
  return rows;
}

export async function getWorkspaceIdentityAudienceExport(pool, workspaceId, opts = {}) {
  const {
    dateFrom,
    dateTo,
    canonicalType = '',
    country = '',
    segmentPreset = '',
    minImpressions = 0,
    minClicks = 0,
  } = opts;
  const params = [workspaceId];
  const conditions = ['ds.workspace_id = $1'];

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`ds.date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`ds.date <= $${params.length}`);
  }
  if (canonicalType) {
    params.push(canonicalType);
    conditions.push(`p.canonical_type = $${params.length}`);
  }
  if (country) {
    params.push(country);
    conditions.push(`p.last_country = $${params.length}`);
  }
  appendIdentityScopeExistsCondition(params, conditions, opts);

  params.push(Math.max(Number(minImpressions) || 0, 0));
  const minImpressionsParam = params.length;
  params.push(Math.max(Number(minClicks) || 0, 0));
  const minClicksParam = params.length;
  let presetHavingClause = '';
  if (segmentPreset === 'high_frequency_exposed') {
    presetHavingClause = ' AND COALESCE(SUM(ds.impressions), 0) >= 6';
  } else if (segmentPreset === 'clicked_users') {
    presetHavingClause = ' AND COALESCE(SUM(ds.clicks), 0) >= 1';
  } else if (segmentPreset === 'engaged_non_clickers') {
    presetHavingClause = ' AND COALESCE(SUM(ds.engagements), 0) >= 1 AND COALESCE(SUM(ds.clicks), 0) = 0';
  }

  const { rows } = await pool.query(
    `SELECT
       p.id,
       p.canonical_type,
       p.canonical_value,
       p.last_country,
       p.last_region,
       p.last_city,
       p.confidence,
       p.first_seen_at,
       p.last_seen_at,
       COALESCE(SUM(ds.impressions), 0)::bigint AS impressions,
       COALESCE(SUM(ds.clicks), 0)::bigint AS clicks,
       COALESCE(SUM(ds.engagements), 0)::bigint AS engagements,
       CASE WHEN COALESCE(SUM(ds.impressions), 0) > 0
            THEN ROUND(COALESCE(SUM(ds.clicks), 0)::NUMERIC / SUM(ds.impressions) * 100, 4)
            ELSE 0 END AS ctr,
       COALESCE(string_agg(DISTINCT k.key_type, '|' ORDER BY k.key_type), '') AS key_types,
       COALESCE(string_agg(DISTINCT k.key_value, '|' ORDER BY k.key_value) FILTER (WHERE k.key_type = 'device_id'), '') AS device_ids,
       COALESCE(string_agg(DISTINCT k.key_value, '|' ORDER BY k.key_value) FILTER (WHERE k.key_type = 'cookie_id'), '') AS cookie_ids,
       COALESCE(string_agg(DISTINCT k.key_value, '|' ORDER BY k.key_value) FILTER (WHERE k.key_type = 'external_user_id'), '') AS external_user_ids,
       COALESCE(string_agg(DISTINCT k.key_value, '|' ORDER BY k.key_value) FILTER (WHERE k.key_type = 'gclid'), '') AS gclids,
       COALESCE(string_agg(DISTINCT k.key_value, '|' ORDER BY k.key_value) FILTER (WHERE k.key_type = 'fbclid'), '') AS fbclids,
       COALESCE(string_agg(DISTINCT k.key_value, '|' ORDER BY k.key_value) FILTER (WHERE k.key_type = 'ttclid'), '') AS ttclids,
       COALESCE(string_agg(DISTINCT k.key_value, '|' ORDER BY k.key_value) FILTER (WHERE k.key_type = 'msclkid'), '') AS msclkids
     FROM identity_profile_daily_stats ds
     JOIN identity_profiles p ON p.id = ds.identity_profile_id
     LEFT JOIN identity_profile_keys k ON k.identity_profile_id = p.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY p.id, p.canonical_type, p.canonical_value, p.last_country, p.last_region, p.last_city, p.confidence, p.first_seen_at, p.last_seen_at
     HAVING COALESCE(SUM(ds.impressions), 0) >= $${minImpressionsParam}
        AND COALESCE(SUM(ds.clicks), 0) >= $${minClicksParam}
        ${presetHavingClause}
     ORDER BY COALESCE(SUM(ds.impressions), 0) DESC, p.last_seen_at DESC`,
    params,
  );
  return rows;
}

export async function listSavedAudiences(pool, workspaceId) {
  const { rows } = await pool.query(
    `SELECT
       id,
       name,
       canonical_type,
       country,
       segment_preset,
       activation_template,
       site_domain,
       region,
       city,
       campaign_id,
        tag_id,
        creative_id,
        creative_size_variant_id,
       min_impressions,
       min_clicks,
       status,
       created_at,
       updated_at
     FROM saved_audiences
     WHERE workspace_id = $1
       AND status = 'active'
     ORDER BY created_at DESC, name ASC`,
    [workspaceId],
  );
  return rows;
}

export async function createSavedAudience(pool, workspaceId, payload = {}) {
  const name = normalizeAudienceName(payload.name);
  if (!name) {
    throw new Error('Audience name is required');
  }

  const canonicalType = payload.canonicalType ? String(payload.canonicalType) : null;
  const country = payload.country ? String(payload.country).trim().toUpperCase() : null;
  const segmentPreset = payload.segmentPreset ? String(payload.segmentPreset) : null;
  const activationTemplate = payload.activationTemplate ? String(payload.activationTemplate) : 'full';
  const siteDomain = payload.siteDomain ? String(payload.siteDomain).trim().toLowerCase() : null;
  const region = payload.region ? String(payload.region).trim() : null;
  const city = payload.city ? String(payload.city).trim() : null;
  const campaignId = payload.campaignId ? String(payload.campaignId) : null;
  const tagId = payload.tagId ? String(payload.tagId) : null;
  const creativeId = payload.creativeId ? String(payload.creativeId) : null;
  const variantId = payload.variantId ? String(payload.variantId) : null;
  const minImpressions = Math.max(Number(payload.minImpressions) || 0, 0);
  const minClicks = Math.max(Number(payload.minClicks) || 0, 0);

  const { rows } = await pool.query(
    `INSERT INTO saved_audiences
       (workspace_id, name, canonical_type, country, segment_preset, activation_template, site_domain, region, city, campaign_id, tag_id, creative_id, creative_size_variant_id, min_impressions, min_clicks)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT (workspace_id, name)
     DO UPDATE SET
       canonical_type = EXCLUDED.canonical_type,
       country = EXCLUDED.country,
       segment_preset = EXCLUDED.segment_preset,
       activation_template = EXCLUDED.activation_template,
       site_domain = EXCLUDED.site_domain,
       region = EXCLUDED.region,
       city = EXCLUDED.city,
       campaign_id = EXCLUDED.campaign_id,
       tag_id = EXCLUDED.tag_id,
       creative_id = EXCLUDED.creative_id,
       creative_size_variant_id = EXCLUDED.creative_size_variant_id,
       min_impressions = EXCLUDED.min_impressions,
       min_clicks = EXCLUDED.min_clicks,
       status = 'active',
       updated_at = NOW()
     RETURNING
       id,
       name,
       canonical_type,
       country,
       segment_preset,
       activation_template,
       site_domain,
       region,
       city,
       campaign_id,
       tag_id,
       creative_id,
       creative_size_variant_id,
       min_impressions,
       min_clicks,
       status,
       created_at,
       updated_at`,
    [workspaceId, name, canonicalType, country, segmentPreset, activationTemplate, siteDomain, region, city, campaignId, tagId, creativeId, variantId, minImpressions, minClicks],
  );

  return rows[0] ?? null;
}

export async function deleteSavedAudience(pool, workspaceId, audienceId) {
  const { rowCount } = await pool.query(
    `DELETE FROM saved_audiences
     WHERE workspace_id = $1
       AND id = $2`,
    [workspaceId, audienceId],
  );
  return rowCount > 0;
}

export async function getWorkspaceIdentityKeyBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, canonicalType = '', campaignId = '', tagId = '', creativeId = '', variantId = '', siteDomain = '', region = '', city = '', limit = 25 } = opts;
  const params = [workspaceId];
  const conditions = ['e.workspace_id = $1'];

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`e.created_at >= $${params.length}`);
  }
  if (dateTo) {
    params.push(`${dateTo}T23:59:59.999Z`);
    conditions.push(`e.created_at <= $${params.length}`);
  }
  if (canonicalType) {
    params.push(canonicalType);
    conditions.push(`p.canonical_type = $${params.length}`);
  }
  if (campaignId) {
    params.push(campaignId);
    conditions.push(`EXISTS (
      SELECT 1
      FROM impression_events ie
      LEFT JOIN ad_tags at ON at.id = ie.tag_id
      WHERE e.event_type = 'impression' AND ie.id = e.event_id AND at.campaign_id = $${params.length}
      UNION ALL
      SELECT 1
      FROM click_events ce
      LEFT JOIN ad_tags at ON at.id = ce.tag_id
      WHERE e.event_type = 'click' AND ce.id = e.event_id AND at.campaign_id = $${params.length}
      UNION ALL
      SELECT 1
      FROM engagement_events ge
      LEFT JOIN ad_tags at ON at.id = ge.tag_id
      WHERE e.event_type = 'engagement' AND ge.id = e.event_id AND at.campaign_id = $${params.length}
    )`);
  }
  if (tagId) {
    params.push(tagId);
    conditions.push(`(
      (e.event_type = 'impression' AND EXISTS (SELECT 1 FROM impression_events ie WHERE ie.id = e.event_id AND ie.tag_id = $${params.length}))
      OR (e.event_type = 'click' AND EXISTS (SELECT 1 FROM click_events ce WHERE ce.id = e.event_id AND ce.tag_id = $${params.length}))
      OR (e.event_type = 'engagement' AND EXISTS (SELECT 1 FROM engagement_events ge WHERE ge.id = e.event_id AND ge.tag_id = $${params.length}))
    )`);
  }
  if (creativeId) {
    params.push(creativeId);
    conditions.push(`(
      (e.event_type = 'impression' AND EXISTS (SELECT 1 FROM impression_events ie WHERE ie.id = e.event_id AND ie.creative_id = $${params.length}))
      OR (e.event_type = 'click' AND EXISTS (SELECT 1 FROM click_events ce WHERE ce.id = e.event_id AND ce.creative_id = $${params.length}))
      OR (e.event_type = 'engagement' AND EXISTS (SELECT 1 FROM engagement_events ge WHERE ge.id = e.event_id AND ge.creative_id = $${params.length}))
    )`);
  }
  if (variantId) {
    params.push(variantId);
    conditions.push(`(
      (e.event_type = 'impression' AND EXISTS (SELECT 1 FROM impression_events ie WHERE ie.id = e.event_id AND ie.creative_size_variant_id = $${params.length}))
      OR (e.event_type = 'click' AND EXISTS (SELECT 1 FROM click_events ce WHERE ce.id = e.event_id AND ce.creative_size_variant_id = $${params.length}))
      OR (e.event_type = 'engagement' AND EXISTS (SELECT 1 FROM engagement_events ge WHERE ge.id = e.event_id AND ge.creative_size_variant_id = $${params.length}))
    )`);
  }
  if (siteDomain) {
    params.push(siteDomain);
    conditions.push(`(
      (e.event_type = 'impression' AND EXISTS (SELECT 1 FROM impression_events ie WHERE ie.id = e.event_id AND ie.site_domain = $${params.length}))
      OR (e.event_type = 'click' AND EXISTS (SELECT 1 FROM click_events ce WHERE ce.id = e.event_id AND ce.site_domain = $${params.length}))
      OR (e.event_type = 'engagement' AND EXISTS (SELECT 1 FROM engagement_events ge WHERE ge.id = e.event_id AND ge.site_domain = $${params.length}))
    )`);
  }
  if (region) {
    params.push(region);
    conditions.push(`(
      (e.event_type = 'impression' AND EXISTS (SELECT 1 FROM impression_events ie WHERE ie.id = e.event_id AND ie.region = $${params.length}))
      OR (e.event_type = 'click' AND EXISTS (SELECT 1 FROM click_events ce WHERE ce.id = e.event_id AND ce.region = $${params.length}))
      OR (e.event_type = 'engagement' AND EXISTS (SELECT 1 FROM engagement_events ge WHERE ge.id = e.event_id AND ge.region = $${params.length}))
    )`);
  }
  if (city) {
    params.push(city);
    conditions.push(`(
      (e.event_type = 'impression' AND EXISTS (SELECT 1 FROM impression_events ie WHERE ie.id = e.event_id AND ie.city = $${params.length}))
      OR (e.event_type = 'click' AND EXISTS (SELECT 1 FROM click_events ce WHERE ce.id = e.event_id AND ce.city = $${params.length}))
      OR (e.event_type = 'engagement' AND EXISTS (SELECT 1 FROM engagement_events ge WHERE ge.id = e.event_id AND ge.city = $${params.length}))
    )`);
  }
  params.push(Math.min(Number(limit) || 25, 100));

  const { rows } = await pool.query(
    `SELECT
       e.key_type,
       e.event_type,
       COUNT(*)::bigint AS key_observations,
       COUNT(DISTINCT e.key_value)::bigint AS unique_values,
       COUNT(DISTINCT e.identity_profile_id)::bigint AS identity_count
     FROM event_identity_keys e
     LEFT JOIN identity_profiles p ON p.id = e.identity_profile_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY e.key_type, e.event_type
     ORDER BY COUNT(*) DESC, e.key_type ASC, e.event_type ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function getWorkspaceIdentityAttributionWindows(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, canonicalType = '', campaignId = '', tagId = '', creativeId = '', variantId = '', siteDomain = '', region = '', city = '' } = opts;
  const params = [workspaceId];
  const conditions = ['e.workspace_id = $1', "e.event_type = 'impression'", 'e.identity_profile_id IS NOT NULL'];

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`ie.timestamp >= $${params.length}`);
  }
  if (dateTo) {
    params.push(`${dateTo}T23:59:59.999Z`);
    conditions.push(`ie.timestamp <= $${params.length}`);
  }
  if (canonicalType) {
    params.push(canonicalType);
    conditions.push(`p.canonical_type = $${params.length}`);
  }
  if (campaignId) {
    params.push(campaignId);
    conditions.push(`at.campaign_id = $${params.length}`);
  }
  if (tagId) {
    params.push(tagId);
    conditions.push(`ie.tag_id = $${params.length}`);
  }
  if (creativeId) {
    params.push(creativeId);
    conditions.push(`ie.creative_id = $${params.length}`);
  }
  if (variantId) {
    params.push(variantId);
    conditions.push(`ie.creative_size_variant_id = $${params.length}`);
  }
  if (siteDomain) {
    params.push(siteDomain);
    conditions.push(`ie.site_domain = $${params.length}`);
  }
  if (region) {
    params.push(region);
    conditions.push(`ie.region = $${params.length}`);
  }
  if (city) {
    params.push(city);
    conditions.push(`ie.city = $${params.length}`);
  }

  const { rows } = await pool.query(
    `WITH impression_identities AS (
       SELECT
         e.identity_profile_id,
         MIN(ie.timestamp) AS first_impression_at
       FROM event_identity_keys e
       JOIN impression_events ie ON ie.id = e.event_id
       LEFT JOIN ad_tags at ON at.id = ie.tag_id
       JOIN identity_profiles p ON p.id = e.identity_profile_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY e.identity_profile_id
     ),
     windows AS (
       SELECT 'same_day'::text AS window_key, 'Same day'::text AS label, INTERVAL '1 day' AS window_size, 1 AS sort_order
       UNION ALL
       SELECT '7d'::text AS window_key, '7 days'::text AS label, INTERVAL '7 days' AS window_size, 2 AS sort_order
       UNION ALL
       SELECT '30d'::text AS window_key, '30 days'::text AS label, INTERVAL '30 days' AS window_size, 3 AS sort_order
     )
     SELECT
       w.window_key,
       w.label,
       COUNT(*)::bigint AS exposed_identities,
       COUNT(*) FILTER (
         WHERE EXISTS (
           SELECT 1
           FROM event_identity_keys ec
           JOIN click_events ce ON ce.id = ec.event_id
           WHERE ec.workspace_id = $1
             AND ec.event_type = 'click'
             AND ec.identity_profile_id = ii.identity_profile_id
             AND ce.timestamp >= ii.first_impression_at
             AND ce.timestamp < ii.first_impression_at + w.window_size
         )
       )::bigint AS clicked_identities,
       COUNT(*) FILTER (
         WHERE EXISTS (
           SELECT 1
           FROM event_identity_keys ee
           JOIN engagement_events ge ON ge.id = ee.event_id
           WHERE ee.workspace_id = $1
             AND ee.event_type = 'engagement'
             AND ee.identity_profile_id = ii.identity_profile_id
             AND ge.timestamp >= ii.first_impression_at
             AND ge.timestamp < ii.first_impression_at + w.window_size
         )
       )::bigint AS engaged_identities,
       CASE WHEN COUNT(*) > 0
            THEN ROUND(
              COUNT(*) FILTER (
                WHERE EXISTS (
                  SELECT 1
                  FROM event_identity_keys ec
                  JOIN click_events ce ON ce.id = ec.event_id
                  WHERE ec.workspace_id = $1
                    AND ec.event_type = 'click'
                    AND ec.identity_profile_id = ii.identity_profile_id
                    AND ce.timestamp >= ii.first_impression_at
                    AND ce.timestamp < ii.first_impression_at + w.window_size
                )
              )::NUMERIC / COUNT(*) * 100,
              4
            )
            ELSE 0
       END AS click_through_rate,
       CASE WHEN COUNT(*) > 0
            THEN ROUND(
              COUNT(*) FILTER (
                WHERE EXISTS (
                  SELECT 1
                  FROM event_identity_keys ee
                  JOIN engagement_events ge ON ge.id = ee.event_id
                  WHERE ee.workspace_id = $1
                    AND ee.event_type = 'engagement'
                    AND ee.identity_profile_id = ii.identity_profile_id
                    AND ge.timestamp >= ii.first_impression_at
                    AND ge.timestamp < ii.first_impression_at + w.window_size
                )
              )::NUMERIC / COUNT(*) * 100,
              4
            )
            ELSE 0
       END AS engagement_through_rate
     FROM impression_identities ii
     CROSS JOIN windows w
     GROUP BY w.window_key, w.label, w.sort_order
     ORDER BY w.sort_order ASC`,
    params,
  );
  return rows;
}

export async function getWorkspaceIdentitySegmentPresets(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, canonicalType = '' } = opts;
  const params = [workspaceId];
  const conditions = ['ds.workspace_id = $1'];

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`ds.date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`ds.date <= $${params.length}`);
  }
  if (canonicalType) {
    params.push(canonicalType);
    conditions.push(`p.canonical_type = $${params.length}`);
  }
  appendIdentityScopeExistsCondition(params, conditions, opts);

  const { rows } = await pool.query(
    `WITH identity_totals AS (
       SELECT
         p.id,
         COALESCE(SUM(ds.impressions), 0)::bigint AS impressions,
         COALESCE(SUM(ds.clicks), 0)::bigint AS clicks,
         COALESCE(SUM(ds.engagements), 0)::bigint AS engagements
       FROM identity_profile_daily_stats ds
       JOIN identity_profiles p ON p.id = ds.identity_profile_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY p.id
     )
     SELECT
       preset,
       label,
       identity_count,
       impressions,
       clicks,
       engagements
     FROM (
       SELECT
         'high_frequency_exposed'::text AS preset,
         'High-frequency exposed'::text AS label,
         COUNT(*) FILTER (WHERE impressions >= 6)::bigint AS identity_count,
         COALESCE(SUM(impressions) FILTER (WHERE impressions >= 6), 0)::bigint AS impressions,
         COALESCE(SUM(clicks) FILTER (WHERE impressions >= 6), 0)::bigint AS clicks,
         COALESCE(SUM(engagements) FILTER (WHERE impressions >= 6), 0)::bigint AS engagements
       FROM identity_totals
       UNION ALL
       SELECT
         'clicked_users'::text AS preset,
         'Clicked users'::text AS label,
         COUNT(*) FILTER (WHERE clicks >= 1)::bigint AS identity_count,
         COALESCE(SUM(impressions) FILTER (WHERE clicks >= 1), 0)::bigint AS impressions,
         COALESCE(SUM(clicks) FILTER (WHERE clicks >= 1), 0)::bigint AS clicks,
         COALESCE(SUM(engagements) FILTER (WHERE clicks >= 1), 0)::bigint AS engagements
       FROM identity_totals
       UNION ALL
       SELECT
         'engaged_non_clickers'::text AS preset,
         'Engaged non-clickers'::text AS label,
         COUNT(*) FILTER (WHERE engagements >= 1 AND clicks = 0)::bigint AS identity_count,
         COALESCE(SUM(impressions) FILTER (WHERE engagements >= 1 AND clicks = 0), 0)::bigint AS impressions,
         COALESCE(SUM(clicks) FILTER (WHERE engagements >= 1 AND clicks = 0), 0)::bigint AS clicks,
         COALESCE(SUM(engagements) FILTER (WHERE engagements >= 1 AND clicks = 0), 0)::bigint AS engagements
       FROM identity_totals
     ) presets`,
    params,
  );
  return rows;
}

export async function getWorkspaceIdentityFrequencyBuckets(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, canonicalType = '' } = opts;
  const params = [workspaceId];
  const conditions = ['ds.workspace_id = $1'];

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`ds.date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`ds.date <= $${params.length}`);
  }
  if (canonicalType) {
    params.push(canonicalType);
    conditions.push(`p.canonical_type = $${params.length}`);
  }
  appendIdentityScopeExistsCondition(params, conditions, opts);

  const { rows } = await pool.query(
    `WITH identity_totals AS (
       SELECT
         p.id,
         p.canonical_type,
         COALESCE(SUM(ds.impressions), 0)::bigint AS impressions,
         COALESCE(SUM(ds.clicks), 0)::bigint AS clicks,
         COALESCE(SUM(ds.engagements), 0)::bigint AS engagements
       FROM identity_profile_daily_stats ds
       JOIN identity_profiles p ON p.id = ds.identity_profile_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY p.id, p.canonical_type
     )
     SELECT
       bucket_label,
       MIN(bucket_order)::int AS bucket_order,
       COUNT(*)::bigint AS identity_count,
       COALESCE(SUM(impressions), 0)::bigint AS impressions,
       COALESCE(SUM(clicks), 0)::bigint AS clicks,
       COALESCE(SUM(engagements), 0)::bigint AS engagements,
       CASE WHEN COALESCE(SUM(impressions), 0) > 0
            THEN ROUND(COALESCE(SUM(clicks), 0)::NUMERIC / SUM(impressions) * 100, 4)
            ELSE 0 END AS ctr
     FROM (
       SELECT
         id,
         impressions,
         clicks,
         engagements,
         CASE
           WHEN impressions <= 1 THEN '1'
           WHEN impressions BETWEEN 2 AND 3 THEN '2-3'
           WHEN impressions BETWEEN 4 AND 5 THEN '4-5'
           WHEN impressions BETWEEN 6 AND 10 THEN '6-10'
           ELSE '11+'
         END AS bucket_label,
         CASE
           WHEN impressions <= 1 THEN 1
           WHEN impressions BETWEEN 2 AND 3 THEN 2
           WHEN impressions BETWEEN 4 AND 5 THEN 3
           WHEN impressions BETWEEN 6 AND 10 THEN 4
           ELSE 5
         END AS bucket_order
       FROM identity_totals
     ) bucketed
     GROUP BY bucket_label
     ORDER BY bucket_order ASC`,
    params,
  );
  return rows;
}

export async function recordImpression(pool, data) {
  const {
    impression_id = null,
    tag_id, workspace_id, creative_id = null,
    creative_size_variant_id = null,
    ip = null, user_agent = null, country = null, region = null, city = null,
    referer = null, viewable = null,
    viewability_status = 'unmeasured',
    viewability_method = null,
    viewability_duration_ms = null,
    site_domain = null, page_url = null, device_type = null, browser = null, os = null,
    device_model = null,
    device_id = null, cookie_id = null,
    contextual_ids = null, network_id = null, source_publisher_id = null,
    app_id = null, site_id = null, exchange_id = null, exchange_publisher_id = null,
    exchange_site_id_or_domain = null, app_bundle = null, app_name = null,
    page_position = null, content_language = null, content_title = null, content_series = null,
    carrier = null, app_store_name = null, content_genre = null,
    identity_keys = [],
    timestamp = new Date(),
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO impression_events
       (id, tag_id, workspace_id, creative_id, creative_size_variant_id, ip, user_agent, country, region, city, referer, viewable, viewability_status, viewability_method, viewability_duration_ms, timestamp, site_domain, page_url, device_type, browser, os, device_model, device_id, cookie_id, contextual_ids, network_id, source_publisher_id, app_id, site_id, exchange_id, exchange_publisher_id, exchange_site_id_or_domain, app_bundle, app_name, page_position, content_language, content_title, content_series, carrier, app_store_name, content_genre)
     VALUES (COALESCE($1::uuid, gen_random_uuid()),$2,$3,$4,$5,$6::inet,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42)
     RETURNING id, tag_id, workspace_id, timestamp`,
    [impression_id, tag_id, workspace_id, creative_id, creative_size_variant_id, ip, user_agent, country, region, city,
     referer, viewable, viewability_status, viewability_method, viewability_duration_ms, timestamp, site_domain, page_url, device_type, browser, os, device_model, device_id, cookie_id, contextual_ids, network_id, source_publisher_id, app_id, site_id, exchange_id, exchange_publisher_id, exchange_site_id_or_domain, app_bundle, app_name, page_position, content_language, content_title, content_series, carrier, app_store_name, content_genre],
  );
  const event = rows[0];
  await recordEventIdentityKeys(pool, {
    workspace_id,
    event_type: 'impression',
    event_id: event.id,
    identity_keys,
    country,
    region,
    city,
    timestamp,
  });

  const date = new Date(timestamp).toISOString().slice(0, 10);

  await pool.query(
    `INSERT INTO tag_daily_stats (tag_id, date, impressions)
     VALUES ($1, $2, 1)
     ON CONFLICT (tag_id, date)
     DO UPDATE SET impressions = tag_daily_stats.impressions + 1, updated_at = NOW()`,
    [tag_id, date],
  );

  if (site_domain) {
    await pool.query(
      `INSERT INTO tag_site_daily_stats (tag_id, date, site_domain, impressions)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (tag_id, date, site_domain)
       DO UPDATE SET impressions = tag_site_daily_stats.impressions + 1, updated_at = NOW()`,
      [tag_id, date, site_domain],
    );
  }

  if (country) {
    await pool.query(
      `INSERT INTO tag_country_daily_stats (tag_id, date, country, impressions)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (tag_id, date, country)
       DO UPDATE SET impressions = tag_country_daily_stats.impressions + 1, updated_at = NOW()`,
      [tag_id, date, country],
    );
  }

  if (region) {
    await pool.query(
      `INSERT INTO tag_region_daily_stats (tag_id, date, region, impressions)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (tag_id, date, region)
       DO UPDATE SET impressions = tag_region_daily_stats.impressions + 1, updated_at = NOW()`,
      [tag_id, date, region],
    );
  }

  if (city) {
    await pool.query(
      `INSERT INTO tag_city_daily_stats (tag_id, date, city, impressions)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (tag_id, date, city)
       DO UPDATE SET impressions = tag_city_daily_stats.impressions + 1, updated_at = NOW()`,
      [tag_id, date, city],
    );
  }

  if (creative_size_variant_id) {
    await pool.query(
      `INSERT INTO creative_variant_daily_stats (creative_size_variant_id, date, impressions)
       VALUES ($1, $2, 1)
       ON CONFLICT (creative_size_variant_id, date)
       DO UPDATE SET impressions = creative_variant_daily_stats.impressions + 1, updated_at = NOW()`,
      [creative_size_variant_id, date],
    );
  }
  return event;
}

export async function recordClick(pool, data) {
  const {
    tag_id, workspace_id, creative_id = null, impression_id = null,
    creative_size_variant_id = null,
    ip = null, user_agent = null, country = null, region = null, city = null,
    referer = null, redirect_url = null,
    site_domain = null, page_url = null, device_type = null, browser = null, os = null,
    device_model = null, device_id = null, cookie_id = null,
    contextual_ids = null, network_id = null, source_publisher_id = null,
    app_id = null, site_id = null, exchange_id = null, exchange_publisher_id = null,
    exchange_site_id_or_domain = null, app_bundle = null, app_name = null,
    page_position = null, content_language = null, content_title = null, content_series = null,
    carrier = null, app_store_name = null, content_genre = null,
    dsp_provider = null,
    identity_keys = [],
    timestamp = new Date(),
  } = data;

  const canDedupeClick = Boolean(impression_id || cookie_id || device_id || ip);
  if (canDedupeClick) {
    const { rows: existingRows } = await pool.query(
      `SELECT id, tag_id, workspace_id, timestamp
       FROM click_events
       WHERE tag_id = $1
         AND workspace_id = $2
         AND creative_id IS NOT DISTINCT FROM $3
         AND creative_size_variant_id IS NOT DISTINCT FROM $4
         AND redirect_url IS NOT DISTINCT FROM $5
         AND timestamp >= ($6::timestamptz - INTERVAL '2 seconds')
         AND (
           ($7::uuid IS NOT NULL AND impression_id IS NOT DISTINCT FROM $7)
           OR ($8::text IS NOT NULL AND cookie_id IS NOT DISTINCT FROM $8::text)
           OR ($9::text IS NOT NULL AND device_id IS NOT DISTINCT FROM $9::text)
           OR ($10::inet IS NOT NULL AND ip IS NOT DISTINCT FROM $10::inet)
         )
       ORDER BY timestamp DESC
       LIMIT 1`,
      [
        tag_id,
        workspace_id,
        creative_id,
        creative_size_variant_id,
        redirect_url,
        timestamp,
        impression_id,
        cookie_id,
        device_id,
        ip,
      ],
    );

    if (existingRows.length) {
      return existingRows[0];
    }
  }

  const canDedupeIlluminBounce =
    String(dsp_provider ?? '').trim().toLowerCase() === 'illumin'
    && redirect_url
    && !impression_id;
  if (canDedupeIlluminBounce) {
    const { rows: illuminRows } = await pool.query(
      `SELECT id, tag_id, workspace_id, timestamp
       FROM click_events
       WHERE tag_id = $1
         AND workspace_id = $2
         AND creative_id IS NOT DISTINCT FROM $3
         AND creative_size_variant_id IS NOT DISTINCT FROM $4
         AND redirect_url IS NOT DISTINCT FROM $5
         AND timestamp >= ($6::timestamptz - INTERVAL '1 second')
       ORDER BY timestamp DESC
       LIMIT 1`,
      [
        tag_id,
        workspace_id,
        creative_id,
        creative_size_variant_id,
        redirect_url,
        timestamp,
      ],
    );

    if (illuminRows.length) {
      return illuminRows[0];
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO click_events
       (tag_id, workspace_id, creative_id, creative_size_variant_id, impression_id, ip, user_agent,
        country, region, city, referer, redirect_url, timestamp, site_domain, page_url, device_type, browser, os, device_model, device_id, cookie_id, contextual_ids, network_id, source_publisher_id, app_id, site_id, exchange_id, exchange_publisher_id, exchange_site_id_or_domain, app_bundle, app_name, page_position, content_language, content_title, content_series, carrier, app_store_name, content_genre)
     VALUES ($1,$2,$3,$4,$5,$6::inet,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39)
     RETURNING id, tag_id, workspace_id, timestamp`,
    [tag_id, workspace_id, creative_id, creative_size_variant_id, impression_id, ip, user_agent,
     country, region, city, referer, redirect_url, timestamp, site_domain, page_url, device_type, browser, os, device_model, device_id, cookie_id, contextual_ids, network_id, source_publisher_id, app_id, site_id, exchange_id, exchange_publisher_id, exchange_site_id_or_domain, app_bundle, app_name, page_position, content_language, content_title, content_series, carrier, app_store_name, content_genre],
  );
  const event = rows[0];
  await recordEventIdentityKeys(pool, {
    workspace_id,
    event_type: 'click',
    event_id: event.id,
    identity_keys,
    country,
    region,
    city,
    timestamp,
  });

  const date = new Date(timestamp).toISOString().slice(0, 10);

  await pool.query(
    `INSERT INTO tag_daily_stats (tag_id, date, clicks)
     VALUES ($1, $2, 1)
     ON CONFLICT (tag_id, date)
     DO UPDATE SET clicks = tag_daily_stats.clicks + 1, updated_at = NOW()`,
    [tag_id, date],
  );

  if (site_domain) {
    await pool.query(
      `INSERT INTO tag_site_daily_stats (tag_id, date, site_domain, clicks)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (tag_id, date, site_domain)
       DO UPDATE SET clicks = tag_site_daily_stats.clicks + 1, updated_at = NOW()`,
      [tag_id, date, site_domain],
    );
  }

  if (country) {
    await pool.query(
      `INSERT INTO tag_country_daily_stats (tag_id, date, country, clicks)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (tag_id, date, country)
       DO UPDATE SET clicks = tag_country_daily_stats.clicks + 1, updated_at = NOW()`,
      [tag_id, date, country],
    );
  }

  if (region) {
    await pool.query(
      `INSERT INTO tag_region_daily_stats (tag_id, date, region, clicks)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (tag_id, date, region)
       DO UPDATE SET clicks = tag_region_daily_stats.clicks + 1, updated_at = NOW()`,
      [tag_id, date, region],
    );
  }

  if (city) {
    await pool.query(
      `INSERT INTO tag_city_daily_stats (tag_id, date, city, clicks)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (tag_id, date, city)
       DO UPDATE SET clicks = tag_city_daily_stats.clicks + 1, updated_at = NOW()`,
      [tag_id, date, city],
    );
  }

  if (creative_size_variant_id) {
    await pool.query(
      `INSERT INTO creative_variant_daily_stats (creative_size_variant_id, date, clicks)
       VALUES ($1, $2, 1)
       ON CONFLICT (creative_size_variant_id, date)
       DO UPDATE SET clicks = creative_variant_daily_stats.clicks + 1, updated_at = NOW()`,
      [creative_size_variant_id, date],
    );
  }
  return event;
}

export async function recordViewability(pool, data) {
  const {
    tag_id,
    workspace_id,
    impression_id,
    state = 'viewable',
    viewable = true,
    method = null,
    duration_ms = null,
  } = data;

  let impression = null;
  let previousStatus = null;
  if (impression_id) {
    const { rows } = await pool.query(
      `SELECT id, site_domain, country, region, city, timestamp, creative_size_variant_id, viewability_status
       FROM impression_events
       WHERE id = $1 AND tag_id = $2
       LIMIT 1`,
      [impression_id, tag_id],
    );
    impression = rows[0] ?? null;
    previousStatus = impression?.viewability_status ?? null;
  }

  const nextStatus =
    state === 'undetermined' ? 'undetermined'
      : state === 'measured' ? 'measured'
        : 'viewable';
  const wasUnseen = previousStatus === 'unmeasured' || previousStatus === null;
  const shouldCountMeasured = nextStatus !== 'undetermined' && wasUnseen;
  const shouldCountUndetermined = nextStatus === 'undetermined' && previousStatus !== 'undetermined';
  const shouldCountViewable = nextStatus === 'viewable' && previousStatus !== 'viewable';

  if (impression_id) {
    await pool.query(
      `UPDATE impression_events
       SET viewable = $1,
           viewability_status = $2,
           viewability_method = COALESCE($3, viewability_method),
           viewability_duration_ms = COALESCE($4, viewability_duration_ms)
       WHERE id = $5 AND tag_id = $6`,
      [nextStatus === 'viewable' ? Boolean(viewable) : false, nextStatus, method, duration_ms, impression_id, tag_id],
    );
  }

  const date = new Date(impression?.timestamp ?? new Date()).toISOString().slice(0, 10);
  const siteDomain = impression?.site_domain ?? null;
  const country = impression?.country ?? null;
  const region = impression?.region ?? null;
  const city = impression?.city ?? null;
  const variantId = impression?.creative_size_variant_id ?? null;

  if (shouldCountMeasured) {
    await pool.query(
      `INSERT INTO tag_daily_stats (tag_id, date, measured_imps)
       VALUES ($1, $2, 1)
       ON CONFLICT (tag_id, date)
       DO UPDATE SET measured_imps = tag_daily_stats.measured_imps + 1, updated_at = NOW()`,
      [tag_id, date],
    );

    if (siteDomain) {
      await pool.query(
        `INSERT INTO tag_site_daily_stats (tag_id, date, site_domain, measured_imps)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (tag_id, date, site_domain)
         DO UPDATE SET measured_imps = tag_site_daily_stats.measured_imps + 1, updated_at = NOW()`,
        [tag_id, date, siteDomain],
      );
    }

    if (country) {
      await pool.query(
        `INSERT INTO tag_country_daily_stats (tag_id, date, country, measured_imps)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (tag_id, date, country)
         DO UPDATE SET measured_imps = tag_country_daily_stats.measured_imps + 1, updated_at = NOW()`,
        [tag_id, date, country],
      );
    }

    if (region) {
      await pool.query(
        `INSERT INTO tag_region_daily_stats (tag_id, date, region, measured_imps)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (tag_id, date, region)
         DO UPDATE SET measured_imps = tag_region_daily_stats.measured_imps + 1, updated_at = NOW()`,
        [tag_id, date, region],
      );
    }

    if (city) {
      await pool.query(
        `INSERT INTO tag_city_daily_stats (tag_id, date, city, measured_imps)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (tag_id, date, city)
         DO UPDATE SET measured_imps = tag_city_daily_stats.measured_imps + 1, updated_at = NOW()`,
        [tag_id, date, city],
      );
    }

    if (variantId) {
      await pool.query(
        `INSERT INTO creative_variant_daily_stats (creative_size_variant_id, date, measured_imps)
         VALUES ($1, $2, 1)
         ON CONFLICT (creative_size_variant_id, date)
         DO UPDATE SET measured_imps = creative_variant_daily_stats.measured_imps + 1, updated_at = NOW()`,
        [variantId, date],
      );
    }
  }

  if (shouldCountUndetermined) {
    await pool.query(
      `INSERT INTO tag_daily_stats (tag_id, date, undetermined_imps)
       VALUES ($1, $2, 1)
       ON CONFLICT (tag_id, date)
       DO UPDATE SET undetermined_imps = tag_daily_stats.undetermined_imps + 1, updated_at = NOW()`,
      [tag_id, date],
    );

    if (siteDomain) {
      await pool.query(
        `INSERT INTO tag_site_daily_stats (tag_id, date, site_domain, undetermined_imps)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (tag_id, date, site_domain)
         DO UPDATE SET undetermined_imps = tag_site_daily_stats.undetermined_imps + 1, updated_at = NOW()`,
        [tag_id, date, siteDomain],
      );
    }

    if (country) {
      await pool.query(
        `INSERT INTO tag_country_daily_stats (tag_id, date, country, undetermined_imps)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (tag_id, date, country)
         DO UPDATE SET undetermined_imps = tag_country_daily_stats.undetermined_imps + 1, updated_at = NOW()`,
        [tag_id, date, country],
      );
    }

    if (region) {
      await pool.query(
        `INSERT INTO tag_region_daily_stats (tag_id, date, region, undetermined_imps)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (tag_id, date, region)
         DO UPDATE SET undetermined_imps = tag_region_daily_stats.undetermined_imps + 1, updated_at = NOW()`,
        [tag_id, date, region],
      );
    }

    if (city) {
      await pool.query(
        `INSERT INTO tag_city_daily_stats (tag_id, date, city, undetermined_imps)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (tag_id, date, city)
         DO UPDATE SET undetermined_imps = tag_city_daily_stats.undetermined_imps + 1, updated_at = NOW()`,
        [tag_id, date, city],
      );
    }

    if (variantId) {
      await pool.query(
        `INSERT INTO creative_variant_daily_stats (creative_size_variant_id, date, undetermined_imps)
         VALUES ($1, $2, 1)
         ON CONFLICT (creative_size_variant_id, date)
         DO UPDATE SET undetermined_imps = creative_variant_daily_stats.undetermined_imps + 1, updated_at = NOW()`,
        [variantId, date],
      );
    }
  }

  if (shouldCountViewable) {
    await pool.query(
      `INSERT INTO tag_daily_stats (tag_id, date, viewable_imps)
       VALUES ($1, $2, 1)
       ON CONFLICT (tag_id, date)
       DO UPDATE SET viewable_imps = tag_daily_stats.viewable_imps + 1, updated_at = NOW()`,
      [tag_id, date],
    );

    if (siteDomain) {
      await pool.query(
        `INSERT INTO tag_site_daily_stats (tag_id, date, site_domain, viewable_imps)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (tag_id, date, site_domain)
         DO UPDATE SET viewable_imps = tag_site_daily_stats.viewable_imps + 1, updated_at = NOW()`,
        [tag_id, date, siteDomain],
      );
    }

    if (country) {
      await pool.query(
        `INSERT INTO tag_country_daily_stats (tag_id, date, country, viewable_imps)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (tag_id, date, country)
         DO UPDATE SET viewable_imps = tag_country_daily_stats.viewable_imps + 1, updated_at = NOW()`,
        [tag_id, date, country],
      );
    }

    if (region) {
      await pool.query(
        `INSERT INTO tag_region_daily_stats (tag_id, date, region, viewable_imps)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (tag_id, date, region)
         DO UPDATE SET viewable_imps = tag_region_daily_stats.viewable_imps + 1, updated_at = NOW()`,
        [tag_id, date, region],
      );
    }

    if (city) {
      await pool.query(
        `INSERT INTO tag_city_daily_stats (tag_id, date, city, viewable_imps)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (tag_id, date, city)
         DO UPDATE SET viewable_imps = tag_city_daily_stats.viewable_imps + 1, updated_at = NOW()`,
        [tag_id, date, city],
      );
    }

    if (variantId) {
      await pool.query(
        `INSERT INTO creative_variant_daily_stats (creative_size_variant_id, date, viewable_imps)
         VALUES ($1, $2, 1)
         ON CONFLICT (creative_size_variant_id, date)
         DO UPDATE SET viewable_imps = creative_variant_daily_stats.viewable_imps + 1, updated_at = NOW()`,
        [variantId, date],
      );
    }
  }

  return { tag_id, workspace_id, impression_id, viewable, state: nextStatus };
}

export async function recordEngagementEvent(pool, data) {
  const {
    tag_id,
    workspace_id,
    creative_id = null,
    creative_size_variant_id = null,
    impression_id = null,
    event_type,
    ip = null,
    user_agent = null,
    country = null,
    region = null,
    city = null,
    referer = null,
    site_domain = null,
    page_url = null,
    device_type = null,
    browser = null,
    os = null,
    device_id = null,
    cookie_id = null,
    identity_keys = [],
    hover_duration_ms = null,
    metadata = {},
    timestamp = new Date(),
  } = data;

  if (!event_type) {
    throw new Error('event_type is required');
  }

  const { rows } = await pool.query(
    `INSERT INTO engagement_events
       (tag_id, workspace_id, creative_id, creative_size_variant_id, impression_id, event_type,
        ip, user_agent, country, region, city, referer, site_domain, page_url, device_type, browser, os,
        device_id, cookie_id, hover_duration_ms, metadata, timestamp)
     VALUES ($1,$2,$3,$4,$5,$6,$7::inet,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     RETURNING id, tag_id, workspace_id, event_type, timestamp`,
    [
      tag_id,
      workspace_id,
      creative_id,
      creative_size_variant_id,
      impression_id,
      event_type,
      ip,
      user_agent,
      country,
      region,
      city,
      referer,
      site_domain,
      page_url,
      device_type,
      browser,
      os,
      device_id,
      cookie_id,
      hover_duration_ms,
      JSON.stringify(metadata ?? {}),
      timestamp,
    ],
  );
  const event = rows[0];
  await recordEventIdentityKeys(pool, {
    workspace_id,
    event_type: 'engagement',
    event_id: event.id,
    identity_keys,
    country,
    region,
    city,
    timestamp,
  });

  const date = new Date(timestamp).toISOString().slice(0, 10);
  await pool.query(
    `INSERT INTO tag_engagement_daily_stats (tag_id, date, event_type, event_count, total_duration_ms)
     VALUES ($1, $2, $3, 1, $4)
     ON CONFLICT (tag_id, date, event_type)
     DO UPDATE SET
       event_count = tag_engagement_daily_stats.event_count + 1,
       total_duration_ms = tag_engagement_daily_stats.total_duration_ms + EXCLUDED.total_duration_ms,
       updated_at = NOW()`,
    [tag_id, date, event_type, Math.max(0, Number(hover_duration_ms) || 0)],
  );

  return event;
}

export async function getImpressionStats(pool, tagId, opts = {}) {
  const {
    dateFrom, dateTo, groupBy = 'day', limit = 30,
  } = opts;

  const params = [tagId];
  const conditions = ['tag_id = $1'];

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`timestamp >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`timestamp <= $${params.length}`);
  }

  const truncUnit = groupBy === 'hour' ? 'hour' : groupBy === 'week' ? 'week' : 'day';
  params.push(Math.min(Number(limit) || 30, 90));

  const { rows } = await pool.query(
    `SELECT date_trunc('${truncUnit}', timestamp) AS period,
            COUNT(*) AS impressions,
            COUNT(DISTINCT ip) AS unique_ips,
            COUNT(CASE WHEN viewable = TRUE THEN 1 END) AS viewable_imps
     FROM impression_events
     WHERE ${conditions.join(' AND ')}
     GROUP BY period
     ORDER BY period DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function getWorkspaceSiteBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, limit = 25, campaignId = '', tagId = '' } = opts;
  const params = [workspaceId];
  const conditions = ['t.workspace_id = $1'];
  const identityConditions = ['ie.workspace_id = $1', 'ie.site_domain IS NOT DISTINCT FROM ds.site_domain', "e.event_type = 'impression'", 'e.identity_profile_id IS NOT NULL'];
  if (campaignId) {
    params.push(campaignId);
    conditions.push(`t.campaign_id = $${params.length}`);
    identityConditions.push(`EXISTS (SELECT 1 FROM ad_tags t2 WHERE t2.id = ie.tag_id AND t2.workspace_id = ie.workspace_id AND t2.campaign_id = $${params.length})`);
  }
  if (tagId) {
    params.push(tagId);
    conditions.push(`t.id = $${params.length}`);
    identityConditions.push(`ie.tag_id = $${params.length}`);
  }

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`ds.date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`ds.date <= $${params.length}`);
  }

  const identityDateParamStart = params.length + 1;
  if (dateFrom) {
    params.push(dateFrom);
    identityConditions.push(`ie.timestamp >= $${identityDateParamStart}::timestamptz`);
  }
  if (dateTo) {
    params.push(`${dateTo}T23:59:59.999Z`);
    identityConditions.push(`ie.timestamp <= $${dateFrom ? identityDateParamStart + 1 : identityDateParamStart}::timestamptz`);
  }
  params.push(Math.min(Number(limit) || 25, 100));

  const { rows } = await pool.query(
    `SELECT ds.site_domain,
            SUM(ds.impressions) AS impressions,
            SUM(ds.clicks) AS clicks,
            SUM(ds.viewable_imps) AS viewable_imps,
            SUM(ds.measured_imps) AS measured_imps,
            SUM(ds.undetermined_imps) AS undetermined_imps,
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
            CASE WHEN SUM(ds.impressions) > 0
                 THEN ROUND(SUM(ds.clicks)::NUMERIC / SUM(ds.impressions) * 100, 4)
                 ELSE 0 END AS ctr,
            CASE WHEN SUM(ds.impressions) > 0
                 THEN ROUND(SUM(ds.measured_imps)::NUMERIC / SUM(ds.impressions) * 100, 4)
                 ELSE 0 END AS measurable_rate,
            CASE WHEN SUM(ds.measured_imps) > 0
                 THEN ROUND(SUM(ds.viewable_imps)::NUMERIC / SUM(ds.measured_imps) * 100, 4)
                 ELSE 0 END AS viewability_rate
     FROM tag_site_daily_stats ds
     JOIN ad_tags t ON t.id = ds.tag_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY ds.site_domain
     ORDER BY SUM(ds.impressions) DESC, ds.site_domain ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function getWorkspaceCountryBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, limit = 25, campaignId = '', tagId = '' } = opts;
  const params = [workspaceId];
  const conditions = ['t.workspace_id = $1'];
  const identityConditions = ['ie.workspace_id = $1', 'ie.country IS NOT DISTINCT FROM ds.country', "e.event_type = 'impression'", 'e.identity_profile_id IS NOT NULL'];
  if (campaignId) {
    params.push(campaignId);
    conditions.push(`t.campaign_id = $${params.length}`);
    identityConditions.push(`EXISTS (SELECT 1 FROM ad_tags t2 WHERE t2.id = ie.tag_id AND t2.workspace_id = ie.workspace_id AND t2.campaign_id = $${params.length})`);
  }
  if (tagId) {
    params.push(tagId);
    conditions.push(`t.id = $${params.length}`);
    identityConditions.push(`ie.tag_id = $${params.length}`);
  }

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`ds.date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`ds.date <= $${params.length}`);
  }

  const identityDateParamStart = params.length + 1;
  if (dateFrom) {
    params.push(dateFrom);
    identityConditions.push(`ie.timestamp >= $${identityDateParamStart}::timestamptz`);
  }
  if (dateTo) {
    params.push(`${dateTo}T23:59:59.999Z`);
    identityConditions.push(`ie.timestamp <= $${dateFrom ? identityDateParamStart + 1 : identityDateParamStart}::timestamptz`);
  }
  params.push(Math.min(Number(limit) || 25, 100));

  const { rows } = await pool.query(
    `SELECT ds.country,
            SUM(ds.impressions) AS impressions,
            SUM(ds.clicks) AS clicks,
            SUM(ds.viewable_imps) AS viewable_imps,
            SUM(ds.measured_imps) AS measured_imps,
            SUM(ds.undetermined_imps) AS undetermined_imps,
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
            CASE WHEN SUM(ds.impressions) > 0
                 THEN ROUND(SUM(ds.clicks)::NUMERIC / SUM(ds.impressions) * 100, 4)
                 ELSE 0 END AS ctr,
            CASE WHEN SUM(ds.impressions) > 0
                 THEN ROUND(SUM(ds.measured_imps)::NUMERIC / SUM(ds.impressions) * 100, 4)
                 ELSE 0 END AS measurable_rate,
            CASE WHEN SUM(ds.measured_imps) > 0
                 THEN ROUND(SUM(ds.viewable_imps)::NUMERIC / SUM(ds.measured_imps) * 100, 4)
                 ELSE 0 END AS viewability_rate
     FROM tag_country_daily_stats ds
     JOIN ad_tags t ON t.id = ds.tag_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY ds.country
     ORDER BY SUM(ds.impressions) DESC, ds.country ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function getWorkspaceRegionBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, limit = 25, campaignId = '', tagId = '' } = opts;
  const params = [workspaceId];
  const conditions = ['t.workspace_id = $1'];
  const identityConditions = ['ie.workspace_id = $1', 'ie.region IS NOT DISTINCT FROM ds.region', "e.event_type = 'impression'", 'e.identity_profile_id IS NOT NULL'];
  if (campaignId) {
    params.push(campaignId);
    conditions.push(`t.campaign_id = $${params.length}`);
    identityConditions.push(`EXISTS (SELECT 1 FROM ad_tags t2 WHERE t2.id = ie.tag_id AND t2.workspace_id = ie.workspace_id AND t2.campaign_id = $${params.length})`);
  }
  if (tagId) {
    params.push(tagId);
    conditions.push(`t.id = $${params.length}`);
    identityConditions.push(`ie.tag_id = $${params.length}`);
  }

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`ds.date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`ds.date <= $${params.length}`);
  }

  const identityDateParamStart = params.length + 1;
  if (dateFrom) {
    params.push(dateFrom);
    identityConditions.push(`ie.timestamp >= $${identityDateParamStart}::timestamptz`);
  }
  if (dateTo) {
    params.push(`${dateTo}T23:59:59.999Z`);
    identityConditions.push(`ie.timestamp <= $${dateFrom ? identityDateParamStart + 1 : identityDateParamStart}::timestamptz`);
  }
  params.push(Math.min(Number(limit) || 25, 100));

  const { rows } = await pool.query(
    `SELECT ds.region,
            SUM(ds.impressions) AS impressions,
            SUM(ds.clicks) AS clicks,
            SUM(ds.viewable_imps) AS viewable_imps,
            SUM(ds.measured_imps) AS measured_imps,
            SUM(ds.undetermined_imps) AS undetermined_imps,
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
            CASE WHEN SUM(ds.impressions) > 0
                 THEN ROUND(SUM(ds.clicks)::NUMERIC / SUM(ds.impressions) * 100, 4)
                 ELSE 0 END AS ctr,
            CASE WHEN SUM(ds.impressions) > 0
                 THEN ROUND(SUM(ds.measured_imps)::NUMERIC / SUM(ds.impressions) * 100, 4)
                 ELSE 0 END AS measurable_rate,
            CASE WHEN SUM(ds.measured_imps) > 0
                 THEN ROUND(SUM(ds.viewable_imps)::NUMERIC / SUM(ds.measured_imps) * 100, 4)
                 ELSE 0 END AS viewability_rate
     FROM tag_region_daily_stats ds
     JOIN ad_tags t ON t.id = ds.tag_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY ds.region
     ORDER BY SUM(ds.impressions) DESC, ds.region ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function getWorkspaceCityBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, limit = 25, campaignId = '', tagId = '' } = opts;
  const params = [workspaceId];
  const conditions = ['t.workspace_id = $1'];
  const identityConditions = ['ie.workspace_id = $1', 'ie.city IS NOT DISTINCT FROM ds.city', "e.event_type = 'impression'", 'e.identity_profile_id IS NOT NULL'];
  if (campaignId) {
    params.push(campaignId);
    conditions.push(`t.campaign_id = $${params.length}`);
    identityConditions.push(`EXISTS (SELECT 1 FROM ad_tags t2 WHERE t2.id = ie.tag_id AND t2.workspace_id = ie.workspace_id AND t2.campaign_id = $${params.length})`);
  }
  if (tagId) {
    params.push(tagId);
    conditions.push(`t.id = $${params.length}`);
    identityConditions.push(`ie.tag_id = $${params.length}`);
  }

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`ds.date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`ds.date <= $${params.length}`);
  }

  const identityDateParamStart = params.length + 1;
  if (dateFrom) {
    params.push(dateFrom);
    identityConditions.push(`ie.timestamp >= $${identityDateParamStart}::timestamptz`);
  }
  if (dateTo) {
    params.push(`${dateTo}T23:59:59.999Z`);
    identityConditions.push(`ie.timestamp <= $${dateFrom ? identityDateParamStart + 1 : identityDateParamStart}::timestamptz`);
  }
  params.push(Math.min(Number(limit) || 25, 100));

  const { rows } = await pool.query(
    `SELECT ds.city,
            SUM(ds.impressions) AS impressions,
            SUM(ds.clicks) AS clicks,
            SUM(ds.viewable_imps) AS viewable_imps,
            SUM(ds.measured_imps) AS measured_imps,
            SUM(ds.undetermined_imps) AS undetermined_imps,
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
            CASE WHEN SUM(ds.impressions) > 0
                 THEN ROUND(SUM(ds.clicks)::NUMERIC / SUM(ds.impressions) * 100, 4)
                 ELSE 0 END AS ctr,
            CASE WHEN SUM(ds.impressions) > 0
                 THEN ROUND(SUM(ds.measured_imps)::NUMERIC / SUM(ds.impressions) * 100, 4)
                 ELSE 0 END AS measurable_rate,
            CASE WHEN SUM(ds.measured_imps) > 0
                 THEN ROUND(SUM(ds.viewable_imps)::NUMERIC / SUM(ds.measured_imps) * 100, 4)
                 ELSE 0 END AS viewability_rate
     FROM tag_city_daily_stats ds
     JOIN ad_tags t ON t.id = ds.tag_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY ds.city
     ORDER BY SUM(ds.impressions) DESC, ds.city ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function getWorkspaceTrackerBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, limit = 25, campaignId = '', tagId = '' } = opts;
  const params = [workspaceId];
  const conditions = ["t.workspace_id = $1", "t.format IN ('tracker', 'display', 'vast')"];
  const impressionIdentityConditions = ['ie.workspace_id = t.workspace_id', 'ie.tag_id = t.id', "e.event_type = 'impression'", 'e.identity_profile_id IS NOT NULL'];
  const clickIdentityConditions = ['ce.workspace_id = t.workspace_id', 'ce.tag_id = t.id', "e.event_type = 'click'", 'e.identity_profile_id IS NOT NULL'];

  if (campaignId) {
    params.push(campaignId);
    conditions.push(`t.campaign_id = $${params.length}`);
  }
  if (tagId) {
    params.push(tagId);
    conditions.push(`t.id = $${params.length}`);
  }

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`ds.date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`ds.date <= $${params.length}`);
  }

  const identityDateParamStart = params.length + 1;
  if (dateFrom) {
    params.push(dateFrom);
    impressionIdentityConditions.push(`ie.timestamp >= $${identityDateParamStart}::timestamptz`);
    clickIdentityConditions.push(`ce.timestamp >= $${identityDateParamStart}::timestamptz`);
  }
  if (dateTo) {
    params.push(`${dateTo}T23:59:59.999Z`);
    const dateToIndex = dateFrom ? identityDateParamStart + 1 : identityDateParamStart;
    impressionIdentityConditions.push(`ie.timestamp <= $${dateToIndex}::timestamptz`);
    clickIdentityConditions.push(`ce.timestamp <= $${dateToIndex}::timestamptz`);
  }
  params.push(Math.min(Number(limit) || 25, 100));

  const { rows } = await pool.query(
    `SELECT
       t.id,
       t.name,
       t.status,
       c.name AS campaign_name,
       COALESCE(
         tfc.tracker_type,
         CASE
           WHEN t.format = 'display' THEN 'display'
           WHEN t.format = 'vast' THEN 'video'
           ELSE t.format
         END
       ) AS tracker_type,
       COALESCE(SUM(ds.impressions), 0)::bigint AS impressions,
       COALESCE(SUM(ds.clicks), 0)::bigint AS clicks,
       CASE
         WHEN COALESCE(tfc.tracker_type, t.format) = 'impression' THEN (
           SELECT COUNT(DISTINCT e.identity_profile_id)::bigint
           FROM impression_events ie
           JOIN event_identity_keys e ON e.event_id = ie.id
           WHERE ${impressionIdentityConditions.join(' AND ')}
         )
         ELSE (
           SELECT COUNT(DISTINCT e.identity_profile_id)::bigint
           FROM click_events ce
           JOIN event_identity_keys e ON e.event_id = ce.id
           WHERE ${clickIdentityConditions.join(' AND ')}
         )
       END AS unique_identities,
       CASE
         WHEN COALESCE(tfc.tracker_type, t.format) = 'impression' THEN (
           SELECT CASE
             WHEN COUNT(DISTINCT e.identity_profile_id) > 0
               THEN ROUND(COUNT(DISTINCT ie.id)::NUMERIC / COUNT(DISTINCT e.identity_profile_id), 4)
             ELSE 0
           END
           FROM impression_events ie
           JOIN event_identity_keys e ON e.event_id = ie.id
           WHERE ${impressionIdentityConditions.join(' AND ')}
         )
         ELSE (
           SELECT CASE
             WHEN COUNT(DISTINCT e.identity_profile_id) > 0
               THEN ROUND(COUNT(DISTINCT ce.id)::NUMERIC / COUNT(DISTINCT e.identity_profile_id), 4)
             ELSE 0
           END
           FROM click_events ce
           JOIN event_identity_keys e ON e.event_id = ce.id
           WHERE ${clickIdentityConditions.join(' AND ')}
         )
       END AS avg_frequency,
       CASE WHEN COALESCE(SUM(ds.impressions), 0) > 0
            THEN ROUND(COALESCE(SUM(ds.clicks), 0)::NUMERIC / SUM(ds.impressions) * 100, 4)
            ELSE 0 END AS ctr
     FROM ad_tags t
     LEFT JOIN tag_format_configs tfc ON tfc.tag_id = t.id
     LEFT JOIN campaigns c ON c.id = t.campaign_id
     LEFT JOIN tag_daily_stats ds ON ds.tag_id = t.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY t.id, t.name, t.status, c.name, tfc.tracker_type
     HAVING COALESCE(SUM(ds.impressions), 0) > 0
         OR COALESCE(SUM(ds.clicks), 0) > 0
     ORDER BY COALESCE(SUM(ds.clicks), 0) DESC, COALESCE(SUM(ds.impressions), 0) DESC, t.name ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function getWorkspaceEngagementBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, limit = 25, campaignId = '', tagId = '' } = opts;
  const params = [workspaceId];
  const conditions = ['t.workspace_id = $1'];
  if (campaignId) {
    params.push(campaignId);
    conditions.push(`t.campaign_id = $${params.length}`);
  }
  if (tagId) {
    params.push(tagId);
    conditions.push(`t.id = $${params.length}`);
  }

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`ds.date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`ds.date <= $${params.length}`);
  }
  params.push(Math.min(Number(limit) || 25, 100));

  const { rows } = await pool.query(
    `SELECT ds.event_type,
            SUM(ds.event_count) AS event_count,
            SUM(ds.total_duration_ms) AS total_duration_ms
     FROM tag_engagement_daily_stats ds
     JOIN ad_tags t ON t.id = ds.tag_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY ds.event_type
     ORDER BY SUM(ds.event_count) DESC, ds.event_type ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}
