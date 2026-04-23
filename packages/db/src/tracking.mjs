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
  return rows[0];
}

export async function recordClick(pool, data) {
  const {
    tag_id, workspace_id, creative_id = null, impression_id = null,
    creative_size_variant_id = null,
    ip = null, user_agent = null, country = null, region = null,
    referer = null, redirect_url = null,
    site_domain = null, page_url = null, device_type = null, browser = null, os = null,
    device_id = null, cookie_id = null,
    timestamp = new Date(),
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO click_events
       (tag_id, workspace_id, creative_id, creative_size_variant_id, impression_id, ip, user_agent,
        country, region, referer, redirect_url, timestamp, site_domain, page_url, device_type, browser, os, device_id, cookie_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7::inet,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING id, tag_id, workspace_id, timestamp`,
    [tag_id, workspace_id, creative_id, creative_size_variant_id, impression_id, ip, user_agent,
     country, region, referer, redirect_url, timestamp, site_domain, page_url, device_type, browser, os, device_id, cookie_id],
  );

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
  return rows[0];
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

  return rows[0];
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
