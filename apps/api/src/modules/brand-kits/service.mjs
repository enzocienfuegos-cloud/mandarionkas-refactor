import { randomUUID } from 'node:crypto';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value, fallback = '') {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
}

function normalizeOptionalString(value) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function mapBrandKitRow(row) {
  const data = asObject(row.data_json);
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description || undefined,
    brandId: row.brand_id || undefined,
    brandName: row.brand_name || undefined,
    colors: asObject(data.colors),
    typography: asObject(data.typography),
    radii: asObject(data.radii),
    motion: asObject(data.motion),
    logos: asObject(data.logos),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function buildPayload(input) {
  const source = asObject(input);
  return {
    name: normalizeString(source.name, 'Untitled Brand Kit'),
    description: normalizeOptionalString(source.description),
    brandId: normalizeOptionalString(source.brandId),
    brandName: normalizeOptionalString(source.brandName),
    dataJson: {
      colors: asObject(source.colors),
      typography: asObject(source.typography),
      radii: asObject(source.radii),
      motion: asObject(source.motion),
      logos: asObject(source.logos),
    },
  };
}

export async function listBrandKitsForWorkspace(client, workspaceId) {
  const result = await client.query(
    `
      select id, workspace_id, name, description, brand_id, brand_name, data_json, created_at, updated_at
      from brand_kits
      where workspace_id = $1
      order by updated_at desc, created_at desc
    `,
    [workspaceId],
  );
  return result.rows.map(mapBrandKitRow);
}

export async function getBrandKitById(client, { brandKitId, workspaceId }) {
  const result = await client.query(
    `
      select id, workspace_id, name, description, brand_id, brand_name, data_json, created_at, updated_at
      from brand_kits
      where id = $1 and workspace_id = $2
      limit 1
    `,
    [brandKitId, workspaceId],
  );
  return result.rows[0] ? mapBrandKitRow(result.rows[0]) : null;
}

export async function createBrandKit(client, { workspaceId, input }) {
  const payload = buildPayload(input);
  const brandKitId = randomUUID();
  const result = await client.query(
    `
      insert into brand_kits (
        id,
        workspace_id,
        name,
        description,
        brand_id,
        brand_name,
        data_json
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb)
      returning id, workspace_id, name, description, brand_id, brand_name, data_json, created_at, updated_at
    `,
    [
      brandKitId,
      workspaceId,
      payload.name,
      payload.description,
      payload.brandId,
      payload.brandName,
      JSON.stringify(payload.dataJson),
    ],
  );
  return mapBrandKitRow(result.rows[0]);
}

export async function updateBrandKit(client, { brandKitId, workspaceId, input }) {
  const payload = buildPayload(input);
  const result = await client.query(
    `
      update brand_kits
      set name = $3,
          description = $4,
          brand_id = $5,
          brand_name = $6,
          data_json = $7::jsonb,
          updated_at = now()
      where id = $1 and workspace_id = $2
      returning id, workspace_id, name, description, brand_id, brand_name, data_json, created_at, updated_at
    `,
    [
      brandKitId,
      workspaceId,
      payload.name,
      payload.description,
      payload.brandId,
      payload.brandName,
      JSON.stringify(payload.dataJson),
    ],
  );
  return result.rows[0] ? mapBrandKitRow(result.rows[0]) : null;
}

export async function deleteBrandKit(client, { brandKitId, workspaceId }) {
  const result = await client.query(
    'delete from brand_kits where id = $1 and workspace_id = $2',
    [brandKitId, workspaceId],
  );
  return result.rowCount > 0;
}
