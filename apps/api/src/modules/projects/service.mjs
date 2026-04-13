import { randomUUID } from 'node:crypto';

const VALID_ACCESS_SCOPES = new Set(['private', 'client', 'reviewers']);
const VALID_DRAFT_KINDS = new Set(['autosave', 'manual']);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value, fallback = '') {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
}

function ensureStudioState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new Error('Document state is required.');
  }
  return state;
}

function ensureDraftKind(kind) {
  if (!VALID_DRAFT_KINDS.has(kind)) {
    throw new Error('Draft kind is invalid.');
  }
  return kind;
}

function countWidgets(document) {
  const scenes = Array.isArray(document.scenes) ? document.scenes : [];
  return scenes.reduce((count, scene) => count + (Array.isArray(scene?.widgetIds) ? scene.widgetIds.length : 0), 0);
}

function deriveProjectFields(state, workspace) {
  const safeState = ensureStudioState(state);
  const document = asObject(safeState.document);
  const metadata = asObject(document.metadata);
  const platform = asObject(metadata.platform);
  const scenes = Array.isArray(document.scenes) ? document.scenes : [];
  const accessScope = VALID_ACCESS_SCOPES.has(platform.accessScope) ? platform.accessScope : 'client';

  return {
    id: normalizeString(document.id),
    name: normalizeString(document.name, 'Untitled Project'),
    brandId: normalizeString(platform.brandId) || null,
    campaignName: normalizeString(platform.campaignName) || null,
    accessScope,
    canvasPresetId: normalizeString(asObject(document.canvas).presetId) || null,
    sceneCount: scenes.length,
    widgetCount: countWidgets(document),
    stampedState: stampStateForWorkspace(safeState, {
      projectId: normalizeString(document.id),
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      accessScope,
    }),
  };
}

function stampStateForWorkspace(state, { projectId, workspaceId, workspaceName, accessScope, savedAt, versionNumber }) {
  const safeState = ensureStudioState(state);
  const document = asObject(safeState.document);
  const metadata = asObject(document.metadata);
  const platform = asObject(metadata.platform);
  const ui = asObject(safeState.ui);

  return {
    ...safeState,
    document: {
      ...document,
      ...(projectId ? { id: projectId } : {}),
      ...(versionNumber !== undefined ? { version: versionNumber } : {}),
      metadata: {
        ...metadata,
        ...(savedAt ? { lastSavedAt: savedAt } : {}),
        platform: {
          ...platform,
          clientId: workspaceId,
          clientName: workspaceName || platform.clientName,
          accessScope: accessScope || platform.accessScope || 'client',
        },
      },
    },
    ui: {
      ...ui,
      ...(projectId ? { activeProjectId: projectId } : {}),
    },
  };
}

function mapProjectRow(row) {
  return {
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at.toISOString(),
    clientId: row.workspace_id,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name || undefined,
    brandId: row.brand_id || undefined,
    brandName: row.brand_name || undefined,
    campaignName: row.campaign_name || undefined,
    accessScope: row.access_scope || 'client',
    archivedAt: row.archived_at ? row.archived_at.toISOString() : undefined,
    canvasPresetId: row.canvas_preset_id || undefined,
    sceneCount: Number.isFinite(row.scene_count) ? row.scene_count : 0,
    widgetCount: Number.isFinite(row.widget_count) ? row.widget_count : 0,
  };
}

async function selectProjectSummary(client, projectId, workspaceId) {
  const result = await client.query(
    `
      select p.id,
             p.workspace_id,
             p.owner_user_id,
             p.name,
             p.brand_id,
             p.campaign_name,
             p.access_scope,
             p.canvas_preset_id,
             p.scene_count,
             p.widget_count,
             p.archived_at,
             p.updated_at,
             u.display_name as owner_name,
             b.name as brand_name
      from projects p
      join users u on u.id = p.owner_user_id
      left join brands b on b.id = p.brand_id
      where p.id = $1 and p.workspace_id = $2
      limit 1
    `,
    [projectId, workspaceId],
  );
  return result.rows[0] ? mapProjectRow(result.rows[0]) : null;
}

export async function listProjectsForWorkspace(client, workspaceId) {
  const result = await client.query(
    `
      select p.id,
             p.workspace_id,
             p.owner_user_id,
             p.name,
             p.brand_id,
             p.campaign_name,
             p.access_scope,
             p.canvas_preset_id,
             p.scene_count,
             p.widget_count,
             p.archived_at,
             p.updated_at,
             u.display_name as owner_name,
             b.name as brand_name
      from projects p
      join users u on u.id = p.owner_user_id
      left join brands b on b.id = p.brand_id
      where p.workspace_id = $1
      order by p.updated_at desc, p.created_at desc
    `,
    [workspaceId],
  );
  return result.rows.map(mapProjectRow);
}

export async function getProjectState(client, { projectId, workspaceId }) {
  const result = await client.query(
    `
      select pd.document_state
      from project_documents pd
      join projects p on p.id = pd.project_id
      where p.id = $1 and p.workspace_id = $2
      limit 1
    `,
    [projectId, workspaceId],
  );
  return result.rows[0]?.document_state || null;
}

export async function saveProject(client, { workspace, userId, projectId, state }) {
  const requestedId = normalizeString(projectId) || normalizeString(asObject(state.document).id) || randomUUID();
  const fields = deriveProjectFields(state, workspace);
  const stampedState = stampStateForWorkspace(fields.stampedState, {
    projectId: requestedId,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    accessScope: fields.accessScope,
  });

  const existingResult = await client.query(
    'select id from projects where id = $1 and workspace_id = $2 limit 1',
    [requestedId, workspace.id],
  );

  if (existingResult.rows[0]) {
    await client.query(
      `
        update projects
        set name = $3,
            brand_id = $4,
            campaign_name = $5,
            access_scope = $6,
            canvas_preset_id = $7,
            scene_count = $8,
            widget_count = $9,
            updated_at = now()
        where id = $1 and workspace_id = $2
      `,
      [
        requestedId,
        workspace.id,
        fields.name,
        fields.brandId,
        fields.campaignName,
        fields.accessScope,
        fields.canvasPresetId,
        fields.sceneCount,
        fields.widgetCount,
      ],
    );

    await client.query(
      `
        insert into project_documents (project_id, revision, document_state, updated_at, updated_by_user_id)
        values ($1, 1, $2::jsonb, now(), $3)
        on conflict (project_id) do update
        set revision = project_documents.revision + 1,
            document_state = excluded.document_state,
            updated_at = now(),
            updated_by_user_id = excluded.updated_by_user_id
      `,
      [requestedId, JSON.stringify(stampedState), userId],
    );
  } else {
    await client.query(
      `
        insert into projects (
          id,
          workspace_id,
          owner_user_id,
          name,
          brand_id,
          campaign_name,
          access_scope,
          canvas_preset_id,
          scene_count,
          widget_count
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        requestedId,
        workspace.id,
        userId,
        fields.name,
        fields.brandId,
        fields.campaignName,
        fields.accessScope,
        fields.canvasPresetId,
        fields.sceneCount,
        fields.widgetCount,
      ],
    );

    await client.query(
      `
        insert into project_documents (project_id, revision, document_state, updated_at, updated_by_user_id)
        values ($1, 1, $2::jsonb, now(), $3)
      `,
      [requestedId, JSON.stringify(stampedState), userId],
    );
  }

  return selectProjectSummary(client, requestedId, workspace.id);
}

export async function deleteProject(client, { projectId, workspaceId }) {
  await client.query('delete from projects where id = $1 and workspace_id = $2', [projectId, workspaceId]);
}

export async function duplicateProject(client, { projectId, workspace, userId }) {
  const state = await getProjectState(client, { projectId, workspaceId: workspace.id });
  const summary = await selectProjectSummary(client, projectId, workspace.id);
  if (!state || !summary) {
    throw new Error('Project not found.');
  }

  const nextId = randomUUID();
  const duplicatedState = stampStateForWorkspace(state, {
    projectId: nextId,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    accessScope: summary.accessScope,
  });
  duplicatedState.document = {
    ...asObject(duplicatedState.document),
    name: `${summary.name} Copy`,
    version: 0,
    metadata: {
      ...asObject(asObject(duplicatedState.document).metadata),
      dirty: false,
      lastSavedAt: new Date().toISOString(),
      platform: {
        ...asObject(asObject(asObject(duplicatedState.document).metadata).platform),
        brandId: summary.brandId,
        brandName: summary.brandName,
        campaignName: summary.campaignName,
      },
    },
  };

  return saveProject(client, { workspace, userId, projectId: nextId, state: duplicatedState });
}

export async function setProjectArchived(client, { projectId, workspaceId, archived }) {
  await client.query(
    `
      update projects
      set archived_at = ${archived ? 'now()' : 'null'},
          updated_at = now()
      where id = $1 and workspace_id = $2
    `,
    [projectId, workspaceId],
  );
}

export async function setProjectOwner(client, { projectId, workspaceId, ownerUserId }) {
  const membership = await client.query(
    'select 1 from workspace_members where workspace_id = $1 and user_id = $2 limit 1',
    [workspaceId, ownerUserId],
  );
  if (!membership.rows[0]) {
    throw new Error('Selected owner does not belong to this workspace.');
  }
  await client.query(
    'update projects set owner_user_id = $3, updated_at = now() where id = $1 and workspace_id = $2',
    [projectId, workspaceId, ownerUserId],
  );
}

export async function getProjectManagementSnapshot(client, { projectId, workspaceId }) {
  const result = await client.query(
    `
      select id, owner_user_id
      from projects
      where id = $1 and workspace_id = $2
      limit 1
    `,
    [projectId, workspaceId],
  );
  return result.rows[0] || null;
}

export async function listProjectVersions(client, { projectId, workspaceId }) {
  const result = await client.query(
    `
      select pv.id,
             pv.project_id,
             pv.version_number,
             pv.saved_at,
             pv.note,
             p.name as project_name
      from project_versions pv
      join projects p on p.id = pv.project_id
      where pv.project_id = $1 and p.workspace_id = $2
      order by pv.saved_at desc, pv.version_number desc
    `,
    [projectId, workspaceId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    versionNumber: row.version_number,
    savedAt: row.saved_at.toISOString(),
    note: row.note || undefined,
  }));
}

export async function loadProjectVersion(client, { projectId, versionId, workspaceId }) {
  const result = await client.query(
    `
      select pv.snapshot_state
      from project_versions pv
      join projects p on p.id = pv.project_id
      where pv.project_id = $1
        and pv.id = $2
        and p.workspace_id = $3
      limit 1
    `,
    [projectId, versionId, workspaceId],
  );
  return result.rows[0]?.snapshot_state || null;
}

export async function saveProjectVersion(client, { workspace, userId, projectId, state, note }) {
  const summary = await selectProjectSummary(client, projectId, workspace.id);
  if (!summary) {
    throw new Error('Project not found.');
  }

  const versionNumberResult = await client.query(
    'select coalesce(max(version_number), 0) + 1 as next_version_number from project_versions where project_id = $1',
    [projectId],
  );
  const nextVersionNumber = Number(versionNumberResult.rows[0]?.next_version_number || 1);
  const savedAt = new Date().toISOString();
  const normalizedNote = normalizeString(note) || null;
  const stampedState = stampStateForWorkspace(state, {
    projectId,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    accessScope: summary.accessScope,
    savedAt,
    versionNumber: nextVersionNumber,
  });
  const fields = deriveProjectFields(stampedState, workspace);
  const versionId = randomUUID();

  await client.query(
    `
      insert into project_versions (
        id,
        project_id,
        version_number,
        note,
        snapshot_state,
        saved_at,
        saved_by_user_id
      )
      values ($1, $2, $3, $4, $5::jsonb, $6::timestamptz, $7)
    `,
    [versionId, projectId, nextVersionNumber, normalizedNote, JSON.stringify(stampedState), savedAt, userId],
  );

  await client.query(
    `
      update projects
      set name = $3,
          brand_id = $4,
          campaign_name = $5,
          access_scope = $6,
          canvas_preset_id = $7,
          scene_count = $8,
          widget_count = $9,
          updated_at = $10::timestamptz
      where id = $1 and workspace_id = $2
    `,
    [
      projectId,
      workspace.id,
      fields.name,
      fields.brandId,
      fields.campaignName,
      fields.accessScope,
      fields.canvasPresetId,
      fields.sceneCount,
      fields.widgetCount,
      savedAt,
    ],
  );

  await client.query(
    `
      insert into project_documents (project_id, revision, document_state, updated_at, updated_by_user_id)
      values ($1, 1, $2::jsonb, $3::timestamptz, $4)
      on conflict (project_id) do update
      set revision = project_documents.revision + 1,
          document_state = excluded.document_state,
          updated_at = excluded.updated_at,
          updated_by_user_id = excluded.updated_by_user_id
    `,
    [projectId, JSON.stringify(stampedState), savedAt, userId],
  );

  return {
    id: versionId,
    projectId,
    projectName: fields.name,
    versionNumber: nextVersionNumber,
    savedAt,
    note: normalizedNote || undefined,
  };
}

export async function saveUserDraft(client, { userId, workspaceId, kind, state }) {
  const safeKind = ensureDraftKind(kind);
  ensureStudioState(state);
  const result = await client.query(
    `
      insert into user_document_drafts (
        user_id,
        workspace_id,
        kind,
        document_state,
        revision,
        updated_at,
        updated_by_user_id
      )
      values ($1, $2, $3, $4::jsonb, 1, now(), $1)
      on conflict (user_id, kind) do update
      set workspace_id = excluded.workspace_id,
          document_state = excluded.document_state,
          revision = user_document_drafts.revision + 1,
          updated_at = now(),
          updated_by_user_id = excluded.updated_by_user_id
      returning revision, updated_at
    `,
    [userId, workspaceId, safeKind, JSON.stringify(state)],
  );
  return {
    revision: Number(result.rows[0]?.revision || 1),
    updatedAt: result.rows[0]?.updated_at?.toISOString?.() || new Date().toISOString(),
  };
}

export async function loadUserDraft(client, { userId, workspaceId, kind }) {
  const safeKind = ensureDraftKind(kind);
  const result = await client.query(
    `
      select document_state
      from user_document_drafts
      where user_id = $1 and workspace_id = $2 and kind = $3
      limit 1
    `,
    [userId, workspaceId, safeKind],
  );
  return result.rows[0]?.document_state || null;
}

export async function deleteUserDraft(client, { userId, workspaceId, kind }) {
  const safeKind = ensureDraftKind(kind);
  await client.query(
    'delete from user_document_drafts where user_id = $1 and workspace_id = $2 and kind = $3',
    [userId, workspaceId, safeKind],
  );
}

export async function hasUserDraft(client, { userId, workspaceId, kind }) {
  const safeKind = ensureDraftKind(kind);
  const result = await client.query(
    'select 1 from user_document_drafts where user_id = $1 and workspace_id = $2 and kind = $3 limit 1',
    [userId, workspaceId, safeKind],
  );
  return Boolean(result.rows[0]);
}
