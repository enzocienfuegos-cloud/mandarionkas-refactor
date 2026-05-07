import { randomUUID } from 'node:crypto';

function normalizeText(value, fallback = '') {
  return String(value || fallback).trim();
}

function normalizeSurface(value) {
  const surface = normalizeText(value);
  if (!surface) throw new Error('Surface is required.');
  return surface;
}

function normalizeName(value) {
  const name = normalizeText(value);
  if (!name) throw new Error('View name is required.');
  return name;
}

function normalizeJsonObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

function normalizeColumns(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))]
    : [];
}

function mapSavedView(row, userId) {
  return {
    id: row.id,
    name: row.name,
    surface: row.surface,
    filters: row.filters_json ?? {},
    sort: row.sort_json ?? null,
    columns: row.columns_json ?? [],
    isShared: Boolean(row.is_shared),
    workspaceId: row.workspace_id,
    userId: row.user_id,
    canDelete: row.user_id === userId,
    createdAt: row.created_at?.toISOString?.() || null,
    updatedAt: row.updated_at?.toISOString?.() || null,
  };
}

export async function listSavedViews(client, { userId, workspaceId, surface }) {
  const params = [workspaceId, userId];
  const conditions = ['workspace_id = $1', '(user_id = $2 or is_shared = true)'];

  if (surface) {
    params.push(surface);
    conditions.push(`surface = $${params.length}`);
  }

  const { rows } = await client.query(
    `select id, user_id, workspace_id, surface, name, filters_json, sort_json, columns_json, is_shared, created_at, updated_at
       from saved_views
      where ${conditions.join(' and ')}
      order by is_shared desc, updated_at desc`,
    params,
  );

  return rows.map((row) => mapSavedView(row, userId));
}

export async function getSavedView(client, { userId, workspaceId, savedViewId }) {
  const { rows } = await client.query(
    `select id, user_id, workspace_id, surface, name, filters_json, sort_json, columns_json, is_shared, created_at, updated_at
       from saved_views
      where id = $1
        and workspace_id = $2
        and (user_id = $3 or is_shared = true)
      limit 1`,
    [savedViewId, workspaceId, userId],
  );
  return rows[0] ? mapSavedView(rows[0], userId) : null;
}

export async function createSavedView(client, { userId, workspaceId, surface, name, filters, sort, columns, isShared }) {
  const id = randomUUID();
  await client.query(
    `insert into saved_views (
       id, user_id, workspace_id, surface, name, filters_json, sort_json, columns_json, is_shared, created_at, updated_at
     ) values (
       $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, now(), now()
     )`,
    [
      id,
      userId,
      workspaceId,
      normalizeSurface(surface),
      normalizeName(name),
      JSON.stringify(normalizeJsonObject(filters)),
      JSON.stringify(sort ? normalizeJsonObject(sort) : null),
      JSON.stringify(normalizeColumns(columns)),
      Boolean(isShared),
    ],
  );

  return getSavedView(client, { userId, workspaceId, savedViewId: id });
}

export async function deleteSavedView(client, { userId, workspaceId, savedViewId }) {
  const { rowCount } = await client.query(
    `delete from saved_views
      where id = $1
        and workspace_id = $2
        and user_id = $3`,
    [savedViewId, workspaceId, userId],
  );
  if (!rowCount) throw new Error('Saved view not found.');
  return true;
}
