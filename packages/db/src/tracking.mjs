function normalizeDays(value, fallback = 30) {
  return Math.min(Math.max(Number(value) || fallback, 1), 365);
}

export async function getTagTrackingSummary(pool, { workspaceId, tagId, days = 30 }) {
  const normalizedDays = normalizeDays(days);
  const { rows } = await pool.query(
    `
      select
        coalesce(sum(s.impressions), 0)::bigint as impressions,
        coalesce(sum(s.clicks), 0)::bigint as clicks,
        coalesce(sum(s.viewable_imps), 0)::bigint as viewable_impressions,
        coalesce(sum(s.measured_imps), 0)::bigint as measured_impressions,
        coalesce(sum(s.undetermined_imps), 0)::bigint as undetermined_impressions,
        coalesce(sum(s.spend), 0)::numeric(12,4) as spend
      from tag_daily_stats s
      join ad_tags t on t.id = s.tag_id
      where t.workspace_id = $1
        and s.tag_id = $2
        and s.date >= current_date - ($3::int - 1)
    `,
    [workspaceId, tagId, normalizedDays],
  );
  return rows[0] || null;
}

export async function listTagTrackingDailyStats(pool, { workspaceId, tagId, days = 30 }) {
  const normalizedDays = normalizeDays(days);
  const { rows } = await pool.query(
    `
      select
        s.date,
        s.impressions,
        s.clicks,
        s.viewable_imps,
        s.measured_imps,
        s.undetermined_imps,
        s.spend
      from tag_daily_stats s
      join ad_tags t on t.id = s.tag_id
      where t.workspace_id = $1
        and s.tag_id = $2
        and s.date >= current_date - ($3::int - 1)
      order by s.date asc
    `,
    [workspaceId, tagId, normalizedDays],
  );
  return rows;
}

export async function listTagTrackingEvents(pool, { workspaceId, tagId, days = 30 }) {
  const normalizedDays = normalizeDays(days);
  const { rows } = await pool.query(
    `
      select
        e.date,
        e.event_type,
        e.event_count,
        e.total_duration_ms
      from tag_engagement_daily_stats e
      join ad_tags t on t.id = e.tag_id
      where t.workspace_id = $1
        and e.tag_id = $2
        and e.date >= current_date - ($3::int - 1)
      order by e.date asc, e.event_type asc
    `,
    [workspaceId, tagId, normalizedDays],
  );
  return rows;
}

const VALID_ENGAGEMENT_EVENTS = new Set([
  'creativeView',
  'start',
  'firstQuartile',
  'midpoint',
  'thirdQuartile',
  'complete',
  'mute',
  'unmute',
  'pause',
  'resume',
  'rewind',
  'fullscreen',
  'exitFullscreen',
  'closeLinear',
  'skip',
  'acceptInvitationLinear',
  'progress',
  'viewable',
  'hover_end',
  'error',
  'click',
  'interaction',
  'expand',
  'collapse',
]);

function trimText(value) {
  return String(value ?? '').trim();
}

function logTrackerError(fn, tagId, err) {
  try {
    console.error(
      JSON.stringify({
        level: 'error',
        time: new Date().toISOString(),
        service: 'smx-tracker',
        fn,
        tagId,
        message: err?.message ?? String(err),
        stack: err?.stack,
      }),
    );
  } catch {
    // Best-effort logging only.
  }
}

export async function recordImpression(pool, tagId) {
  const id = trimText(tagId);
  if (!pool || !id) return false;
  try {
    await pool.query(
      `
        insert into tag_daily_stats (tag_id, date, impressions, updated_at)
        values ($1, current_date, 1, now())
        on conflict (tag_id, date) do update
          set impressions = tag_daily_stats.impressions + 1,
              updated_at = now()
      `,
      [id],
    );
    return true;
  } catch (err) {
    logTrackerError('recordImpression', id, err);
    return false;
  }
}

export async function recordClick(pool, tagId) {
  const id = trimText(tagId);
  if (!pool || !id) return false;
  try {
    await pool.query(
      `
        insert into tag_daily_stats (tag_id, date, clicks, updated_at)
        values ($1, current_date, 1, now())
        on conflict (tag_id, date) do update
          set clicks = tag_daily_stats.clicks + 1,
              updated_at = now()
      `,
      [id],
    );
    return true;
  } catch (err) {
    logTrackerError('recordClick', id, err);
    return false;
  }
}

export async function recordEngagement(pool, tagId, eventType, durationMs = 0) {
  const id = trimText(tagId);
  const event = trimText(eventType);
  if (!pool || !id || !event || !VALID_ENGAGEMENT_EVENTS.has(event)) return false;

  const duration = Math.max(0, Number(durationMs) || 0);

  try {
    await pool.query(
      `
        insert into tag_engagement_daily_stats
          (tag_id, date, event_type, event_count, total_duration_ms, updated_at)
        values ($1, current_date, $2, 1, $3, now())
        on conflict (tag_id, date, event_type) do update
          set event_count = tag_engagement_daily_stats.event_count + 1,
              total_duration_ms = tag_engagement_daily_stats.total_duration_ms + $3,
              updated_at = now()
      `,
      [id, event, duration],
    );
    return true;
  } catch (err) {
    logTrackerError('recordEngagement', id, err);
    return false;
  }
}

export async function flushTrackerBatch(pool, batch) {
  const impressions = batch?.impressions ?? new Map();
  const clicks = batch?.clicks ?? new Map();
  const engagements = batch?.engagements ?? new Map();

  let writtenImpressions = 0;
  let writtenClicks = 0;
  let writtenEngagements = 0;

  if (!pool || (impressions.size === 0 && clicks.size === 0 && engagements.size === 0)) {
    return { impressions: 0, clicks: 0, engagements: 0 };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const [tagId, count] of impressions) {
      await client.query(
        `
          insert into tag_daily_stats (tag_id, date, impressions, updated_at)
          values ($1, current_date, $2, now())
          on conflict (tag_id, date) do update
            set impressions = tag_daily_stats.impressions + $2,
                updated_at = now()
        `,
        [tagId, count],
      );
      writtenImpressions += count;
    }

    for (const [tagId, count] of clicks) {
      await client.query(
        `
          insert into tag_daily_stats (tag_id, date, clicks, updated_at)
          values ($1, current_date, $2, now())
          on conflict (tag_id, date) do update
            set clicks = tag_daily_stats.clicks + $2,
                updated_at = now()
        `,
        [tagId, count],
      );
      writtenClicks += count;
    }

    for (const [, entry] of engagements) {
      const { tagId, eventType, count, durationMs } = entry;
      await client.query(
        `
          insert into tag_engagement_daily_stats
            (tag_id, date, event_type, event_count, total_duration_ms, updated_at)
          values ($1, current_date, $2, $3, $4, now())
          on conflict (tag_id, date, event_type) do update
            set event_count = tag_engagement_daily_stats.event_count + $3,
                total_duration_ms = tag_engagement_daily_stats.total_duration_ms + $4,
                updated_at = now()
        `,
        [tagId, eventType, count, durationMs],
      );
      writtenEngagements += count;
    }

    await client.query('COMMIT');
    return { impressions: writtenImpressions, clicks: writtenClicks, engagements: writtenEngagements };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    logTrackerError('flushTrackerBatch', 'batch', err);
    return { impressions: 0, clicks: 0, engagements: 0 };
  } finally {
    client.release();
  }
}

export async function writeTrackerEventsToStaging(pool, { impressions, clicks, engagements }) {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tagIds = new Set([...(impressions?.keys?.() ?? []), ...(clicks?.keys?.() ?? [])]);
    for (const tagId of tagIds) {
      const imp = impressions.get(tagId) ?? 0;
      const clk = clicks.get(tagId) ?? 0;
      if (imp === 0 && clk === 0) continue;
      await client.query(
        `INSERT INTO tracker_events_staging (tag_id, event_date, impressions, clicks)
         VALUES ($1, CURRENT_DATE, $2, $3)`,
        [tagId, imp, clk],
      );
    }

    for (const [, entry] of engagements ?? new Map()) {
      await client.query(
        `INSERT INTO tracker_engagement_staging (tag_id, event_date, event_type, event_count, duration_ms)
         VALUES ($1, CURRENT_DATE, $2, $3, $4)`,
        [entry.tagId, entry.eventType, entry.count, entry.durationMs],
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
