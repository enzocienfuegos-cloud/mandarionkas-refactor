import { getServerEnv } from '../env.mjs';
import { checkPostgresConnection, executePostgresQuery, getPostgresMetadata, withPostgresTransaction } from './postgres-client.mjs';

const env = getServerEnv();

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function table(name) {
  return `${quoteIdentifier(getPostgresMetadata().schema)}.${quoteIdentifier(name)}`;
}

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

function serializeJson(value) {
  return JSON.stringify(value ?? null);
}

function mapClientRow(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    brandColor: row.brand_color ?? undefined,
    ownerUserId: row.owner_user_id,
    memberUserIds: parseJson(row.member_user_ids, []),
    members: parseJson(row.members, []),
    invites: parseJson(row.invites, []),
    brands: parseJson(row.brands, []),
  };
}

function mapSessionRow(row) {
  return {
    userId: row.user_id,
    activeClientId: row.active_client_id ?? undefined,
    issuedAt: row.issued_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    persistenceMode: row.persistence_mode ?? 'session',
  };
}

function mapProjectRow(row) {
  return {
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at ?? undefined,
    clientId: row.client_id,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name,
    brandId: row.brand_id ?? undefined,
    brandName: row.brand_name ?? undefined,
    campaignName: row.campaign_name ?? undefined,
    accessScope: row.access_scope ?? 'client',
    canvasPresetId: row.canvas_preset_id ?? undefined,
    sceneCount: Number(row.scene_count || 0),
    widgetCount: Number(row.widget_count || 0),
    archivedAt: row.archived_at ?? undefined,
  };
}

function mapProjectVersionRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    versionNumber: Number(row.version_number || 0),
    savedAt: row.saved_at,
    note: row.note ?? undefined,
  };
}

function mapAuditEventRow(row) {
  return {
    id: row.id,
    action: row.action,
    target: row.target,
    actorUserId: row.actor_user_id ?? undefined,
    actorName: row.actor_name ?? undefined,
    clientId: row.client_id ?? undefined,
    targetId: row.target_id ?? undefined,
    summary: row.summary,
    at: row.at,
    metadata: parseJson(row.metadata, undefined),
  };
}

function mapRecordRow(row, fallbackFactory) {
  return fallbackFactory(row);
}

async function selectRows(name, columns = '*') {
  const result = await executePostgresQuery(`SELECT ${columns} FROM ${table(name)}`);
  return result.rows ?? [];
}

export function getRepositoryMetadata() {
  return {
    driver: 'postgres',
    ...getPostgresMetadata(),
  };
}

export async function checkRepositoryReadiness() {
  const connection = await checkPostgresConnection();
  return {
    ...connection,
    driver: 'postgres',
  };
}

export async function listClientSidecars() {
  return [];
}

export async function listProjectSidecars() {
  return [];
}

export async function listProjectStateSidecars() {
  return [];
}

export async function listProjectVersionSidecars() {
  return [];
}

export async function listProjectVersionStateSidecars() {
  return [];
}

export async function listAssetFolderSidecars() {
  return [];
}

export async function listAssetSidecars() {
  return [];
}

export async function writeClientSidecar(_client) {}

export async function writeProjectSidecar(_project) {}

export async function writeProjectStateSidecar(_projectId, _state) {}

export async function writeProjectVersionSidecar(_version) {}

export async function writeProjectVersionStateSidecar(_versionId, _state) {}

export async function writeAssetFolderSidecar(_folder) {}

export async function writeAssetSidecar(_asset) {}

export async function deleteProjectSidecar(_projectId) {}

export async function deleteProjectStateSidecar(_projectId) {}

export async function deleteProjectVersionSidecar(_versionId) {}

export async function deleteProjectVersionStateSidecar(_versionId) {}

export async function deleteAssetSidecar(_assetId) {}

export async function listProjects() {
  const result = await executePostgresQuery(`SELECT * FROM ${table('projects')} ORDER BY updated_at DESC NULLS LAST, id ASC`);
  return (result.rows ?? []).map(mapProjectRow);
}

export async function getProject(projectId) {
  const result = await executePostgresQuery(`SELECT * FROM ${table('projects')} WHERE id = $1 LIMIT 1`, [projectId]);
  const row = result.rows?.[0];
  return row ? mapProjectRow(row) : null;
}

export async function getProjectState(projectId) {
  const result = await executePostgresQuery(`SELECT state FROM ${table('project_states')} WHERE project_id = $1 LIMIT 1`, [projectId]);
  return parseJson(result.rows?.[0]?.state, null);
}

export async function upsertProject(project, state) {
  await withPostgresTransaction(async (query) => {
    await query(
      `INSERT INTO ${table('projects')} (
        id, name, updated_at, client_id, owner_user_id, owner_name, brand_id, brand_name, campaign_name,
        access_scope, canvas_preset_id, scene_count, widget_count, archived_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = EXCLUDED.updated_at,
        client_id = EXCLUDED.client_id,
        owner_user_id = EXCLUDED.owner_user_id,
        owner_name = EXCLUDED.owner_name,
        brand_id = EXCLUDED.brand_id,
        brand_name = EXCLUDED.brand_name,
        campaign_name = EXCLUDED.campaign_name,
        access_scope = EXCLUDED.access_scope,
        canvas_preset_id = EXCLUDED.canvas_preset_id,
        scene_count = EXCLUDED.scene_count,
        widget_count = EXCLUDED.widget_count,
        archived_at = EXCLUDED.archived_at`,
      [
        project.id,
        project.name,
        project.updatedAt ?? null,
        project.clientId,
        project.ownerUserId,
        project.ownerName,
        project.brandId ?? null,
        project.brandName ?? null,
        project.campaignName ?? null,
        project.accessScope ?? 'client',
        project.canvasPresetId ?? null,
        project.sceneCount ?? 0,
        project.widgetCount ?? 0,
        project.archivedAt ?? null,
      ]
    );
    await query(
      `INSERT INTO ${table('project_states')} (project_id, state)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (project_id) DO UPDATE SET state = EXCLUDED.state`,
      [project.id, serializeJson(state)]
    );
  });
  return project;
}

export async function deleteProjectGraph(projectId) {
  await executePostgresQuery(`DELETE FROM ${table('projects')} WHERE id = $1`, [projectId]);
}

export async function listProjectVersions(projectId) {
  const result = await executePostgresQuery(
    `SELECT * FROM ${table('project_versions')}
     WHERE project_id = $1
     ORDER BY version_number DESC, saved_at DESC NULLS LAST, id DESC`,
    [projectId]
  );
  return (result.rows ?? []).map(mapProjectVersionRow);
}

export async function getProjectVersionState(versionId) {
  const result = await executePostgresQuery(
    `SELECT state FROM ${table('project_version_states')} WHERE version_id = $1 LIMIT 1`,
    [versionId]
  );
  return parseJson(result.rows?.[0]?.state, null);
}

export async function createProjectVersion(version, state) {
  await withPostgresTransaction(async (query) => {
    await query(
      `INSERT INTO ${table('project_versions')} (
        id, project_id, project_name, version_number, saved_at, note
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        version.id,
        version.projectId,
        version.projectName,
        version.versionNumber ?? 0,
        version.savedAt ?? null,
        version.note ?? null,
      ]
    );
    await query(
      `INSERT INTO ${table('project_version_states')} (version_id, state)
       VALUES ($1, $2::jsonb)`,
      [version.id, serializeJson(state)]
    );
  });
  return version;
}

export async function appendAuditEventRecord(event) {
  const persisted = {
    ...event,
    metadata: event.metadata && typeof event.metadata === 'object' ? event.metadata : undefined,
  };
  await withPostgresTransaction(async (query) => {
    await query(
      `INSERT INTO ${table('audit_events')} (
        id, action, target, actor_user_id, actor_name, client_id, target_id, summary, at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
      [
        persisted.id,
        persisted.action,
        persisted.target,
        persisted.actorUserId ?? null,
        persisted.actorName ?? null,
        persisted.clientId ?? null,
        persisted.targetId ?? null,
        persisted.summary,
        persisted.at,
        serializeJson(persisted.metadata ?? null),
      ]
    );
    await query(
      `DELETE FROM ${table('audit_events')}
       WHERE id IN (
         SELECT id FROM ${table('audit_events')}
         ORDER BY at DESC, id DESC
         OFFSET 500
       )`
    );
  });
  return persisted;
}

export async function listUsers() {
  const result = await executePostgresQuery(`SELECT * FROM ${table('users')} ORDER BY id ASC`);
  return (result.rows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role,
  }));
}

export async function getUserById(userId) {
  const result = await executePostgresQuery(`SELECT * FROM ${table('users')} WHERE id = $1 LIMIT 1`, [userId]);
  const row = result.rows?.[0];
  return row ? {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role,
  } : null;
}

export async function getUserByEmail(email) {
  const result = await executePostgresQuery(
    `SELECT * FROM ${table('users')} WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email]
  );
  const row = result.rows?.[0];
  return row ? {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role,
  } : null;
}

export async function listClients() {
  const result = await executePostgresQuery(`SELECT * FROM ${table('clients')} ORDER BY name ASC, id ASC`);
  return (result.rows ?? []).map(mapClientRow);
}

export async function getClient(clientId) {
  const result = await executePostgresQuery(`SELECT * FROM ${table('clients')} WHERE id = $1 LIMIT 1`, [clientId]);
  const row = result.rows?.[0];
  return row ? mapClientRow(row) : null;
}

export async function upsertClient(client) {
  await executePostgresQuery(
    `INSERT INTO ${table('clients')} (
      id, name, slug, brand_color, owner_user_id, member_user_ids, members, invites, brands
    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      slug = EXCLUDED.slug,
      brand_color = EXCLUDED.brand_color,
      owner_user_id = EXCLUDED.owner_user_id,
      member_user_ids = EXCLUDED.member_user_ids,
      members = EXCLUDED.members,
      invites = EXCLUDED.invites,
      brands = EXCLUDED.brands`,
    [
      client.id,
      client.name,
      client.slug,
      client.brandColor ?? null,
      client.ownerUserId,
      serializeJson(client.memberUserIds ?? []),
      serializeJson(client.members ?? []),
      serializeJson(client.invites ?? []),
      serializeJson(client.brands ?? []),
    ]
  );
  return client;
}

export async function createSessionRecord(sessionId, session) {
  await executePostgresQuery(
    `INSERT INTO ${table('sessions')} (
      id, user_id, active_client_id, issued_at, expires_at, persistence_mode
    ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      sessionId,
      session.userId,
      session.activeClientId ?? null,
      session.issuedAt ?? null,
      session.expiresAt ?? null,
      session.persistenceMode ?? 'session',
    ]
  );
  return session;
}

export async function getSessionRecord(sessionId) {
  const result = await executePostgresQuery(`SELECT * FROM ${table('sessions')} WHERE id = $1 LIMIT 1`, [sessionId]);
  const row = result.rows?.[0];
  return row ? mapSessionRow(row) : null;
}

export async function updateSessionActiveClient(sessionId, activeClientId) {
  const result = await executePostgresQuery(
    `UPDATE ${table('sessions')}
     SET active_client_id = $2
     WHERE id = $1
     RETURNING *`,
    [sessionId, activeClientId ?? null]
  );
  const row = result.rows?.[0];
  return row ? mapSessionRow(row) : null;
}

export async function deleteSessionRecord(sessionId) {
  const result = await executePostgresQuery(`DELETE FROM ${table('sessions')} WHERE id = $1`, [sessionId]);
  return Number(result.rowCount || 0) > 0;
}

export async function cleanupExpiredSessionRecords(cutoffIso) {
  const selectResult = await executePostgresQuery(
    `SELECT id FROM ${table('sessions')}
     WHERE expires_at IS NULL OR expires_at <= $1`,
    [cutoffIso]
  );
  const removedSessionIds = (selectResult.rows ?? []).map((row) => row.id);
  if (!removedSessionIds.length) return [];
  await executePostgresQuery(
    `DELETE FROM ${table('sessions')}
     WHERE id = ANY($1::text[])`,
    [removedSessionIds]
  );
  return removedSessionIds;
}

export async function listAuditEvents(options = {}) {
  const params = [];
  const predicates = [];
  if (options.action) {
    params.push(String(options.action).trim());
    predicates.push(`action = $${params.length}`);
  }
  if (options.target) {
    params.push(String(options.target).trim());
    predicates.push(`target = $${params.length}`);
  }
  if (options.clientId) {
    params.push(String(options.clientId).trim());
    predicates.push(`client_id = $${params.length}`);
  }
  if (options.before) {
    params.push(String(options.before).trim());
    predicates.push(`at < $${params.length}`);
  }
  const normalizedLimit = Math.max(1, Math.min(500, Number(options.limit) || 100));
  params.push(normalizedLimit);
  const whereClause = predicates.length ? `WHERE ${predicates.join(' AND ')}` : '';
  const result = await executePostgresQuery(
    `SELECT * FROM ${table('audit_events')}
     ${whereClause}
     ORDER BY at DESC, id DESC
     LIMIT $${params.length}`,
    params
  );
  const events = (result.rows ?? []).map(mapAuditEventRow);
  return {
    ok: true,
    events,
    nextCursor: events.length === normalizedLimit ? events[events.length - 1]?.at || null : null,
  };
}

export async function upsertDocumentSlot(record) {
  await executePostgresQuery(
    `INSERT INTO ${table('document_slots')} (
      id, scope, client_id, user_id, project_id, updated_at, state
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      scope = EXCLUDED.scope,
      client_id = EXCLUDED.client_id,
      user_id = EXCLUDED.user_id,
      project_id = EXCLUDED.project_id,
      updated_at = EXCLUDED.updated_at,
      state = EXCLUDED.state`,
    [
      record.id,
      record.scope,
      record.clientId,
      record.userId,
      record.projectId ?? null,
      record.updatedAt ?? null,
      serializeJson(record),
    ]
  );
  return record;
}

export async function listDocumentSlots(options = {}) {
  const params = [];
  const predicates = [];
  if (options.scope) {
    params.push(String(options.scope));
    predicates.push(`scope = $${params.length}`);
  }
  if (options.clientId) {
    params.push(String(options.clientId));
    predicates.push(`client_id = $${params.length}`);
  }
  if (options.userId) {
    params.push(String(options.userId));
    predicates.push(`user_id = $${params.length}`);
  }
  if (options.projectId) {
    params.push(String(options.projectId));
    predicates.push(`project_id = $${params.length}`);
  }
  const whereClause = predicates.length ? `WHERE ${predicates.join(' AND ')}` : '';
  const result = await executePostgresQuery(
    `SELECT * FROM ${table('document_slots')} ${whereClause} ORDER BY updated_at DESC NULLS LAST, id DESC`,
    params
  );
  return (result.rows ?? []).map((row) => mapRecordRow(row, (entry) => ({
    id: entry.id,
    scope: entry.scope,
    clientId: entry.client_id,
    userId: entry.user_id,
    projectId: entry.project_id ?? undefined,
    updatedAt: entry.updated_at ?? undefined,
    state: parseJson(entry.state, null),
  })));
}

export async function deleteDocumentSlots(options = {}) {
  const slots = await listDocumentSlots(options);
  const filtered = options.before
    ? slots.filter((entry) => String(entry.updatedAt || '') < String(options.before))
    : slots;
  const ids = filtered.map((entry) => entry.id).filter(Boolean);
  if (!ids.length) return [];
  await executePostgresQuery(
    `DELETE FROM ${table('document_slots')} WHERE id = ANY($1::text[])`,
    [ids]
  );
  return filtered;
}

export async function listAssetFolders() {
  const result = await executePostgresQuery(`SELECT * FROM ${table('asset_folders')} ORDER BY created_at DESC NULLS LAST, id DESC`);
  return (result.rows ?? []).map((row) => mapRecordRow(row, (entry) => ({
    id: entry.id,
    clientId: entry.client_id,
    ownerUserId: entry.owner_user_id,
    parentId: entry.parent_id ?? undefined,
    name: entry.name,
    createdAt: entry.created_at ?? undefined,
  })));
}

export async function getAssetFolder(folderId) {
  const result = await executePostgresQuery(`SELECT * FROM ${table('asset_folders')} WHERE id = $1 LIMIT 1`, [folderId]);
  const row = result.rows?.[0];
  return row ? mapRecordRow(row, (entry) => ({
    id: entry.id,
    clientId: entry.client_id,
    ownerUserId: entry.owner_user_id,
    parentId: entry.parent_id ?? undefined,
    name: entry.name,
    createdAt: entry.created_at ?? undefined,
  })) : null;
}

export async function upsertAssetFolder(folder) {
  await executePostgresQuery(
    `INSERT INTO ${table('asset_folders')} (
      id, client_id, owner_user_id, parent_id, name, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (id) DO UPDATE SET
      client_id = EXCLUDED.client_id,
      owner_user_id = EXCLUDED.owner_user_id,
      parent_id = EXCLUDED.parent_id,
      name = EXCLUDED.name,
      created_at = EXCLUDED.created_at`,
    [
      folder.id,
      folder.clientId,
      folder.ownerUserId,
      folder.parentId ?? null,
      folder.name,
      folder.createdAt ?? null,
    ]
  );
  return folder;
}

export async function listAssets() {
  const result = await executePostgresQuery(`SELECT * FROM ${table('assets')} ORDER BY created_at DESC NULLS LAST, id DESC`);
  return (result.rows ?? []).map((row) => mapRecordRow(row, (entry) => ({
    id: entry.id,
    clientId: entry.client_id,
    ownerUserId: entry.owner_user_id,
    folderId: entry.folder_id ?? undefined,
    name: entry.name,
    kind: entry.kind,
    createdAt: entry.created_at ?? undefined,
  })));
}

export async function getAsset(assetId) {
  const result = await executePostgresQuery(`SELECT * FROM ${table('assets')} WHERE id = $1 LIMIT 1`, [assetId]);
  const row = result.rows?.[0];
  return row ? mapRecordRow(row, (entry) => ({
    id: entry.id,
    clientId: entry.client_id,
    ownerUserId: entry.owner_user_id,
    folderId: entry.folder_id ?? undefined,
    name: entry.name,
    kind: entry.kind,
    createdAt: entry.created_at ?? undefined,
  })) : null;
}

export async function upsertAsset(asset) {
  await executePostgresQuery(
    `INSERT INTO ${table('assets')} (
      id, client_id, owner_user_id, folder_id, name, kind, src, mime_type, source_type, storage_mode,
      storage_key, public_url, origin_url, poster_src, access_scope, tags, size_bytes, width, height,
      duration_ms, fingerprint, font_family, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17, $18, $19, $20, $21, $22, $23)
    ON CONFLICT (id) DO UPDATE SET
      client_id = EXCLUDED.client_id,
      owner_user_id = EXCLUDED.owner_user_id,
      folder_id = EXCLUDED.folder_id,
      name = EXCLUDED.name,
      kind = EXCLUDED.kind,
      src = EXCLUDED.src,
      mime_type = EXCLUDED.mime_type,
      source_type = EXCLUDED.source_type,
      storage_mode = EXCLUDED.storage_mode,
      storage_key = EXCLUDED.storage_key,
      public_url = EXCLUDED.public_url,
      origin_url = EXCLUDED.origin_url,
      poster_src = EXCLUDED.poster_src,
      access_scope = EXCLUDED.access_scope,
      tags = EXCLUDED.tags,
      size_bytes = EXCLUDED.size_bytes,
      width = EXCLUDED.width,
      height = EXCLUDED.height,
      duration_ms = EXCLUDED.duration_ms,
      fingerprint = EXCLUDED.fingerprint,
      font_family = EXCLUDED.font_family,
      created_at = EXCLUDED.created_at`,
    [
      asset.id,
      asset.clientId,
      asset.ownerUserId,
      asset.folderId ?? null,
      asset.name,
      asset.kind,
      asset.src ?? '',
      asset.mimeType ?? null,
      asset.sourceType ?? null,
      asset.storageMode ?? null,
      asset.storageKey ?? null,
      asset.publicUrl ?? null,
      asset.originUrl ?? null,
      asset.posterSrc ?? null,
      asset.accessScope ?? null,
      serializeJson(asset.tags ?? []),
      asset.sizeBytes ?? null,
      asset.width ?? null,
      asset.height ?? null,
      asset.durationMs ?? null,
      asset.fingerprint ?? null,
      asset.fontFamily ?? null,
      asset.createdAt ?? null,
    ]
  );
  return asset;
}

export async function deleteAssetRecord(assetId) {
  const asset = await getAsset(assetId);
  if (!asset) return null;
  await executePostgresQuery(`DELETE FROM ${table('assets')} WHERE id = $1`, [assetId]);
  return asset;
}
