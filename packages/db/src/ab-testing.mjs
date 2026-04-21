export async function listExperiments(pool, workspaceId) {
  const { rows } = await pool.query(
    `SELECT e.id, e.workspace_id, e.tag_id, e.name, e.description, e.status,
            e.traffic_pct, e.started_at, e.ended_at, e.created_at, e.updated_at,
            COUNT(v.id) AS variant_count
     FROM ab_experiments e
     LEFT JOIN ab_variants v ON v.experiment_id = e.id
     WHERE e.workspace_id = $1
     GROUP BY e.id, e.workspace_id, e.tag_id, e.name, e.description, e.status,
              e.traffic_pct, e.started_at, e.ended_at, e.created_at, e.updated_at
     ORDER BY e.created_at DESC`,
    [workspaceId],
  );
  return rows;
}

export async function getExperiment(pool, workspaceId, id) {
  const { rows } = await pool.query(
    `SELECT e.id, e.workspace_id, e.tag_id, e.name, e.description, e.status,
            e.traffic_pct, e.started_at, e.ended_at, e.created_at, e.updated_at
     FROM ab_experiments e
     WHERE e.workspace_id = $1 AND e.id = $2`,
    [workspaceId, id],
  );
  if (!rows.length) return null;
  const experiment = rows[0];

  const { rows: variants } = await pool.query(
    `SELECT id, experiment_id, name, creative_id, weight, impressions, clicks, created_at
     FROM ab_variants WHERE experiment_id = $1 ORDER BY created_at ASC`,
    [id],
  );
  return { ...experiment, variants };
}

export async function createExperiment(pool, workspaceId, data) {
  const {
    tag_id = null, name, description = null, status = 'draft',
    traffic_pct = 100, variants = [],
  } = data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO ab_experiments
         (workspace_id, tag_id, name, description, status, traffic_pct)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [workspaceId, tag_id, name, description, status, traffic_pct],
    );
    const experiment = rows[0];

    const createdVariants = [];
    for (const variant of variants) {
      const { rows: vRows } = await client.query(
        `INSERT INTO ab_variants (experiment_id, name, creative_id, weight)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [experiment.id, variant.name, variant.creative_id ?? null, variant.weight ?? 50],
      );
      createdVariants.push(vRows[0]);
    }

    await client.query('COMMIT');
    return { ...experiment, variants: createdVariants };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateExperiment(pool, workspaceId, id, data) {
  const allowed = ['name', 'description', 'status', 'traffic_pct', 'started_at', 'ended_at'];
  const setClauses = [];
  const params = [workspaceId, id];

  for (const key of allowed) {
    if (key in data) {
      params.push(data[key]);
      setClauses.push(`${key} = $${params.length}`);
    }
  }

  // Auto-set started_at when switching to running
  if (data.status === 'running' && !data.started_at) {
    setClauses.push(`started_at = COALESCE(started_at, NOW())`);
  }
  // Auto-set ended_at when completing
  if ((data.status === 'completed' || data.status === 'paused') && !data.ended_at) {
    if (data.status === 'completed') {
      setClauses.push(`ended_at = COALESCE(ended_at, NOW())`);
    }
  }

  if (setClauses.length === 0) return getExperiment(pool, workspaceId, id);
  setClauses.push(`updated_at = NOW()`);

  const { rows } = await pool.query(
    `UPDATE ab_experiments SET ${setClauses.join(', ')}
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    params,
  );
  if (!rows.length) return null;
  return getExperiment(pool, workspaceId, id);
}

export async function deleteExperiment(pool, workspaceId, id) {
  const { rowCount } = await pool.query(
    `DELETE FROM ab_experiments WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, id],
  );
  return rowCount > 0;
}

export async function selectVariant(pool, experimentId, userId = null) {
  const { rows: variants } = await pool.query(
    `SELECT v.id, v.name, v.creative_id, v.weight
     FROM ab_variants v
     JOIN ab_experiments e ON e.id = v.experiment_id
     WHERE v.experiment_id = $1 AND e.status = 'running'
     ORDER BY v.weight DESC, v.id ASC`,
    [experimentId],
  );

  if (!variants.length) return null;

  // Weighted random selection
  const totalWeight = variants.reduce((sum, v) => sum + Number(v.weight), 0);
  let rand;

  if (userId) {
    // Deterministic selection based on userId + experimentId for consistent user experience
    const hash = userId.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) % 1000000, 0);
    rand = (hash % Math.round(totalWeight * 100)) / 100;
  } else {
    rand = Math.random() * totalWeight;
  }

  let cumulative = 0;
  for (const variant of variants) {
    cumulative += Number(variant.weight);
    if (rand < cumulative) return variant;
  }
  return variants[variants.length - 1];
}

export async function recordVariantImpression(pool, experimentId, variantId) {
  const { rows } = await pool.query(
    `UPDATE ab_variants
     SET impressions = impressions + 1
     WHERE id = $1 AND experiment_id = $2
     RETURNING id, impressions`,
    [variantId, experimentId],
  );
  return rows[0] ?? null;
}

export async function getExperimentResults(pool, workspaceId, id) {
  const experiment = await getExperiment(pool, workspaceId, id);
  if (!experiment) return null;

  const totalImpressions = experiment.variants.reduce(
    (sum, v) => sum + Number(v.impressions || 0), 0,
  );
  const totalClicks = experiment.variants.reduce(
    (sum, v) => sum + Number(v.clicks || 0), 0,
  );

  const variantsWithStats = experiment.variants.map(v => {
    const imps = Number(v.impressions || 0);
    const clks = Number(v.clicks || 0);
    const ctr  = imps > 0 ? Math.round((clks / imps) * 100 * 100) / 100 : 0;
    const share = totalImpressions > 0
      ? Math.round((imps / totalImpressions) * 100 * 10) / 10
      : 0;
    return { ...v, ctr, impressionShare: share };
  });

  const winner = variantsWithStats.length > 0
    ? variantsWithStats.reduce((best, v) => v.ctr > best.ctr ? v : best)
    : null;

  return {
    experiment,
    variants: variantsWithStats,
    summary: {
      totalImpressions,
      totalClicks,
      overallCtr: totalImpressions > 0
        ? Math.round((totalClicks / totalImpressions) * 100 * 100) / 100
        : 0,
      winner: winner?.id ?? null,
      winnerName: winner?.name ?? null,
    },
  };
}
