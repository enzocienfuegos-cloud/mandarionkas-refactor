export function classifySeverity(deltaPct, warningPct = 10, criticalPct = 20) {
  const pct = Number(deltaPct);
  if (isNaN(pct) || pct == null) return 'ok';
  if (pct >= criticalPct) return 'critical';
  if (pct >= warningPct) return 'warning';
  return 'ok';
}

export function computeDelta(servedImps, reportedImps) {
  const served   = Number(servedImps)   || 0;
  const reported = Number(reportedImps) || 0;
  const deltaAbs = served - reported;
  const deltaPct = served === 0
    ? null
    : Math.abs(deltaAbs) / served * 100;
  return { deltaAbs, deltaPct: deltaPct !== null ? Math.round(deltaPct * 100) / 100 : null };
}

export async function createDiscrepancyReport(pool, workspaceId, data) {
  const {
    tag_id, date, source, served_imps, reported_imps,
    notes = null,
  } = data;

  // Get thresholds to auto-classify severity
  const thresholds = await getThresholds(pool, workspaceId);
  const { deltaPct } = computeDelta(served_imps, reported_imps);
  const severity = classifySeverity(deltaPct, thresholds.warning_pct, thresholds.critical_pct);

  const { rows } = await pool.query(
    `INSERT INTO discrepancy_reports
       (workspace_id, tag_id, date, source, served_imps, reported_imps, severity, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (workspace_id, tag_id, date, source)
     DO UPDATE SET
       served_imps   = EXCLUDED.served_imps,
       reported_imps = EXCLUDED.reported_imps,
       severity      = EXCLUDED.severity,
       notes         = EXCLUDED.notes
     RETURNING *`,
    [workspaceId, tag_id, date, source, served_imps, reported_imps, severity, notes],
  );
  return rows[0];
}

export async function listDiscrepancyReports(pool, workspaceId, opts = {}) {
  const {
    tagId, severity, source, dateFrom, dateTo,
    limit = 50, offset = 0,
  } = opts;

  const params = [workspaceId];
  const conditions = ['dr.workspace_id = $1'];

  if (tagId) {
    params.push(tagId);
    conditions.push(`dr.tag_id = $${params.length}`);
  }
  if (severity) {
    params.push(severity);
    conditions.push(`dr.severity = $${params.length}`);
  }
  if (source) {
    params.push(source);
    conditions.push(`dr.source = $${params.length}`);
  }
  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`dr.date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`dr.date <= $${params.length}`);
  }

  params.push(Math.min(Number(limit) || 50, 500));
  params.push(Number(offset) || 0);

  const { rows } = await pool.query(
    `SELECT dr.id, dr.workspace_id, dr.tag_id, dr.date, dr.source,
            dr.served_imps, dr.reported_imps, dr.delta_abs, dr.delta_pct,
            dr.severity, dr.notes, dr.created_at,
            t.name AS tag_name
     FROM discrepancy_reports dr
     LEFT JOIN ad_tags t ON t.id = dr.tag_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY dr.date DESC, dr.severity DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function getDiscrepancyReport(pool, workspaceId, id) {
  const { rows } = await pool.query(
    `SELECT dr.id, dr.workspace_id, dr.tag_id, dr.date, dr.source,
            dr.served_imps, dr.reported_imps, dr.delta_abs, dr.delta_pct,
            dr.severity, dr.notes, dr.created_at,
            t.name AS tag_name
     FROM discrepancy_reports dr
     LEFT JOIN ad_tags t ON t.id = dr.tag_id
     WHERE dr.workspace_id = $1 AND dr.id = $2`,
    [workspaceId, id],
  );
  return rows[0] ?? null;
}

export async function updateDiscrepancyReport(pool, workspaceId, id, data) {
  const allowed = ['notes', 'severity'];
  const setClauses = [];
  const params = [workspaceId, id];
  for (const key of allowed) {
    if (key in data) {
      params.push(data[key]);
      setClauses.push(`${key} = $${params.length}`);
    }
  }
  if (setClauses.length === 0) return getDiscrepancyReport(pool, workspaceId, id);

  const { rows } = await pool.query(
    `UPDATE discrepancy_reports SET ${setClauses.join(', ')}
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    params,
  );
  return rows[0] ?? null;
}

export async function deleteDiscrepancyReport(pool, workspaceId, id) {
  const { rowCount } = await pool.query(
    `DELETE FROM discrepancy_reports WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, id],
  );
  return rowCount > 0;
}

export async function getDiscrepancySummary(pool, workspaceId, opts = {}) {
  const { dateFrom, dateTo } = opts;
  const params = [workspaceId];
  const conditions = ['dr.workspace_id = $1'];

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`dr.date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`dr.date <= $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT
       COUNT(*)                                                         AS total_reports,
       COUNT(CASE WHEN severity = 'critical' THEN 1 END)               AS critical_count,
       COUNT(CASE WHEN severity = 'warning'  THEN 1 END)               AS warning_count,
       COUNT(CASE WHEN severity = 'ok'       THEN 1 END)               AS ok_count,
       COALESCE(AVG(delta_pct), 0)                                      AS avg_delta_pct,
       COALESCE(MAX(delta_pct), 0)                                      AS max_delta_pct,
       COALESCE(SUM(ABS(delta_abs)), 0)                                 AS total_abs_delta
     FROM discrepancy_reports dr
     WHERE ${conditions.join(' AND ')}`,
    params,
  );
  return rows[0];
}

export async function getThresholds(pool, workspaceId) {
  const { rows } = await pool.query(
    `SELECT id, workspace_id, warning_pct, critical_pct, updated_at
     FROM discrepancy_thresholds
     WHERE workspace_id = $1`,
    [workspaceId],
  );
  return rows[0] ?? { workspace_id: workspaceId, warning_pct: 10, critical_pct: 20 };
}

export async function upsertThresholds(pool, workspaceId, data) {
  const { warning_pct = 10, critical_pct = 20 } = data;

  const { rows } = await pool.query(
    `INSERT INTO discrepancy_thresholds (workspace_id, warning_pct, critical_pct, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (workspace_id)
     DO UPDATE SET
       warning_pct  = EXCLUDED.warning_pct,
       critical_pct = EXCLUDED.critical_pct,
       updated_at   = NOW()
     RETURNING *`,
    [workspaceId, warning_pct, critical_pct],
  );
  return rows[0];
}
