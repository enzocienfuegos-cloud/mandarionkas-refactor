export async function createCreativeIngestion(pool, {
  workspaceId,
  createdBy = null,
  sourceKind,
  originalFilename,
  mimeType = null,
  sizeBytes = null,
  storageKey = null,
  publicUrl = null,
  metadata = {},
}) {
  const { rows } = await pool.query(
    `INSERT INTO creative_ingestions (
       workspace_id, created_by, source_kind, original_filename,
       mime_type, size_bytes, storage_key, public_url, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
     RETURNING *`,
    [
      workspaceId,
      createdBy,
      sourceKind,
      originalFilename,
      mimeType,
      sizeBytes,
      storageKey,
      publicUrl,
      JSON.stringify(metadata ?? {}),
    ],
  );
  return rows[0] ?? null;
}

export async function getCreativeIngestion(pool, workspaceId, ingestionId) {
  const { rows } = await pool.query(
    `SELECT *
     FROM creative_ingestions
     WHERE workspace_id = $1
       AND id = $2`,
    [workspaceId, ingestionId],
  );
  return rows[0] ?? null;
}

export async function listCreativeIngestions(pool, workspaceId, opts = {}) {
  const params = [workspaceId];
  const conditions = ['workspace_id = $1'];

  if (opts.status) {
    params.push(opts.status);
    conditions.push(`status = $${params.length}`);
  }
  if (opts.sourceKind) {
    params.push(opts.sourceKind);
    conditions.push(`source_kind = $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT *
     FROM creative_ingestions
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT 100`,
    params,
  );
  return rows;
}

export async function updateCreativeIngestion(pool, workspaceId, ingestionId, patch = {}) {
  const fieldMap = {
    creativeId: 'creative_id',
    creativeVersionId: 'creative_version_id',
    status: 'status',
    mimeType: 'mime_type',
    sizeBytes: 'size_bytes',
    storageKey: 'storage_key',
    publicUrl: 'public_url',
    checksum: 'checksum',
    metadata: 'metadata',
    validationReport: 'validation_report',
    errorCode: 'error_code',
    errorDetail: 'error_detail',
  };

  const params = [workspaceId, ingestionId];
  const setClauses = [];

  for (const [camel, column] of Object.entries(fieldMap)) {
    if (!(camel in patch)) continue;
    let value = patch[camel];
    if (column === 'metadata' || column === 'validation_report') {
      value = JSON.stringify(value ?? {});
      setClauses.push(`${column} = $${params.length + 1}::jsonb`);
    } else {
      setClauses.push(`${column} = $${params.length + 1}`);
    }
    params.push(value);
  }

  if (!setClauses.length) {
    return getCreativeIngestion(pool, workspaceId, ingestionId);
  }

  setClauses.push('updated_at = NOW()');

  const { rows } = await pool.query(
    `UPDATE creative_ingestions
     SET ${setClauses.join(', ')}
     WHERE workspace_id = $1
       AND id = $2
     RETURNING *`,
    params,
  );
  return rows[0] ?? null;
}
