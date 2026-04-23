const IDENTITY_PRIORITY = ['external_user_id', 'device_id', 'cookie_id'];
const IDENTITY_CONFIDENCE = {
  external_user_id: 1,
  device_id: 0.8,
  cookie_id: 0.65,
};

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

export async function recordImpression(pool, data) {
  const {
    impression_id = null,
    tag_id, workspace_id, creative_id = null,
    creative_size_variant_id = null,
    ip = null, user_agent = null, country = null, region = null,
    referer = null, viewable = null,
    viewability_status = 'unmeasured',
    viewability_method = null,
    viewability_duration_ms = null,
    site_domain = null, page_url = null, device_type = null, browser = null, os = null,
    device_id = null, cookie_id = null,
    identity_keys = [],
    timestamp = new Date(),
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO impression_events
       (id, tag_id, workspace_id, creative_id, creative_size_variant_id, ip, user_agent, country, region, referer, viewable, viewability_status, viewability_method, viewability_duration_ms, timestamp, site_domain, page_url, device_type, browser, os, device_id, cookie_id)
     VALUES (COALESCE($1::uuid, gen_random_uuid()),$2,$3,$4,$5,$6::inet,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     RETURNING id, tag_id, workspace_id, timestamp`,
    [impression_id, tag_id, workspace_id, creative_id, creative_size_variant_id, ip, user_agent, country, region,
     referer, viewable, viewability_status, viewability_method, viewability_duration_ms, timestamp, site_domain, page_url, device_type, browser, os, device_id, cookie_id],
  );
  const event = rows[0];
  await recordEventIdentityKeys(pool, {
    workspace_id,
    event_type: 'impression',
    event_id: event.id,
    identity_keys,
    country,
    region,
    city: null,
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
    ip = null, user_agent = null, country = null, region = null,
    referer = null, redirect_url = null,
    site_domain = null, page_url = null, device_type = null, browser = null, os = null,
    device_id = null, cookie_id = null,
    identity_keys = [],
    timestamp = new Date(),
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO click_events
       (tag_id, workspace_id, creative_id, creative_size_variant_id, impression_id, ip, user_agent,
        country, region, referer, redirect_url, timestamp, site_domain, page_url, device_type, browser, os, device_id, cookie_id)
     VALUES ($1,$2,$3,$4,$5,$6::inet,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING id, tag_id, workspace_id, timestamp`,
    [tag_id, workspace_id, creative_id, creative_size_variant_id, impression_id, ip, user_agent,
     country, region, referer, redirect_url, timestamp, site_domain, page_url, device_type, browser, os, device_id, cookie_id],
  );
  const event = rows[0];
  await recordEventIdentityKeys(pool, {
    workspace_id,
    event_type: 'click',
    event_id: event.id,
    identity_keys,
    country,
    region,
    city: null,
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
      `SELECT id, site_domain, country, timestamp, creative_size_variant_id, viewability_status
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
        ip, user_agent, country, region, referer, site_domain, page_url, device_type, browser, os,
        device_id, cookie_id, hover_duration_ms, metadata, timestamp)
     VALUES ($1,$2,$3,$4,$5,$6,$7::inet,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
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
    city: null,
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
  const { dateFrom, dateTo, limit = 25 } = opts;
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
  params.push(Math.min(Number(limit) || 25, 100));

  const { rows } = await pool.query(
    `SELECT ds.site_domain,
            SUM(ds.impressions) AS impressions,
            SUM(ds.clicks) AS clicks,
            SUM(ds.viewable_imps) AS viewable_imps,
            SUM(ds.measured_imps) AS measured_imps,
            SUM(ds.undetermined_imps) AS undetermined_imps,
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
  const { dateFrom, dateTo, limit = 25 } = opts;
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
  params.push(Math.min(Number(limit) || 25, 100));

  const { rows } = await pool.query(
    `SELECT ds.country,
            SUM(ds.impressions) AS impressions,
            SUM(ds.clicks) AS clicks,
            SUM(ds.viewable_imps) AS viewable_imps,
            SUM(ds.measured_imps) AS measured_imps,
            SUM(ds.undetermined_imps) AS undetermined_imps,
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

export async function getWorkspaceEngagementBreakdown(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo, limit = 25 } = opts;
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
