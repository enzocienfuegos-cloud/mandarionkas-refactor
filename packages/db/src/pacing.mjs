export const PACING_STATUSES  = ['on_track', 'behind', 'ahead', 'completed', 'not_started', 'no_goal'];
export const BEHIND_THRESHOLD = 85;
export const AHEAD_THRESHOLD  = 115;

function parseLocalMidnight(v) {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(v);
}

export function burnRate(servedTotal, elapsedDays) {
  const s = Number(servedTotal) || 0;
  const d = Number(elapsedDays) || 0;
  return d === 0 ? 0 : s / d;
}

export function pacingStatus(pacingPct, campaign, today = new Date()) {
  const { start_date, end_date, impression_goal } = campaign ?? {};
  if (!impression_goal) return 'no_goal';
  const start = parseLocalMidnight(start_date);
  const end   = parseLocalMidnight(end_date);
  const now   = new Date(today);
  now.setHours(0, 0, 0, 0);
  if (now < start) return 'not_started';
  if (end < now)   return 'completed';
  if (pacingPct == null) return 'no_goal';
  if (pacingPct < BEHIND_THRESHOLD)  return 'behind';
  if (pacingPct > AHEAD_THRESHOLD)   return 'ahead';
  return 'on_track';
}

export function computePacing(campaign, servedTotal, today = new Date()) {
  const { start_date, end_date, impression_goal } = campaign ?? {};
  const served = Number(servedTotal) || 0;
  if (!impression_goal) {
    return { servedTotal: served, impressionGoal: null, totalDays: null, elapsedDays: null,
             remainingDays: null, expectedByNow: null, pacingPct: null, deliveryPct: null,
             burnRatePerDay: null, projectedTotal: null, status: 'no_goal' };
  }
  const goal  = Number(impression_goal);
  const start = parseLocalMidnight(start_date);
  const end   = parseLocalMidnight(end_date);
  const now   = new Date(today);
  now.setHours(0, 0, 0, 0);
  const MS_PER_DAY    = 86_400_000;
  const totalDays     = Math.max(1, Math.round((end - start) / MS_PER_DAY));
  const rawElapsed    = Math.round((now - start) / MS_PER_DAY);
  const elapsedDays   = Math.max(0, Math.min(rawElapsed, totalDays));
  const rawRemaining  = Math.round((end - now) / MS_PER_DAY);
  const remainingDays = Math.max(0, rawRemaining);
  const expectedByNow = elapsedDays === 0 ? 0 : (goal * elapsedDays) / totalDays;
  const pacingPct     = expectedByNow === 0
    ? (elapsedDays === 0 ? null : 100)
    : Math.round((served / expectedByNow) * 100 * 10) / 10;
  const deliveryPct   = Math.round((served / goal) * 100 * 10) / 10;
  const burnRatePerDay = burnRate(served, elapsedDays);
  const projectedTotal = Math.round(served + burnRatePerDay * remainingDays);
  const status = pacingStatus(pacingPct, campaign, today);
  return { servedTotal: served, impressionGoal: goal, totalDays, elapsedDays, remainingDays,
           expectedByNow: Math.round(expectedByNow), pacingPct, deliveryPct,
           burnRatePerDay: Math.round(burnRatePerDay), projectedTotal, status };
}

export async function listCampaignsPacing(pool, workspaceId, opts = {}) {
  const { status = null } = opts;
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.status AS "campaignStatus",
            c.start_date AS "startDate", c.end_date AS "endDate",
            c.impression_goal AS "impressionGoal", c.daily_budget AS "dailyBudget",
            adv.name AS "advertiserName",
            COALESCE(SUM(ds.impressions), 0)::BIGINT AS "servedTotal",
            COALESCE(SUM(CASE WHEN ds.date >= CURRENT_DATE - 6 THEN ds.impressions ELSE 0 END), 0)::BIGINT AS "last7Days"
     FROM   campaigns c
     LEFT JOIN advertisers adv ON adv.id = c.advertiser_id
     LEFT JOIN ad_tags t ON t.campaign_id = c.id AND t.workspace_id = c.workspace_id
     LEFT JOIN tag_daily_stats ds ON ds.tag_id = t.id
     WHERE  c.workspace_id = $1 AND c.status != 'archived'
     GROUP BY c.id, c.name, c.status, c.start_date, c.end_date, c.impression_goal, c.daily_budget, adv.name
     ORDER BY c.start_date DESC`,
    [workspaceId],
  );
  const today = new Date();
  const result = rows.map(row => ({
    ...row,
    pacing: computePacing({ start_date: row.startDate, end_date: row.endDate, impression_goal: row.impressionGoal }, row.servedTotal, today),
  }));
  if (status) return result.filter(r => r.pacing.status === status);
  return result;
}

export async function getCampaignPacing(pool, workspaceId, campaignId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.status AS "campaignStatus",
            c.start_date AS "startDate", c.end_date AS "endDate",
            c.impression_goal AS "impressionGoal", c.daily_budget AS "dailyBudget",
            adv.name AS "advertiserName",
            COALESCE(SUM(ds.impressions), 0)::BIGINT AS "servedTotal",
            COALESCE(SUM(CASE WHEN ds.date >= CURRENT_DATE - 6 THEN ds.impressions ELSE 0 END), 0)::BIGINT AS "last7Days"
     FROM   campaigns c
     LEFT JOIN advertisers adv ON adv.id = c.advertiser_id
     LEFT JOIN ad_tags t ON t.campaign_id = c.id AND t.workspace_id = c.workspace_id
     LEFT JOIN tag_daily_stats ds ON ds.tag_id = t.id
     WHERE  c.workspace_id = $1 AND c.id = $2
     GROUP BY c.id, c.name, c.status, c.start_date, c.end_date, c.impression_goal, c.daily_budget, adv.name`,
    [workspaceId, campaignId],
  );
  if (!rows.length) return null;
  const row = rows[0];
  return { ...row, pacing: computePacing({ start_date: row.startDate, end_date: row.endDate, impression_goal: row.impressionGoal }, row.servedTotal) };
}

export async function getCampaignDailyBreakdown(pool, workspaceId, campaignId, days = 30) {
  const safeDays = Math.min(parseInt(days, 10) || 30, 90);
  const { rows } = await pool.query(
    `SELECT ds.date, SUM(ds.impressions)::BIGINT AS impressions
     FROM   ad_tags t
     JOIN   tag_daily_stats ds ON ds.tag_id = t.id
     WHERE  t.campaign_id = $1 AND t.workspace_id = $2 AND ds.date >= CURRENT_DATE - $3
     GROUP BY ds.date ORDER BY ds.date ASC`,
    [campaignId, workspaceId, safeDays - 1],
  );
  return rows;
}

export async function getPacingAlerts(pool, workspaceId) {
  const all = await listCampaignsPacing(pool, workspaceId);
  return all.filter(c => {
    if (c.pacing.status === 'behind') return true;
    if (c.pacing.remainingDays != null && c.pacing.remainingDays <= 3
        && c.pacing.deliveryPct != null && c.pacing.deliveryPct < 90) return true;
    return false;
  });
}
