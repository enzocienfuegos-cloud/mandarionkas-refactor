function normalizePct(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function normalizeSeverity(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'ok' || normalized === 'warning' || normalized === 'critical') {
    return normalized;
  }
  return '';
}

function addDateFilters(params, conditions, alias, dateFrom, dateTo) {
  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`${alias}.date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`${alias}.date <= $${params.length}`);
  }
}

function calcSeverity(deltaPct, thresholds) {
  const absDelta = Math.abs(Number(deltaPct || 0));
  if (absDelta >= Number(thresholds.criticalPct || 15)) return 'critical';
  if (absDelta >= Number(thresholds.warningPct || 5)) return 'warning';
  return 'ok';
}

export async function getDiscrepancyThresholds(pool, workspaceId) {
  const { rows } = await pool.query(
    `SELECT warning_pct, critical_pct
     FROM discrepancy_thresholds
     WHERE workspace_id = $1
     LIMIT 1`,
    [workspaceId],
  );
  const row = rows[0];
  return {
    warningPct: row ? Number(row.warning_pct) : 5,
    criticalPct: row ? Number(row.critical_pct) : 15,
  };
}

export async function updateDiscrepancyThresholds(pool, workspaceId, updatedBy, payload = {}) {
  const warningPct = normalizePct(payload.warningPct, 5);
  const criticalPct = normalizePct(payload.criticalPct, 15);
  const { rows } = await pool.query(
    `INSERT INTO discrepancy_thresholds (
       workspace_id,
       warning_pct,
       critical_pct,
       updated_by
     ) VALUES ($1, $2, $3, $4)
     ON CONFLICT (workspace_id) DO UPDATE
     SET warning_pct = EXCLUDED.warning_pct,
         critical_pct = EXCLUDED.critical_pct,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
     RETURNING warning_pct, critical_pct`,
    [workspaceId, warningPct, criticalPct, updatedBy || null],
  );
  return {
    warningPct: Number(rows[0]?.warning_pct ?? warningPct),
    criticalPct: Number(rows[0]?.critical_pct ?? criticalPct),
  };
}

export async function listDiscrepancies(pool, workspaceId, opts = {}) {
  const thresholds = await getDiscrepancyThresholds(pool, workspaceId);
  const severityFilter = normalizeSeverity(opts.severity);
  const params = [workspaceId];
  const conditions = ['t.workspace_id = $1'];
  addDateFilters(params, conditions, 'ds', opts.dateFrom, opts.dateTo);

  const { rows } = await pool.query(
    `SELECT
       t.id AS tag_id,
       t.name AS tag_name,
       ds.date,
       COALESCE(ds.impressions, 0)::bigint AS served_impressions
     FROM tag_daily_stats ds
     JOIN ad_tags t ON t.id = ds.tag_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY ds.date DESC, ds.impressions DESC, t.name ASC`,
    params,
  );

  const reports = rows.map((row) => {
    const servedImpressions = Number(row.served_impressions || 0);
    const reportedImpressions = servedImpressions;
    const deltaPct = 0;
    const severity = calcSeverity(deltaPct, thresholds);
    return {
      id: `${row.tag_id}:${row.date}:internal`,
      tagId: row.tag_id,
      tagName: row.tag_name,
      date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date),
      source: 'internal',
      servedImpressions,
      reportedImpressions,
      deltaPct,
      severity,
    };
  });

  return severityFilter ? reports.filter((report) => report.severity === severityFilter) : reports;
}

export async function getDiscrepancySummary(pool, workspaceId, opts = {}) {
  const reports = await listDiscrepancies(pool, workspaceId, opts);
  return {
    totalReports: reports.length,
    criticalCount: reports.filter((report) => report.severity === 'critical').length,
    warningCount: reports.filter((report) => report.severity === 'warning').length,
  };
}
