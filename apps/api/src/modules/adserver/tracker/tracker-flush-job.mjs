import { logError, logInfo } from '../../../lib/logger.mjs';

export const JOB_NAME = 'smx.tracker.flush';

export async function runTrackerFlushJob(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO tag_daily_stats (tag_id, date, impressions, clicks, updated_at)
      SELECT
        tag_id,
        event_date,
        COALESCE(SUM(impressions), 0),
        COALESCE(SUM(clicks), 0),
        NOW()
      FROM tracker_events_staging
      WHERE flushed = FALSE
      GROUP BY tag_id, event_date
      ON CONFLICT (tag_id, date) DO UPDATE
        SET impressions = tag_daily_stats.impressions + EXCLUDED.impressions,
            clicks      = tag_daily_stats.clicks + EXCLUDED.clicks,
            updated_at  = NOW()
    `);

    await client.query(`
      INSERT INTO tag_engagement_daily_stats
        (tag_id, date, event_type, event_count, total_duration_ms, updated_at)
      SELECT
        tag_id,
        event_date,
        event_type,
        COALESCE(SUM(event_count), 0),
        COALESCE(SUM(duration_ms), 0),
        NOW()
      FROM tracker_engagement_staging
      WHERE flushed = FALSE
      GROUP BY tag_id, event_date, event_type
      ON CONFLICT (tag_id, date, event_type) DO UPDATE
        SET event_count       = tag_engagement_daily_stats.event_count + EXCLUDED.event_count,
            total_duration_ms = tag_engagement_daily_stats.total_duration_ms + EXCLUDED.total_duration_ms,
            updated_at        = NOW()
    `);

    const { rowCount: impRows } = await client.query(`
      DELETE FROM tracker_events_staging WHERE flushed = FALSE
    `);
    const { rowCount: engRows } = await client.query(`
      DELETE FROM tracker_engagement_staging WHERE flushed = FALSE
    `);

    await client.query('COMMIT');
    logInfo({
      service: 'smx-tracker-flush-job',
      event: 'flushed',
      impressionRows: impRows,
      engagementRows: engRows,
    });
    return { impressionRows: impRows, engagementRows: engRows };
  } catch (err) {
    await client.query('ROLLBACK');
    logError({ service: 'smx-tracker-flush-job', event: 'flush_error', message: err?.message });
    throw err;
  } finally {
    client.release();
  }
}
