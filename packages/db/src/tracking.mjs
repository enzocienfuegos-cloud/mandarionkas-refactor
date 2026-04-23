export async function recordImpression(pool, data) {
  const {
    tag_id, workspace_id, creative_id = null,
    creative_size_variant_id = null,
    ip = null, user_agent = null, country = null, region = null,
    referer = null, viewable = null,
    timestamp = new Date(),
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO impression_events
       (tag_id, workspace_id, creative_id, creative_size_variant_id, ip, user_agent, country, region, referer, viewable, timestamp)
     VALUES ($1,$2,$3,$4,$5::inet,$6,$7,$8,$9,$10,$11)
     RETURNING id, tag_id, workspace_id, timestamp`,
    [tag_id, workspace_id, creative_id, creative_size_variant_id, ip, user_agent, country, region,
     referer, viewable, timestamp],
  );

  if (creative_size_variant_id) {
    const date = new Date(timestamp).toISOString().slice(0, 10);
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
    timestamp = new Date(),
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO click_events
       (tag_id, workspace_id, creative_id, creative_size_variant_id, impression_id, ip, user_agent,
        country, region, referer, redirect_url, timestamp)
     VALUES ($1,$2,$3,$4,$5,$6,$7::inet,$8,$9,$10,$11,$12)
     RETURNING id, tag_id, workspace_id, timestamp`,
    [tag_id, workspace_id, creative_id, creative_size_variant_id, impression_id, ip, user_agent,
     country, region, referer, redirect_url, timestamp],
  );

  if (creative_size_variant_id) {
    const date = new Date(timestamp).toISOString().slice(0, 10);
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

  if (impression_id) {
    await pool.query(
      `UPDATE impression_events SET viewable = $1 WHERE id = $2 AND tag_id = $3`,
      [viewable, impression_id, tag_id],
    );
  }

  // Increment viewable impressions in daily stats
  if (viewable) {
    const date = new Date().toISOString().slice(0, 10);
    await pool.query(
      `INSERT INTO tag_daily_stats (tag_id, date, viewable_imps)
       VALUES ($1, $2, 1)
       ON CONFLICT (tag_id, date)
       DO UPDATE SET viewable_imps = tag_daily_stats.viewable_imps + 1, updated_at = NOW()`,
      [tag_id, date],
    );
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
