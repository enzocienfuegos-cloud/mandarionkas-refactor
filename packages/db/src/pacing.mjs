function normalizeLimit(limit, fallback = 60, max = 365) {
  return Math.min(Math.max(Number(limit) || fallback, 1), max);
}

function toUtcMidnight(value) {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

function daysBetween(start, end) {
  return Math.max(Math.floor((end.getTime() - start.getTime()) / 86400000), 0);
}

function getPacingMetrics(campaign, now = new Date()) {
  const startDate = toUtcMidnight(campaign.start_date);
  const endDate = toUtcMidnight(campaign.end_date);
  const totalGoal = campaign.impression_goal == null ? null : Number(campaign.impression_goal);
  const servedTotal = Number(campaign.impressions || 0);

  if (!startDate || !endDate) {
    return {
      status: totalGoal ? 'no_goal' : 'no_goal',
      pacingPct: 0,
      deliveryPct: totalGoal && totalGoal > 0 ? Number(((servedTotal / totalGoal) * 100).toFixed(2)) : 0,
      impressionsServed: servedTotal,
      impressionGoal: totalGoal,
      remainingDays: 0,
    };
  }

  const nowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const campaignDurationDays = Math.max(daysBetween(startDate, endDate) + 1, 1);
  const elapsedDays = nowUtc < startDate
    ? 0
    : Math.min(daysBetween(startDate, nowUtc) + 1, campaignDurationDays);
  const pacingPct = Number(((elapsedDays / campaignDurationDays) * 100).toFixed(2));
  const deliveryPct = totalGoal && totalGoal > 0
    ? Number(((servedTotal / totalGoal) * 100).toFixed(2))
    : 0;
  const remainingDays = nowUtc > endDate ? 0 : Math.max(daysBetween(nowUtc, endDate), 0);

  let status = 'no_goal';
  if (!totalGoal || totalGoal <= 0) {
    status = 'no_goal';
  } else if (nowUtc < startDate) {
    status = 'not_started';
  } else if (servedTotal >= totalGoal || campaign.status === 'completed') {
    status = 'completed';
  } else {
    const delta = deliveryPct - pacingPct;
    if (delta <= -10) status = 'behind';
    else if (delta >= 10) status = 'ahead';
    else status = 'on_track';
  }

  return {
    status,
    pacingPct,
    deliveryPct,
    impressionsServed: servedTotal,
    impressionGoal: totalGoal,
    remainingDays,
  };
}

export async function listWorkspacePacingCampaigns(pool, workspaceId) {
  const { rows } = await pool.query(
    `SELECT
       c.id,
       c.name,
       c.status,
       c.start_date,
       c.end_date,
       c.impression_goal,
       adv.name AS advertiser,
       COALESCE(SUM(ds.impressions), 0)::bigint AS impressions
     FROM campaigns c
     LEFT JOIN advertisers adv ON adv.id = c.advertiser_id
     LEFT JOIN ad_tags t ON t.campaign_id = c.id AND t.workspace_id = c.workspace_id
     LEFT JOIN tag_daily_stats ds ON ds.tag_id = t.id
     WHERE c.workspace_id = $1
       AND c.status <> 'archived'
     GROUP BY c.id, adv.name
     ORDER BY c.created_at DESC`,
    [workspaceId],
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    advertiser: row.advertiser || '—',
    startDate: row.start_date,
    endDate: row.end_date,
    ...getPacingMetrics(row),
  }));
}

export async function listWorkspacePacingAlerts(pool, workspaceId) {
  const campaigns = await listWorkspacePacingCampaigns(pool, workspaceId);
  return campaigns
    .filter((campaign) => campaign.status === 'behind' || campaign.status === 'ahead')
    .map((campaign) => ({
      campaignId: campaign.id,
      campaignName: campaign.name,
      status: campaign.status,
      severity: campaign.status === 'behind' ? 'critical' : 'warning',
      message: campaign.status === 'behind'
        ? `Delivery is behind expected pacing at ${campaign.pacingPct.toFixed(1)}%.`
        : `Delivery is ahead of expected pacing at ${campaign.deliveryPct.toFixed(1)}%.`,
    }));
}

export async function getCampaignPacingBreakdown(pool, workspaceId, campaignId, opts = {}) {
  const days = normalizeLimit(opts.days, 14, 120);
  const campaignResult = await pool.query(
    `SELECT id, workspace_id, name, start_date, end_date, impression_goal, status
     FROM campaigns
     WHERE workspace_id = $1
       AND id = $2
     LIMIT 1`,
    [workspaceId, campaignId],
  );
  const campaign = campaignResult.rows[0];
  if (!campaign) return [];

  const statsResult = await pool.query(
    `SELECT
       ds.date,
       COALESCE(SUM(ds.impressions), 0)::bigint AS impressions
     FROM ad_tags t
     JOIN tag_daily_stats ds ON ds.tag_id = t.id
     WHERE t.workspace_id = $1
       AND t.campaign_id = $2
       AND ds.date >= CURRENT_DATE - ($3::int - 1) * INTERVAL '1 day'
     GROUP BY ds.date
     ORDER BY ds.date ASC`,
    [workspaceId, campaignId, days],
  );

  const dailyMap = new Map(statsResult.rows.map((row) => [row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date), Number(row.impressions || 0)]));
  const end = new Date();
  const totalGoal = campaign.impression_goal == null ? null : Number(campaign.impression_goal);
  const startDate = toUtcMidnight(campaign.start_date);
  const endDate = toUtcMidnight(campaign.end_date);
  const durationDays = startDate && endDate ? Math.max(daysBetween(startDate, endDate) + 1, 1) : 0;
  const expectedPerDay = totalGoal && durationDays > 0 ? totalGoal / durationDays : 0;

  const breakdown = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - index));
    const key = date.toISOString().slice(0, 10);
    let expected = 0;
    if (startDate && endDate && date >= startDate && date <= endDate && totalGoal) {
      expected = Math.round(expectedPerDay);
    }
    breakdown.push({
      date: key,
      impressions: dailyMap.get(key) || 0,
      expected,
    });
  }

  return breakdown;
}
