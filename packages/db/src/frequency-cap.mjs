// packages/db/src/frequency-cap.mjs
//
// S46: Frequency cap enforcement DB layer.
//
// Cap logic:
//   - frequency_cap:        max impressions allowed per window (int, nullable = no cap)
//   - frequency_cap_window: 'daily' | 'weekly' (default: 'daily')
//
// The check runs inside the VAST serving route before calling getLiveVastXml.
// Capped requests receive a VAST 3.0 <NoAd/> response, not a 403.

export function getWindowStartDate(window = 'daily') {
  const now = new Date();
  if (window === 'weekly') {
    const day = now.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() + diff);
    return monday.toISOString().slice(0, 10);
  }
  return now.toISOString().slice(0, 10);
}

/**
 * Read frequency_cap + workspace_id from ad_tags.
 * Returns { cap: number|null, capWindow: string, workspaceId: string|null }
 */
export async function getTagFrequencyCap(pool, tagId) {
  try {
    const { rows } = await pool.query(
      `SELECT frequency_cap, frequency_cap_window, workspace_id
       FROM   ad_tags
       WHERE  id = $1
       LIMIT  1`,
      [tagId],
    );
    const row = rows[0];
    if (!row) return { cap: null, capWindow: 'daily', workspaceId: null };
    return {
      cap:         row.frequency_cap ? Number(row.frequency_cap) : null,
      capWindow:   row.frequency_cap_window || 'daily',
      workspaceId: row.workspace_id ?? null,
    };
  } catch {
    return { cap: null, capWindow: 'daily', workspaceId: null };
  }
}

/**
 * Check whether a device has exceeded the frequency cap.
 * Returns { capped: boolean, count: number, cap: number|null }.
 * Never throws — returns uncapped on DB error to avoid blocking VAST serving.
 */
export async function checkFrequencyCap(pool, { tagId, deviceId, cap, capWindow = 'daily' }) {
  if (!cap || cap <= 0 || !deviceId) return { capped: false, count: 0, cap };

  const windowStart = getWindowStartDate(capWindow);
  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(impressions), 0)::int AS count
       FROM   tag_frequency_cap_events
       WHERE  tag_id    = $1
         AND  device_id = $2
         AND  event_date >= $3::date`,
      [tagId, deviceId, windowStart],
    );
    const count = Number(rows[0]?.count ?? 0);
    return { capped: count >= cap, count, cap };
  } catch {
    return { capped: false, count: 0, cap };
  }
}

/**
 * Record one impression for a (tag, device) pair.
 * UPSERT — safe to call multiple times. Fire-and-forget, never throws.
 */
export async function recordFrequencyCapImpression(pool, { tagId, deviceId, workspaceId }) {
  if (!tagId || !deviceId || !workspaceId) return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    await pool.query(
      `INSERT INTO tag_frequency_cap_events (tag_id, device_id, workspace_id, event_date, impressions)
       VALUES ($1, $2, $3, $4::date, 1)
       ON CONFLICT (tag_id, device_id, event_date)
       DO UPDATE SET
         impressions = tag_frequency_cap_events.impressions + 1,
         updated_at  = NOW()`,
      [tagId, deviceId, workspaceId, today],
    );
  } catch {
    // Fire-and-forget.
  }
}

/**
 * Purge events older than retentionDays. Called by maintenance worker.
 * @returns {Promise<number>} rows deleted
 */
export async function pruneFrequencyCapEvents(client, retentionDays = 30) {
  try {
    const { rowCount } = await client.query(
      `DELETE FROM tag_frequency_cap_events
       WHERE event_date < CURRENT_DATE - ($1 || ' days')::interval`,
      [retentionDays],
    );
    return rowCount ?? 0;
  } catch {
    return 0;
  }
}
