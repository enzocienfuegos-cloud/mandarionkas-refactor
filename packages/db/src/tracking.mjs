export async function recordImpression(pool, data) {
  const {
    tag_id, workspace_id, creative_id = null,
    creative_size_variant_id = null,
    ip = null, user_agent = null, country = null, region = null,
    referer = null, viewable = null,
    site_domain = null, page_url = null, device_type = null, browser = null, os = null,
    timestamp = new Date(),
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO impression_events
       (tag_id, workspace_id, creative_id, creative_size_variant_id, ip, user_agent, country, region, referer, viewable, timestamp, site_domain, page_url, device_type, browser, os)
     VALUES ($1,$2,$3,$4,$5::inet,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id, tag_id, workspace_id, timestamp`,
    [tag_id, workspace_id, creative_id, creative_size_variant_id, ip, user_agent, country, region,
     referer, viewable, timestamp, site_domain, page_url, device_type, browser, os],
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
    timestamp = new Date(),
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO click_events
       (tag_id, workspace_id, creative_id, creative_size_variant_id, impression_id, ip, user_agent,
        country, region, referer, redirect_url, timestamp, site_domain, page_url, device_type, browser, os)
     VALUES ($1,$2,$3,$4,$5,$6,$7::inet,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING id, tag_id, workspace_id, timestamp`,
    [tag_id, workspace_id, creative_id, creative_size_variant_id, impression_id, ip, user_agent,
     country, region, referer, redirect_url, timestamp, site_domain, page_url, device_type, browser, os],
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
    tag_id, workspace_id, impression_id, viewable = true,
  } = data;

  let impression = null;
  if (impression_id) {
    const { rows } = await pool.query(
      `UPDATE impression_events
       SET viewable = $1
       WHERE id = $2 AND tag_id = $3
       RETURNING site_domain, country, timestamp`,
      [viewable, impression_id, tag_id],
    );
    impression = rows[0] ?? null;
  }

  // Increment viewable impressions in daily stats
  if (viewable) {
    const date = new Date(impression?.timestamp ?? new Date()).toISOString().slice(0, 10);
    await pool.query(
      `INSERT INTO tag_daily_stats (tag_id, date, viewable_imps)
       VALUES ($1, $2, 1)
       ON CONFLICT (tag_id, date)
       DO UPDATE SET viewable_imps = tag_daily_stats.viewable_imps + 1, updated_at = NOW()`,
      [tag_id, date],
    );

    if (impression?.site_domain) {
      await pool.query(
        `INSERT INTO tag_site_daily_stats (tag_id, date, site_domain, viewable_imps)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (tag_id, date, site_domain)
         DO UPDATE SET viewable_imps = tag_site_daily_stats.viewable_imps + 1, updated_at = NOW()`,
        [tag_id, date, impression.site_domain],
      );
    }

    if (impression?.country) {
      await pool.query(
        `INSERT INTO tag_country_daily_stats (tag_id, date, country, viewable_imps)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (tag_id, date, country)
         DO UPDATE SET viewable_imps = tag_country_daily_stats.viewable_imps + 1, updated_at = NOW()`,
        [tag_id, date, impression.country],
      );
    }
  }

  return { tag_id, workspace_id, impression_id, viewable };
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
            CASE WHEN SUM(ds.impressions) > 0
                 THEN ROUND(SUM(ds.clicks)::NUMERIC / SUM(ds.impressions) * 100, 4)
                 ELSE 0 END AS ctr,
            CASE WHEN SUM(ds.impressions) > 0
                 THEN ROUND(SUM(ds.viewable_imps)::NUMERIC / SUM(ds.impressions) * 100, 4)
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
            CASE WHEN SUM(ds.impressions) > 0
                 THEN ROUND(SUM(ds.clicks)::NUMERIC / SUM(ds.impressions) * 100, 4)
                 ELSE 0 END AS ctr,
            CASE WHEN SUM(ds.impressions) > 0
                 THEN ROUND(SUM(ds.viewable_imps)::NUMERIC / SUM(ds.impressions) * 100, 4)
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
