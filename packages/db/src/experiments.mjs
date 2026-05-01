import { randomUUID } from 'node:crypto';

function normalizeStatus(status, fallback = 'paused') {
  const value = String(status || fallback).trim().toLowerCase();
  if (value === 'active') return 'running';
  if (value === 'ended') return 'completed';
  if (['draft', 'running', 'paused', 'completed', 'archived'].includes(value)) return value;
  throw new Error(`Unsupported experiment status: ${status}`);
}

function normalizeVariants(input) {
  const variants = Array.isArray(input) ? input : [];
  if (variants.length < 2) throw new Error('At least 2 variants required.');
  const normalized = variants.map((variant) => {
    const name = String(variant?.name || '').trim();
    const weight = Number(variant?.weight ?? 0);
    if (!name) throw new Error('All variants must have a name.');
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
      throw new Error('Variant weights must be between 0 and 100.');
    }
    return {
      id: variant?.id ? String(variant.id).trim() : randomUUID(),
      name,
      weight: Math.round(weight),
      creativeSizeVariantId: variant?.creativeSizeVariantId ? String(variant.creativeSizeVariantId).trim() : null,
      metadata: variant?.metadata && typeof variant.metadata === 'object' ? variant.metadata : {},
    };
  });
  const totalWeight = normalized.reduce((sum, variant) => sum + variant.weight, 0);
  if (totalWeight !== 100) throw new Error(`Variant weights must sum to 100 (currently ${totalWeight}).`);
  return normalized;
}

function mapVariant(row) {
  return {
    id: row.id,
    name: row.name,
    weight: Number(row.weight || 0),
    creativeSizeVariantId: row.creative_size_variant_id ?? null,
    metadata: row.metadata || {},
  };
}

function mapExperiment(row, variants = []) {
  return {
    id: row.id,
    name: row.name,
    tagId: row.tag_id,
    tagName: row.tag_name ?? null,
    status: row.status,
    variants,
    createdAt: row.created_at?.toISOString?.() || null,
    startedAt: row.started_at?.toISOString?.() || null,
    endedAt: row.ended_at?.toISOString?.() || null,
    summary: row.summary || {},
  };
}

export async function listExperiments(client, workspaceId) {
  const { rows } = await client.query(
    `SELECT e.id, e.tag_id, e.name, e.status, e.summary, e.created_at, e.started_at, e.ended_at,
            t.name AS tag_name,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', v.id,
                  'name', v.name,
                  'weight', v.weight,
                  'creativeSizeVariantId', v.creative_size_variant_id,
                  'metadata', v.metadata
                )
                ORDER BY v.created_at ASC
              ) FILTER (WHERE v.id IS NOT NULL),
              '[]'::json
            ) AS variants
     FROM experiments e
     JOIN ad_tags t
       ON t.workspace_id = e.workspace_id
      AND t.id = e.tag_id
     LEFT JOIN experiment_variants v
       ON v.workspace_id = e.workspace_id
      AND v.experiment_id = e.id
     WHERE e.workspace_id = $1
     GROUP BY e.id, t.name
     ORDER BY e.created_at DESC`,
    [workspaceId],
  );

  return rows.map((row) => mapExperiment(row, Array.isArray(row.variants) ? row.variants : []));
}

export async function getExperiment(client, workspaceId, experimentId) {
  const { rows } = await client.query(
    `SELECT e.id, e.tag_id, e.name, e.status, e.summary, e.created_at, e.started_at, e.ended_at,
            t.name AS tag_name,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', v.id,
                  'name', v.name,
                  'weight', v.weight,
                  'creativeSizeVariantId', v.creative_size_variant_id,
                  'metadata', v.metadata
                )
                ORDER BY v.created_at ASC
              ) FILTER (WHERE v.id IS NOT NULL),
              '[]'::json
            ) AS variants
     FROM experiments e
     JOIN ad_tags t
       ON t.workspace_id = e.workspace_id
      AND t.id = e.tag_id
     LEFT JOIN experiment_variants v
       ON v.workspace_id = e.workspace_id
      AND v.experiment_id = e.id
     WHERE e.workspace_id = $1
       AND e.id = $2
     GROUP BY e.id, t.name
     LIMIT 1`,
    [workspaceId, experimentId],
  );
  if (!rows[0]) return null;
  return mapExperiment(rows[0], Array.isArray(rows[0].variants) ? rows[0].variants : []);
}

export async function createExperiment(client, workspaceId, userId, input = {}) {
  const name = String(input?.name || '').trim();
  const tagId = String(input?.tagId || input?.tag_id || '').trim();
  if (!name) throw new Error('Experiment name is required.');
  if (!tagId) throw new Error('Select a tag.');
  const variants = normalizeVariants(input?.variants);
  const experimentId = randomUUID();

  await client.query('BEGIN');
  try {
    await client.query(
      `INSERT INTO experiments (
         id, workspace_id, tag_id, name, status, summary, created_by_user_id
       ) VALUES (
         $1, $2, $3, $4, 'paused', '{}'::jsonb, $5
       )`,
      [experimentId, workspaceId, tagId, name, userId],
    );

    for (const variant of variants) {
      await client.query(
        `INSERT INTO experiment_variants (
           id, workspace_id, experiment_id, name, weight, creative_size_variant_id, metadata
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7::jsonb
         )`,
        [
          variant.id,
          workspaceId,
          experimentId,
          variant.name,
          variant.weight,
          variant.creativeSizeVariantId,
          JSON.stringify(variant.metadata),
        ],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  return getExperiment(client, workspaceId, experimentId);
}

export async function updateExperiment(client, workspaceId, experimentId, input = {}) {
  const existing = await getExperiment(client, workspaceId, experimentId);
  if (!existing) throw new Error('Experiment not found.');

  const name = input?.name == null ? existing.name : String(input.name || '').trim();
  if (!name) throw new Error('Experiment name is required.');
  const status = input?.status == null ? existing.status : normalizeStatus(input.status, existing.status);

  const startedAt =
    status === 'running'
      ? (existing.startedAt || new Date().toISOString())
      : existing.startedAt;
  const endedAt =
    status === 'completed'
      ? new Date().toISOString()
      : (status === 'running' ? null : existing.endedAt);

  await client.query(
    `UPDATE experiments
     SET name = $3,
         status = $4,
         started_at = $5,
         ended_at = $6,
         updated_at = NOW()
     WHERE workspace_id = $1
       AND id = $2`,
    [workspaceId, experimentId, name, status, startedAt, endedAt],
  );

  return getExperiment(client, workspaceId, experimentId);
}

export async function startExperiment(client, workspaceId, experimentId) {
  return updateExperiment(client, workspaceId, experimentId, { status: 'running' });
}

export async function stopExperiment(client, workspaceId, experimentId) {
  return updateExperiment(client, workspaceId, experimentId, { status: 'completed' });
}

export async function getExperimentResults(client, workspaceId, experimentId) {
  const experiment = await getExperiment(client, workspaceId, experimentId);
  if (!experiment) throw new Error('Experiment not found.');

  const totalStatsResult = await client.query(
    `SELECT
        COALESCE(SUM(impressions), 0) AS impressions,
        COALESCE(SUM(clicks), 0) AS clicks
     FROM tag_daily_stats
     WHERE workspace_id = $1
       AND tag_id = $2`,
    [workspaceId, experiment.tagId],
  );

  const totalImpressions = Number(totalStatsResult.rows[0]?.impressions || 0);
  const totalClicks = Number(totalStatsResult.rows[0]?.clicks || 0);

  let winner = '';
  const variants = experiment.variants.map((variant) => {
    const share = Number(variant.weight || 0) / 100;
    const impressions = Math.round(totalImpressions * share);
    const clicks = Math.round(totalClicks * share);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    return {
      id: variant.id,
      variantId: variant.id,
      name: variant.name,
      variantName: variant.name,
      impressions,
      clicks,
      ctr,
    };
  });

  if (variants.length) {
    winner = [...variants].sort((a, b) => b.ctr - a.ctr || b.impressions - a.impressions)[0]?.id || '';
  }

  return {
    experiment,
    variants,
    totalImpressions,
    summary: {
      winner,
      totalImpressions,
    },
  };
}
