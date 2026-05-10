import { createEmptyDb, normalizeDb } from '../server/data/db-shape.mjs';
import { executePostgresQuery, getPostgresMetadata, withPostgresTransaction } from '../server/data/postgres-client.mjs';

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

function mapRecordRow(row, fallbackFactory) {
  return fallbackFactory(row);
}

function groupProjectVersions(rows) {
  return rows.reduce((accumulator, version) => {
    const projectId = version.projectId;
    if (!projectId) return accumulator;
    accumulator[projectId] ??= [];
    accumulator[projectId].push(version);
    accumulator[projectId].sort((left, right) => {
      const leftOrder = typeof left.versionNumber === 'number' ? left.versionNumber : 0;
      const rightOrder = typeof right.versionNumber === 'number' ? right.versionNumber : 0;
      return rightOrder - leftOrder;
    });
    return accumulator;
  }, {});
}

async function selectRows(name, columns = '*') {
  const result = await executePostgresQuery(`SELECT ${columns} FROM ${table(name)}`);
  return result.rows ?? [];
}

async function clearSnapshot(query) {
  const orderedTables = [
    'audit_events',
    'project_version_states',
    'project_versions',
    'project_states',
    'assets',
    'asset_folders',
    'document_slots',
    'sessions',
    'projects',
    'clients',
    'users',
  ];
  for (const name of orderedTables) {
    await query(`DELETE FROM ${table(name)}`);
  }
}

async function insertUsers(query, users) {
  for (const user of users) {
    await query(
      `INSERT INTO ${table('users')} (id, name, email, password, role)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, user.name, user.email, user.password, user.role]
    );
  }
}

async function insertClients(query, clients) {
  for (const client of clients) {
    await query(
      `INSERT INTO ${table('clients')} (
        id, name, slug, brand_color, owner_user_id, member_user_ids, members, invites, brands
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb)`,
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
  }
}

async function insertProjects(query, projects) {
  for (const project of projects) {
    await query(
      `INSERT INTO ${table('projects')} (
        id, name, updated_at, client_id, owner_user_id, owner_name, brand_id, brand_name, campaign_name,
        access_scope, canvas_preset_id, scene_count, widget_count, archived_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
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
  }
}

async function insertProjectStates(query, projectStates) {
  for (const [projectId, state] of Object.entries(projectStates || {})) {
    await query(
      `INSERT INTO ${table('project_states')} (project_id, state)
       VALUES ($1, $2::jsonb)`,
      [projectId, serializeJson(state)]
    );
  }
}

async function insertProjectVersions(query, projectVersions) {
  for (const version of Object.values(projectVersions || {}).flatMap((entry) => (Array.isArray(entry) ? entry : []))) {
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
  }
}

async function insertProjectVersionStates(query, projectVersionStates) {
  for (const [versionId, state] of Object.entries(projectVersionStates || {})) {
    await query(
      `INSERT INTO ${table('project_version_states')} (version_id, state)
       VALUES ($1, $2::jsonb)`,
      [versionId, serializeJson(state)]
    );
  }
}

async function insertDocumentSlots(query, documentSlots) {
  for (const record of Object.values(documentSlots || {})) {
    if (!record?.id) continue;
    await query(
      `INSERT INTO ${table('document_slots')} (
        id, scope, client_id, user_id, project_id, updated_at, state
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
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
  }
}

async function insertAssetFolders(query, assetFolders) {
  for (const folder of assetFolders || []) {
    await query(
      `INSERT INTO ${table('asset_folders')} (
        id, client_id, owner_user_id, parent_id, name, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        folder.id,
        folder.clientId,
        folder.ownerUserId,
        folder.parentId ?? null,
        folder.name,
        folder.createdAt ?? null,
      ]
    );
  }
}

async function insertAssets(query, assets) {
  for (const asset of assets || []) {
    await query(
      `INSERT INTO ${table('assets')} (
        id, client_id, owner_user_id, folder_id, name, kind, src, mime_type, source_type, storage_mode,
        storage_key, public_url, origin_url, poster_src, access_scope, tags, size_bytes, width, height,
        duration_ms, fingerprint, font_family, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17, $18, $19, $20, $21, $22, $23)`,
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
  }
}

async function insertSessions(query, sessions) {
  for (const [sessionId, session] of Object.entries(sessions || {})) {
    await query(
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
  }
}

async function insertAuditEvents(query, auditEvents) {
  for (const event of auditEvents || []) {
    await query(
      `INSERT INTO ${table('audit_events')} (
        id, action, target, actor_user_id, actor_name, client_id, target_id, summary, at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
      [
        event.id,
        event.action,
        event.target,
        event.actorUserId ?? null,
        event.actorName ?? null,
        event.clientId ?? null,
        event.targetId ?? null,
        event.summary,
        event.at,
        serializeJson(event.metadata ?? null),
      ]
    );
  }
}

export async function seedSnapshotIfEmpty() {
  const result = await executePostgresQuery(
    `SELECT
      (SELECT COUNT(*) FROM ${table('users')}) AS users_count,
      (SELECT COUNT(*) FROM ${table('clients')}) AS clients_count,
      (SELECT COUNT(*) FROM ${table('projects')}) AS projects_count`
  );
  const row = result.rows?.[0] ?? {};
  const total = Number(row.users_count || 0) + Number(row.clients_count || 0) + Number(row.projects_count || 0);
  if (total > 0) return false;
  await writeDb(createEmptyDb());
  return true;
}

export async function readDb() {
  await seedSnapshotIfEmpty();

  const [
    userRows,
    clientRows,
    projectRows,
    projectStateRows,
    projectVersionRows,
    projectVersionStateRows,
    documentSlotRows,
    assetFolderRows,
    assetRows,
    sessionRows,
    auditEventRows,
  ] = await Promise.all([
    selectRows('users'),
    selectRows('clients'),
    selectRows('projects'),
    selectRows('project_states'),
    selectRows('project_versions'),
    selectRows('project_version_states'),
    selectRows('document_slots'),
    selectRows('asset_folders'),
    selectRows('assets'),
    selectRows('sessions'),
    selectRows('audit_events'),
  ]);

  return normalizeDb({
    users: userRows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      password: row.password,
      role: row.role,
    })),
    clients: clientRows.map(mapClientRow),
    projects: projectRows.map(mapProjectRow).sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''))),
    projectStates: Object.fromEntries(projectStateRows.map((row) => [row.project_id, parseJson(row.state, null)]).filter(([, state]) => state && typeof state === 'object')),
    projectVersions: groupProjectVersions(projectVersionRows.map(mapProjectVersionRow)),
    projectVersionStates: Object.fromEntries(projectVersionStateRows.map((row) => [row.version_id, parseJson(row.state, null)]).filter(([, state]) => state && typeof state === 'object')),
    documentSlots: Object.fromEntries(documentSlotRows.map((row) => {
      const record = mapRecordRow(row, (entry) => ({
        id: entry.id,
        scope: entry.scope,
        clientId: entry.client_id,
        userId: entry.user_id,
        projectId: entry.project_id ?? undefined,
        updatedAt: entry.updated_at ?? undefined,
        state: parseJson(entry.state, null),
      }));
      return [record.id, record];
    })),
    assetFolders: assetFolderRows.map((row) => mapRecordRow(row, (entry) => ({
      id: entry.id,
      clientId: entry.client_id,
      ownerUserId: entry.owner_user_id,
      parentId: entry.parent_id ?? undefined,
      name: entry.name,
      createdAt: entry.created_at ?? undefined,
    }))).sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || ''))),
    assets: assetRows.map((row) => mapRecordRow(row, (entry) => ({
      id: entry.id,
      clientId: entry.client_id,
      ownerUserId: entry.owner_user_id,
      folderId: entry.folder_id ?? undefined,
      name: entry.name,
      kind: entry.kind,
      src: entry.src ?? '',
      mimeType: entry.mime_type ?? undefined,
      sourceType: entry.source_type ?? undefined,
      storageMode: entry.storage_mode ?? undefined,
      storageKey: entry.storage_key ?? undefined,
      publicUrl: entry.public_url ?? undefined,
      originUrl: entry.origin_url ?? undefined,
      posterSrc: entry.poster_src ?? undefined,
      accessScope: entry.access_scope ?? undefined,
      tags: parseJson(entry.tags, []),
      sizeBytes: typeof entry.size_bytes === 'number' ? entry.size_bytes : undefined,
      width: typeof entry.width === 'number' ? entry.width : undefined,
      height: typeof entry.height === 'number' ? entry.height : undefined,
      durationMs: typeof entry.duration_ms === 'number' ? entry.duration_ms : undefined,
      fingerprint: entry.fingerprint ?? undefined,
      fontFamily: entry.font_family ?? undefined,
      createdAt: entry.created_at ?? undefined,
    }))).sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || ''))),
    sessions: Object.fromEntries(sessionRows.map((row) => [row.id, {
      userId: row.user_id,
      activeClientId: row.active_client_id ?? undefined,
      issuedAt: row.issued_at,
      expiresAt: row.expires_at,
      persistenceMode: row.persistence_mode ?? 'session',
    }])),
    auditEvents: auditEventRows
      .map((row) => ({
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
      }))
      .sort((left, right) => String(right.at || '').localeCompare(String(left.at || ''))),
  });
}

export async function writeDb(db) {
  const normalized = normalizeDb(db);
  await withPostgresTransaction(async (query) => {
    await clearSnapshot(query);
    await insertUsers(query, normalized.users);
    await insertClients(query, normalized.clients);
    await insertProjects(query, normalized.projects);
    await insertProjectStates(query, normalized.projectStates);
    await insertProjectVersions(query, normalized.projectVersions);
    await insertProjectVersionStates(query, normalized.projectVersionStates);
    await insertDocumentSlots(query, normalized.documentSlots);
    await insertAssetFolders(query, normalized.assetFolders);
    await insertAssets(query, normalized.assets);
    await insertSessions(query, normalized.sessions);
    await insertAuditEvents(query, normalized.auditEvents);
  });
}
