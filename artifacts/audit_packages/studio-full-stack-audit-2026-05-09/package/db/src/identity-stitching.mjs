export async function stitchByIfa(pool, workspaceId, lookbackDays = 1) {
  const { rows } = await pool.query(
    `WITH ip_pairs AS (
       SELECT a.device_id AS older_id, b.device_id AS newer_id, a.workspace_id
       FROM impression_events a
       JOIN impression_events b
         ON  a.workspace_id = b.workspace_id
         AND a.ip_fingerprint = b.ip_fingerprint
         AND a.device_id <> b.device_id
         AND a.timestamp::date = b.timestamp::date
       WHERE a.workspace_id = $1
         AND a.ip_fingerprint IS NOT NULL
         AND a.timestamp >= NOW() - ($2 || ' days')::interval
         AND COALESCE(a.device_id, '') <> ''
         AND COALESCE(b.device_id, '') <> ''
     )
     SELECT DISTINCT
       p.workspace_id,
       LEAST(p.older_id, p.newer_id) AS canonical_id,
       GREATEST(p.older_id, p.newer_id) AS aliased_id
     FROM ip_pairs p
     WHERE p.older_id <> p.newer_id`,
    [workspaceId, lookbackDays],
  );

  if (rows.length === 0) return 0;

  for (const row of rows) {
    await pool.query(
      `INSERT INTO identity_edges
         (workspace_id, canonical_id, aliased_id, alias_type, confidence)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (workspace_id, canonical_id, aliased_id) DO UPDATE
         SET updated_at = NOW()`,
      [row.workspace_id, row.canonical_id, row.aliased_id, 'same_ip_fingerprint', 0.75],
    );
  }
  return rows.length;
}

export async function stitchBySoftFingerprint(pool, workspaceId, lookbackDays = 1) {
  const { rows } = await pool.query(
    `SELECT DISTINCT
       a.workspace_id,
       LEAST(a.device_id, b.device_id) AS canonical_id,
       GREATEST(a.device_id, b.device_id) AS aliased_id
     FROM impression_events a
     JOIN impression_events b
       ON  a.workspace_id = b.workspace_id
       AND a.soft_fingerprint = b.soft_fingerprint
       AND a.device_id <> b.device_id
       AND ABS(EXTRACT(EPOCH FROM (a.timestamp - b.timestamp))) < 86400
     WHERE a.workspace_id = $1
       AND a.soft_fingerprint IS NOT NULL
       AND a.timestamp >= NOW() - ($2 || ' days')::interval
       AND COALESCE(a.device_id, '') <> ''
       AND COALESCE(b.device_id, '') <> ''`,
    [workspaceId, lookbackDays],
  );

  if (rows.length === 0) return 0;

  for (const row of rows) {
    await pool.query(
      `INSERT INTO identity_edges
         (workspace_id, canonical_id, aliased_id, alias_type, confidence)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (workspace_id, canonical_id, aliased_id) DO UPDATE
         SET updated_at = NOW()`,
      [row.workspace_id, row.canonical_id, row.aliased_id, 'same_soft_fingerprint', 0.60],
    );
  }
  return rows.length;
}

export async function runIdentityStitching(client, { workspaceIds }) {
  let total = 0;
  for (const wid of workspaceIds) {
    total += await stitchByIfa(client, wid);
    total += await stitchBySoftFingerprint(client, wid);
  }
  return total;
}
