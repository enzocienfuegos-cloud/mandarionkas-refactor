import crypto from 'node:crypto';

function mapDbRoleToWorkspaceRole(role) {
  if (role === 'owner') return 'owner';
  if (role === 'viewer') return 'reviewer';
  return 'editor';
}

function mapWorkspaceRoleToDbRole(role) {
  if (role === 'owner') return 'owner';
  if (role === 'reviewer') return 'viewer';
  return 'admin';
}

function normalizeWorkspaceSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    return { brands: [], invites: [] };
  }
  return {
    ...settings,
    brands: Array.isArray(settings.brands) ? settings.brands : [],
    invites: Array.isArray(settings.invites) ? settings.invites : [],
  };
}

async function getWorkspaceOwnerId(pool, workspaceId) {
  const { rows } = await pool.query(
    `SELECT user_id
     FROM workspace_members
     WHERE workspace_id = $1 AND role = 'owner'
     ORDER BY invited_at ASC
     LIMIT 1`,
    [workspaceId],
  );
  return rows[0]?.user_id ?? null;
}

async function listStudioBrands(pool, workspaceId) {
  const { rows } = await pool.query(
    `SELECT id, name, primary_color, secondary_color, accent_color, logo_url, font_family
     FROM studio_brands
     WHERE workspace_id = $1
     ORDER BY created_at ASC`,
    [workspaceId],
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    primaryColor: row.primary_color ?? undefined,
    secondaryColor: row.secondary_color ?? undefined,
    accentColor: row.accent_color ?? undefined,
    logoUrl: row.logo_url ?? undefined,
    fontFamily: row.font_family ?? undefined,
  }));
}

async function listStudioInvites(pool, workspaceId) {
  const { rows } = await pool.query(
    `SELECT id, email, role, status, invited_at
     FROM studio_invites
     WHERE workspace_id = $1
     ORDER BY invited_at DESC`,
    [workspaceId],
  );
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    invitedAt: row.invited_at instanceof Date ? row.invited_at.toISOString() : new Date(row.invited_at).toISOString(),
  }));
}

export async function listStudioClientsForUser(pool, userId) {
  const { rows } = await pool.query(
    `SELECT w.id, w.name, w.slug, w.plan, w.logo_url, w.settings,
            wm.role AS current_role
     FROM workspaces w
     JOIN workspace_members wm
       ON wm.workspace_id = w.id
      AND wm.user_id = $1
      AND wm.status = 'active'
     ORDER BY w.name ASC`,
    [userId],
  );

  const clients = [];
  for (const row of rows) {
    const ownerUserId = await getWorkspaceOwnerId(pool, row.id);
    const [brands, invites] = await Promise.all([
      listStudioBrands(pool, row.id),
      listStudioInvites(pool, row.id),
    ]);
    const { rows: members } = await pool.query(
      `SELECT user_id, role, COALESCE(joined_at, invited_at, NOW()) AS added_at
       FROM workspace_members
       WHERE workspace_id = $1
       ORDER BY invited_at ASC`,
      [row.id],
    );

    clients.push({
      id: row.id,
      name: row.name,
      slug: row.slug,
      plan: row.plan,
      logoUrl: row.logo_url ?? null,
      ownerUserId,
      memberUserIds: members.map((member) => member.user_id),
      members: members.map((member) => ({
        userId: member.user_id,
        role: mapDbRoleToWorkspaceRole(member.role),
        addedAt: member.added_at instanceof Date ? member.added_at.toISOString() : new Date(member.added_at).toISOString(),
      })),
      invites,
      brands,
      currentRole: mapDbRoleToWorkspaceRole(row.current_role),
    });
  }

  return clients;
}

export async function createStudioClient(pool, { userId, name }) {
  const slugBase = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'workspace';

  const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;

  const { rows: workspaceRows } = await pool.query(
    `INSERT INTO workspaces (name, slug, plan, settings)
     VALUES ($1, $2, 'free', '{}'::jsonb)
     RETURNING id`,
    [name, slug],
  );
  const workspaceId = workspaceRows[0].id;

  await pool.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
     VALUES ($1, $2, 'owner', NOW())`,
    [workspaceId, userId],
  );

  return workspaceId;
}

export async function updateStudioClientSettings(pool, workspaceId, updater) {
  const { rows } = await pool.query(
    `SELECT settings
     FROM workspaces
     WHERE id = $1`,
    [workspaceId],
  );
  const current = normalizeWorkspaceSettings(rows[0]?.settings);
  const next = updater(current);
  await pool.query(
    `UPDATE workspaces
     SET settings = $2::jsonb,
         updated_at = NOW()
     WHERE id = $1`,
    [workspaceId, JSON.stringify(next)],
  );
  return next;
}

export { mapDbRoleToWorkspaceRole, mapWorkspaceRoleToDbRole };

export async function createStudioBrand(pool, { workspaceId, createdBy, name, primaryColor }) {
  const { rows } = await pool.query(
    `INSERT INTO studio_brands (
       workspace_id, created_by, name, primary_color, secondary_color, accent_color, font_family
     ) VALUES ($1, $2, $3, $4, '#0f172a', $4, 'Inter, system-ui, sans-serif')
     RETURNING *`,
    [workspaceId, createdBy ?? null, name, primaryColor ?? null],
  );
  return rows[0];
}

export async function createStudioInvite(pool, { workspaceId, email, role, invitedBy }) {
  const { rows } = await pool.query(
    `INSERT INTO studio_invites (workspace_id, email, role, status, invited_by, invited_at)
     VALUES ($1, lower($2), $3, 'pending', $4, NOW())
     ON CONFLICT (workspace_id, email)
     DO UPDATE SET
       role = EXCLUDED.role,
       status = CASE
         WHEN studio_invites.status = 'accepted' THEN 'accepted'
         ELSE 'pending'
       END,
       invited_by = EXCLUDED.invited_by,
       invited_at = NOW(),
       accepted_at = CASE
         WHEN studio_invites.status = 'accepted' THEN studio_invites.accepted_at
         ELSE NULL
       END
     RETURNING *`,
    [workspaceId, email, role, invitedBy ?? null],
  );
  return rows[0];
}

export async function listStudioProjects(pool, workspaceId) {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.updated_at, p.workspace_id, p.owner_user_id,
            p.brand_id, p.brand_name, p.campaign_name, p.access_scope,
            p.archived_at, p.canvas_preset_id, p.scene_count, p.widget_count,
            u.display_name AS owner_name
     FROM studio_projects p
     LEFT JOIN users u ON u.id = p.owner_user_id
     WHERE p.workspace_id = $1
     ORDER BY p.updated_at DESC`,
    [workspaceId],
  );
  return rows;
}

export async function getStudioProject(pool, workspaceId, projectId) {
  const { rows } = await pool.query(
    `SELECT *
     FROM studio_projects
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, projectId],
  );
  return rows[0] ?? null;
}

export async function saveStudioProject(pool, { workspaceId, ownerUserId, projectId, state }) {
  const document = state?.document ?? {};
  const metadata = document.metadata ?? {};
  const platform = metadata.platform ?? {};
  const scenes = Array.isArray(document.scenes) ? document.scenes : [];
  const widgetCount = scenes.reduce((count, scene) => count + (Array.isArray(scene?.widgetIds) ? scene.widgetIds.length : 0), 0);
  const params = [
    projectId ?? crypto.randomUUID(),
    workspaceId,
    ownerUserId,
    document.name ?? 'Untitled project',
    JSON.stringify(state ?? {}),
    platform.brandId ?? null,
    platform.brandName ?? null,
    platform.campaignName ?? null,
    platform.accessScope ?? 'client',
    document.canvas?.presetId ?? null,
    scenes.length,
    widgetCount,
  ];

  const { rows } = await pool.query(
    `INSERT INTO studio_projects (
       id, workspace_id, owner_user_id, name, state, brand_id, brand_name,
       campaign_name, access_scope, canvas_preset_id, scene_count, widget_count
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id)
     DO UPDATE SET
       workspace_id = EXCLUDED.workspace_id,
       owner_user_id = EXCLUDED.owner_user_id,
       name = EXCLUDED.name,
       state = EXCLUDED.state,
       brand_id = EXCLUDED.brand_id,
       brand_name = EXCLUDED.brand_name,
       campaign_name = EXCLUDED.campaign_name,
       access_scope = EXCLUDED.access_scope,
       canvas_preset_id = EXCLUDED.canvas_preset_id,
       scene_count = EXCLUDED.scene_count,
       widget_count = EXCLUDED.widget_count,
       archived_at = NULL,
       updated_at = NOW()
     RETURNING *`,
    params,
  );
  return rows[0];
}

export async function deleteStudioProject(pool, workspaceId, projectId) {
  const { rowCount } = await pool.query(
    `DELETE FROM studio_projects
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, projectId],
  );
  return rowCount > 0;
}

export async function duplicateStudioProject(pool, workspaceId, projectId, ownerUserId) {
  const project = await getStudioProject(pool, workspaceId, projectId);
  if (!project) return null;
  const nextState = {
    ...(project.state ?? {}),
    document: {
      ...(project.state?.document ?? {}),
      id: crypto.randomUUID(),
      name: `${project.name} Copy`,
      metadata: {
        ...(project.state?.document?.metadata ?? {}),
        dirty: false,
        lastSavedAt: new Date().toISOString(),
      },
    },
    ui: {
      ...(project.state?.ui ?? {}),
      activeProjectId: undefined,
    },
  };
  return saveStudioProject(pool, {
    workspaceId,
    ownerUserId,
    projectId: nextState.document.id,
    state: nextState,
  });
}

export async function updateStudioProjectArchiveState(pool, workspaceId, projectId, archived) {
  const { rows } = await pool.query(
    `UPDATE studio_projects
     SET archived_at = ${archived ? 'NOW()' : 'NULL'},
         updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [workspaceId, projectId],
  );
  return rows[0] ?? null;
}

export async function changeStudioProjectOwner(pool, workspaceId, projectId, ownerUserId) {
  const { rows } = await pool.query(
    `UPDATE studio_projects
     SET owner_user_id = $3,
         updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [workspaceId, projectId, ownerUserId],
  );
  return rows[0] ?? null;
}

export async function listStudioProjectVersions(pool, workspaceId, projectId) {
  const project = await getStudioProject(pool, workspaceId, projectId);
  if (!project) return [];
  const { rows } = await pool.query(
    `SELECT v.id, v.project_id, v.version_number, v.note, v.created_at, p.name AS project_name
     FROM studio_project_versions v
     JOIN studio_projects p ON p.id = v.project_id
     WHERE v.project_id = $1
     ORDER BY v.version_number DESC`,
    [projectId],
  );
  return rows;
}

export async function saveStudioProjectVersion(pool, { workspaceId, projectId, state, note, createdBy }) {
  const project = await getStudioProject(pool, workspaceId, projectId);
  if (!project) return null;
  const { rows: maxRows } = await pool.query(
    `SELECT COALESCE(MAX(version_number), 0) AS current
     FROM studio_project_versions
     WHERE project_id = $1`,
    [projectId],
  );
  const versionNumber = Number(maxRows[0]?.current ?? 0) + 1;
  const { rows } = await pool.query(
    `INSERT INTO studio_project_versions (project_id, version_number, note, state, created_by)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING *`,
    [projectId, versionNumber, note ?? null, JSON.stringify(state ?? {}), createdBy ?? null],
  );
  return rows[0];
}

export async function loadStudioProjectVersion(pool, workspaceId, projectId, versionId) {
  const project = await getStudioProject(pool, workspaceId, projectId);
  if (!project) return null;
  const { rows } = await pool.query(
    `SELECT *
     FROM studio_project_versions
     WHERE project_id = $1 AND id = $2`,
    [projectId, versionId],
  );
  return rows[0] ?? null;
}

function parseJsonField(value, fallback) {
  if (!value || typeof value !== 'object') return fallback;
  return value;
}

export async function listStudioAssets(pool, workspaceId) {
  const { rows } = await pool.query(
    `SELECT *
     FROM studio_assets
     WHERE workspace_id = $1
     ORDER BY created_at DESC`,
    [workspaceId],
  );
  return rows;
}

export async function getStudioAsset(pool, workspaceId, assetId) {
  const { rows } = await pool.query(
    `SELECT *
     FROM studio_assets
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, assetId],
  );
  return rows[0] ?? null;
}

export async function saveStudioAsset(pool, { workspaceId, ownerUserId, assetId, asset }) {
  const id = assetId ?? crypto.randomUUID();
  const row = {
    id,
    workspaceId,
    ownerUserId,
    folderId: asset.folderId ?? null,
    name: asset.name ?? 'Untitled asset',
    kind: asset.kind ?? 'other',
    src: asset.src ?? asset.optimizedUrl ?? asset.publicUrl ?? null,
    mimeType: asset.mimeType ?? null,
    sourceType: asset.sourceType ?? null,
    storageMode: asset.storageMode ?? null,
    storageKey: asset.storageKey ?? null,
    publicUrl: asset.publicUrl ?? null,
    optimizedUrl: asset.optimizedUrl ?? null,
    qualityPreference: asset.qualityPreference ?? null,
    processingStatus: asset.processingStatus ?? null,
    processingMessage: asset.processingMessage ?? null,
    processingAttempts: asset.processingAttempts ?? null,
    processingLastRetryAt: asset.processingLastRetryAt ?? null,
    processingNextRetryAt: asset.processingNextRetryAt ?? null,
    derivatives: asset.derivatives ? JSON.stringify(asset.derivatives) : null,
    originUrl: asset.originUrl ?? null,
    fingerprint: asset.fingerprint ?? null,
    sizeBytes: asset.sizeBytes ?? null,
    width: asset.width ?? null,
    height: asset.height ?? null,
    durationMs: asset.durationMs ?? null,
    posterSrc: asset.posterSrc ?? null,
    thumbnailUrl: asset.thumbnailUrl ?? null,
    fontFamily: asset.fontFamily ?? null,
    tags: JSON.stringify(Array.isArray(asset.tags) ? asset.tags : []),
    accessScope: asset.accessScope ?? 'client',
  };

  const { rows } = await pool.query(
    `INSERT INTO studio_assets (
       id, workspace_id, owner_user_id, folder_id, name, kind, src, mime_type,
       source_type, storage_mode, storage_key, public_url, optimized_url,
       quality_preference, processing_status, processing_message, processing_attempts,
       processing_last_retry_at, processing_next_retry_at, derivatives, origin_url,
       fingerprint, size_bytes, width, height, duration_ms, poster_src,
       thumbnail_url, font_family, tags, access_scope
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8,
       $9, $10, $11, $12, $13,
       $14, $15, $16, $17,
       $18, $19, $20::jsonb, $21,
       $22, $23, $24, $25, $26, $27,
       $28, $29, $30::jsonb, $31
     )
     ON CONFLICT (id)
     DO UPDATE SET
       folder_id = EXCLUDED.folder_id,
       name = EXCLUDED.name,
       kind = EXCLUDED.kind,
       src = EXCLUDED.src,
       mime_type = EXCLUDED.mime_type,
       source_type = EXCLUDED.source_type,
       storage_mode = EXCLUDED.storage_mode,
       storage_key = EXCLUDED.storage_key,
       public_url = EXCLUDED.public_url,
       optimized_url = EXCLUDED.optimized_url,
       quality_preference = EXCLUDED.quality_preference,
       processing_status = EXCLUDED.processing_status,
       processing_message = EXCLUDED.processing_message,
       processing_attempts = EXCLUDED.processing_attempts,
       processing_last_retry_at = EXCLUDED.processing_last_retry_at,
       processing_next_retry_at = EXCLUDED.processing_next_retry_at,
       derivatives = EXCLUDED.derivatives,
       origin_url = EXCLUDED.origin_url,
       fingerprint = EXCLUDED.fingerprint,
       size_bytes = EXCLUDED.size_bytes,
       width = EXCLUDED.width,
       height = EXCLUDED.height,
       duration_ms = EXCLUDED.duration_ms,
       poster_src = EXCLUDED.poster_src,
       thumbnail_url = EXCLUDED.thumbnail_url,
       font_family = EXCLUDED.font_family,
       tags = EXCLUDED.tags,
       access_scope = EXCLUDED.access_scope,
       updated_at = NOW()
     RETURNING *`,
    [
      row.id, row.workspaceId, row.ownerUserId, row.folderId, row.name, row.kind, row.src, row.mimeType,
      row.sourceType, row.storageMode, row.storageKey, row.publicUrl, row.optimizedUrl,
      row.qualityPreference, row.processingStatus, row.processingMessage, row.processingAttempts,
      row.processingLastRetryAt, row.processingNextRetryAt, row.derivatives ?? '{}', row.originUrl,
      row.fingerprint, row.sizeBytes, row.width, row.height, row.durationMs, row.posterSrc,
      row.thumbnailUrl, row.fontFamily, row.tags, row.accessScope,
    ],
  );
  return rows[0];
}

export async function deleteStudioAsset(pool, workspaceId, assetId) {
  const { rowCount } = await pool.query(
    `DELETE FROM studio_assets
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, assetId],
  );
  return rowCount > 0;
}

export async function patchStudioAsset(pool, workspaceId, assetId, patch) {
  const allowed = {
    name: 'name',
    folderId: 'folder_id',
    qualityPreference: 'quality_preference',
    processingStatus: 'processing_status',
    processingMessage: 'processing_message',
  };
  const sets = [];
  const params = [workspaceId, assetId];
  for (const [key, column] of Object.entries(allowed)) {
    if (key in patch) {
      params.push(patch[key] ?? null);
      sets.push(`${column} = $${params.length}`);
    }
  }
  if (sets.length === 0) return getStudioAsset(pool, workspaceId, assetId);
  sets.push('updated_at = NOW()');
  const { rows } = await pool.query(
    `UPDATE studio_assets
     SET ${sets.join(', ')}
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    params,
  );
  return rows[0] ?? null;
}

export async function listStudioAssetFolders(pool, workspaceId) {
  const { rows } = await pool.query(
    `SELECT *
     FROM studio_asset_folders
     WHERE workspace_id = $1
     ORDER BY created_at ASC`,
    [workspaceId],
  );
  return rows;
}

export async function createStudioAssetFolder(pool, { workspaceId, ownerUserId, name, parentId }) {
  const { rows } = await pool.query(
    `INSERT INTO studio_asset_folders (workspace_id, owner_user_id, name, parent_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [workspaceId, ownerUserId, name, parentId ?? null],
  );
  return rows[0];
}

export async function renameStudioAssetFolder(pool, workspaceId, folderId, name) {
  const { rows } = await pool.query(
    `UPDATE studio_asset_folders
     SET name = $3, updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [workspaceId, folderId, name],
  );
  return rows[0] ?? null;
}

export async function deleteStudioAssetFolder(pool, workspaceId, folderId) {
  await pool.query(
    `UPDATE studio_assets
     SET folder_id = NULL, updated_at = NOW()
     WHERE workspace_id = $1 AND folder_id = $2`,
    [workspaceId, folderId],
  );
  const { rowCount } = await pool.query(
    `DELETE FROM studio_asset_folders
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, folderId],
  );
  return rowCount > 0;
}

export function mapStudioProjectRowToDto(row) {
  return {
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString(),
    clientId: row.workspace_id,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name ?? undefined,
    brandId: row.brand_id ?? undefined,
    brandName: row.brand_name ?? undefined,
    campaignName: row.campaign_name ?? undefined,
    accessScope: row.access_scope ?? 'client',
    archivedAt: row.archived_at ? (row.archived_at instanceof Date ? row.archived_at.toISOString() : new Date(row.archived_at).toISOString()) : undefined,
    canvasPresetId: row.canvas_preset_id ?? undefined,
    sceneCount: row.scene_count ?? 0,
    widgetCount: row.widget_count ?? 0,
  };
}

export function mapStudioAssetRowToDto(row) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    src: row.src ?? undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    mimeType: row.mime_type ?? undefined,
    sourceType: row.source_type ?? undefined,
    storageMode: row.storage_mode ?? undefined,
    storageKey: row.storage_key ?? undefined,
    publicUrl: row.public_url ?? undefined,
    optimizedUrl: row.optimized_url ?? undefined,
    qualityPreference: row.quality_preference ?? undefined,
    processingStatus: row.processing_status ?? undefined,
    processingMessage: row.processing_message ?? undefined,
    processingAttempts: row.processing_attempts ?? undefined,
    processingLastRetryAt: row.processing_last_retry_at ? new Date(row.processing_last_retry_at).toISOString() : undefined,
    processingNextRetryAt: row.processing_next_retry_at ? new Date(row.processing_next_retry_at).toISOString() : undefined,
    derivatives: parseJsonField(row.derivatives, undefined),
    originUrl: row.origin_url ?? undefined,
    fingerprint: row.fingerprint ?? undefined,
    sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : undefined,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    posterSrc: row.poster_src ?? undefined,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    fontFamily: row.font_family ?? undefined,
    tags: Array.isArray(row.tags) ? row.tags : [],
    folderId: row.folder_id ?? undefined,
    clientId: row.workspace_id,
    ownerUserId: row.owner_user_id,
    accessScope: row.access_scope ?? undefined,
  };
}

export function mapStudioAssetFolderRowToDto(row) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    clientId: row.workspace_id,
    ownerUserId: row.owner_user_id,
    parentId: row.parent_id ?? undefined,
  };
}
